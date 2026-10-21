// Behavior every recipe store shares (R1.4). Unit tests run it against the
// in-memory twin; browser tests run it against IndexedDB.
// No imports: the browser loads this file as-is.

/** Deep equality for plain data: objects, arrays and primitives. */
function same(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]));
}

/** Assertions that work in Node and in the browser, plus a recipe maker. */
export function tools(newRecipe) {
  return {
    equal(actual, expected, message = 'values differ') {
      if (!same(actual, expected)) {
        throw new Error(`${message}\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
      }
    },
    async rejects(action, message = 'expected a rejection') {
      try {
        await action();
      } catch {
        return;
      }
      throw new Error(message);
    },
    recipe: (title) => newRecipe({ title }),
  };
}

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const scenarios = {
  async 'starts empty'(store, t) {
    t.equal(await store.list(), []);
  },

  async 'get returns what put stored'(store, t) {
    const recipe = t.recipe('Feijoada');
    recipe.ingredients = [{ heading: '', items: [{ quantity: '500', unit: 'g', name: 'feijão preto', note: '', alternatives: [] }] }];
    await store.put(recipe);
    t.equal(await store.get(recipe.id), recipe);
  },

  async 'get of an unknown id is undefined'(store, t) {
    t.equal(await store.get('no-such-id'), undefined);
  },

  async 'put with an existing id replaces that recipe'(store, t) {
    const recipe = t.recipe('Bolo');
    await store.put(recipe);
    const renamed = { ...recipe, title: 'Bolo de fubá' };
    await store.put(renamed);
    t.equal(await store.get(recipe.id), renamed);
    t.equal((await store.list()).length, 1, 'still one recipe');
  },

  async 'list returns every recipe'(store, t) {
    const recipes = [t.recipe('Caldo verde'), t.recipe('Shakshuka'), t.recipe('Pão de queijo')];
    for (const recipe of recipes) await store.put(recipe);
    t.equal((await store.list()).sort(byId), recipes.sort(byId));
  },

  async 'stored recipes are copies, not shared objects'(store, t) {
    const recipe = t.recipe('Moqueca');
    await store.put(recipe);
    recipe.title = 'changed after put';
    const fetched = await store.get(recipe.id);
    fetched.title = 'changed after get';
    t.equal((await store.get(recipe.id)).title, 'Moqueca');
  },

  async 'remove deletes just that recipe; unknown ids are fine'(store, t) {
    const keep = t.recipe('Keep');
    const drop = t.recipe('Drop');
    await store.put(keep);
    await store.put(drop);
    await store.remove(drop.id);
    await store.remove('no-such-id');
    t.equal(await store.list(), [keep]);
  },

  async 'put rejects an invalid recipe and stores nothing'(store, t) {
    const recipe = t.recipe('Pastel');
    recipe.title = '';
    await t.rejects(() => store.put(recipe), 'a blank title must be rejected');
    t.equal(await store.list(), []);
  },

  async 'fields from newer versions survive a round trip'(store, t) {
    const recipe = { ...t.recipe('Torta de limão'), servings: 8, photos: [{ id: 'p1' }] };
    await store.put(recipe);
    t.equal(await store.get(recipe.id), recipe);
  },
};
