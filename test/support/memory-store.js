// In-memory twin of app/store/local-store.js for unit tests. It passes the
// same contract (test/contract/recipe-store.js), so tests built on it hold for
// IndexedDB too.
import { assertValidRecipe } from '../../app/domain/recipe.js';

/** @returns {import('../../app/store/local-store.js').RecipeStore} */
export function createMemoryStore() {
  /** @type {Map<string, import('../../app/domain/recipe.js').Recipe>} */
  const recipes = new Map();
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
  };
}
