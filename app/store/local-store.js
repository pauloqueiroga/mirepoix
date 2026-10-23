// The device's own copy of the recipes, in IndexedDB (D4), plus what syncing
// needs to remember between visits (R2.3): what the remote copy of each recipe
// was when this device last matched it, and the connection to it.
import { fingerprint } from '../domain/fingerprint.js';
import { assertValidRecipe } from '../domain/recipe.js';

/** @typedef {import('../domain/recipe.js').Recipe} Recipe */

/**
 * What the app needs from a recipe store. test/contract/recipe-store.js holds
 * the behavior every implementation must share.
 * @typedef {object} RecipeStore
 * @property {() => Promise<Recipe[]>} list every recipe, in no particular order
 * @property {(id: string) => Promise<Recipe | undefined>} get
 * @property {(recipe: Recipe) => Promise<void>} put adds or replaces by id; rejects invalid recipes
 * @property {(id: string) => Promise<void>} remove
 */

/**
 * A recipe's remote file as this device last matched it: its version, and
 * the fingerprint of the recipe it held. A recipe whose fingerprint differs
 * from its base changed here since; a recipe that's gone while its base
 * stays was deleted here. So changes waiting to go up survive going offline
 * and reloading, without a queue to keep.
 * @typedef {{ id: string, version: string, fingerprint: string }} Base
 */
/**
 * A change the sync engine makes in one go: all of it, or none of it when a
 * recipe isn't as expected because it changed on this device meanwhile.
 * @typedef {object} Settlement
 * @property {Record<string, string | null>} [expect] id → the recipe's fingerprint now, or null for no recipe
 * @property {Recipe[]} [put] recipes to add or replace
 * @property {string[]} [remove] recipes to delete
 * @property {Base[]} [bases] bases to add or replace
 * @property {string[]} [forget] ids whose base goes
 */
/**
 * @typedef {{ connection: import('./sync.js').Connection, head: string, synced: string }} Settings
 *   head: the remote commit every base reflects, so an unchanged head means nothing to download;
 *   synced: when the last pass finished, as an ISO timestamp
 */
/**
 * The recipe store, and what syncing keeps.
 * @typedef {RecipeStore & {
 *   bases: () => Promise<Base[]>,
 *   settle: (change: Settlement) => Promise<boolean>,
 *   setting: <K extends keyof Settings>(name: K) => Promise<Settings[K] | undefined>,
 *   setSetting: <K extends keyof Settings>(name: K, value: Settings[K] | undefined) => Promise<void>,
 *   forgetSync: () => Promise<void>,
 * }} LocalStore
 *   settle: false, with nothing changed, when an expectation doesn't hold.
 *   setSetting: undefined removes it. forgetSync: drops the bases and settings, never recipes.
 */

const VERSION = 2;
const RECIPES = 'recipes';
const BASES = 'synced';
const SETTINGS = 'settings';

/**
 * @param {{ name?: string, indexedDB?: IDBFactory }} [options]
 * @returns {Promise<LocalStore>}
 */
export async function openLocalStore({ name = 'mirepoix', indexedDB = globalThis.indexedDB } = {}) {
  const opening = indexedDB.open(name, VERSION);
  opening.onupgradeneeded = (event) => {
    const db = opening.result;
    if (event.oldVersion < 1) db.createObjectStore(RECIPES, { keyPath: 'id' });
    if (event.oldVersion < 2) {
      db.createObjectStore(BASES, { keyPath: 'id' });
      db.createObjectStore(SETTINGS);
    }
  };
  const db = await settled(opening);
  db.onversionchange = () => db.close();

  /** @param {IDBTransactionMode} mode */
  const recipes = (mode) => db.transaction(RECIPES, mode).objectStore(RECIPES);

  return {
    list: () => settled(recipes('readonly').getAll()),
    get: (id) => settled(recipes('readonly').get(id)),
    async put(recipe) {
      assertValidRecipe(recipe);
      const store = recipes('readwrite');
      store.put(recipe);
      await committed(store.transaction);
    },
    async remove(id) {
      const store = recipes('readwrite');
      store.delete(id);
      await committed(store.transaction);
    },

    bases: () => settled(db.transaction(BASES, 'readonly').objectStore(BASES).getAll()),

    async settle({ expect = {}, put = [], remove = [], bases = [], forget = [] }) {
      for (const recipe of put) assertValidRecipe(recipe);
      const transaction = db.transaction([RECIPES, BASES], 'readwrite');
      const recipeStore = transaction.objectStore(RECIPES);
      const baseStore = transaction.objectStore(BASES);
      const done = committed(transaction);
      const write = () => {
        for (const recipe of put) recipeStore.put(recipe);
        for (const id of remove) recipeStore.delete(id);
        for (const base of bases) baseStore.put(base);
        for (const id of forget) baseStore.delete(id);
      };
      // Check every expectation inside the same transaction as the writes, so
      // nothing can change in between.
      const checks = Object.entries(expect);
      let waiting = checks.length;
      let holds = true;
      if (waiting === 0) write();
      for (const [id, expected] of checks) {
        const reading = recipeStore.get(id);
        reading.onsuccess = () => {
          const current = /** @type {Recipe | undefined} */ (reading.result);
          if ((current ? fingerprint(current) : null) !== expected) holds = false;
          waiting -= 1;
          if (waiting > 0) return;
          if (holds) write();
          else transaction.abort();
        };
      }
      try {
        await done;
        return true;
      } catch (error) {
        if (!holds) return false;
        throw error;
      }
    },

    setting: (key) => settled(db.transaction(SETTINGS, 'readonly').objectStore(SETTINGS).get(key)),
    async setSetting(key, value) {
      const store = db.transaction(SETTINGS, 'readwrite').objectStore(SETTINGS);
      if (value === undefined) store.delete(key);
      else store.put(value, key);
      await committed(store.transaction);
    },
    async forgetSync() {
      const transaction = db.transaction([BASES, SETTINGS], 'readwrite');
      transaction.objectStore(BASES).clear();
      transaction.objectStore(SETTINGS).clear();
      await committed(transaction);
    },
  };
}

/**
 * Asks the browser not to evict our data when the device runs low on space.
 * @param {Pick<StorageManager, 'persist' | 'persisted'> | undefined} [storage]
 * @returns {Promise<boolean>} whether this site's storage is now persistent
 */
export async function requestPersistentStorage(storage = globalThis.navigator?.storage) {
  if (!storage?.persist) return false;
  try {
    return (await storage.persisted()) || (await storage.persist());
  } catch {
    return false;
  }
}

/**
 * @template T
 * @param {IDBRequest<T>} request
 * @returns {Promise<T>}
 */
function settled(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * @param {IDBTransaction} transaction
 * @returns {Promise<void>}
 */
function committed(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
