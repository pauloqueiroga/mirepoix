// In-memory twin of app/store/local-store.js for unit tests. It passes the
// same contract (test/contract/recipe-store.js), so tests built on it hold for
// IndexedDB too.
import { fingerprint } from '../../app/domain/fingerprint.js';
import { assertValidRecipe } from '../../app/domain/recipe.js';

/** @returns {import('../../app/store/local-store.js').LocalStore} */
export function createMemoryStore() {
  /** @type {Map<string, import('../../app/domain/recipe.js').Recipe>} */
  const recipes = new Map();
  /** @type {Map<string, import('../../app/store/local-store.js').Base>} */
  const bases = new Map();
  /** @type {Map<string, unknown>} */
  const settings = new Map();
  return {
    list: async () => [...recipes.values()].map((recipe) => structuredClone(recipe)),
    get: async (id) => {
      const recipe = recipes.get(id);
      return recipe && structuredClone(recipe);
    },
    async put(recipe) {
      assertValidRecipe(recipe);
      recipes.set(recipe.id, structuredClone(recipe));
    },
    async remove(id) {
      recipes.delete(id);
    },

    bases: async () => [...bases.values()].map((base) => structuredClone(base)),
    async settle({ expect = {}, put = [], remove = [], bases: newBases = [], forget = [] }) {
      for (const recipe of put) assertValidRecipe(recipe);
      for (const [id, expected] of Object.entries(expect)) {
        const current = recipes.get(id);
        if ((current ? fingerprint(current) : null) !== expected) return false;
      }
      for (const recipe of put) recipes.set(recipe.id, structuredClone(recipe));
      for (const id of remove) recipes.delete(id);
      for (const base of newBases) bases.set(base.id, structuredClone(base));
      for (const id of forget) bases.delete(id);
      return true;
    },

    setting: async (name) => {
      const value = settings.get(name);
      return /** @type {any} */ (value === undefined ? undefined : structuredClone(value));
    },
    async setSetting(name, value) {
      if (value === undefined) settings.delete(name);
      else settings.set(name, structuredClone(value));
    },
    async forgetSync() {
      bases.clear();
      settings.clear();
    },
  };
}
