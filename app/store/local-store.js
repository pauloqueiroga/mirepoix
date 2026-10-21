// The device's own copy of the recipes, in IndexedDB (D4).
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

const VERSION = 1;
const RECIPES = 'recipes';

/**
 * @param {{ name?: string, indexedDB?: IDBFactory }} [options]
 * @returns {Promise<RecipeStore>}
 */
export async function openLocalStore({ name = 'mirepoix', indexedDB = globalThis.indexedDB } = {}) {
  const opening = indexedDB.open(name, VERSION);
  opening.onupgradeneeded = () => {
    opening.result.createObjectStore(RECIPES, { keyPath: 'id' });
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
