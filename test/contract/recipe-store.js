// Behavior every recipe store shares (R1.4), including what syncing keeps
// (R2.3). Unit tests run it against the in-memory twin; browser tests run it
// against IndexedDB. No imports: the browser loads this file as-is.

/** Deep equality for plain data: objects, arrays and primitives. */
function same(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]));
}

/** Assertions that work in Node and in the browser, plus a recipe maker and the app's fingerprint. */
export function tools(newRecipe, fingerprint) {
  return {
    fingerprint,
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

  async 'settle applies recipes and bases together, when every recipe is as expected'(store, t) {
    const kept = t.recipe('Feijoada');
    const changed = t.recipe('Bolo');
    const gone = t.recipe('Pastel');
    for (const recipe of [kept, changed, gone]) await store.put(recipe);
    const edited = { ...changed, title: 'Bolo de fubá' };
    const added = t.recipe('Moqueca');
    const ok = await store.settle({
      expect: { [changed.id]: t.fingerprint(changed), [gone.id]: t.fingerprint(gone), [added.id]: null },
      put: [edited, added],
      remove: [gone.id],
      bases: [{ id: edited.id, version: 'v2', fingerprint: t.fingerprint(edited) }, { id: gone.id, version: 'v1', fingerprint: 'f' }],
    });
    t.equal(ok, true);
    t.equal((await store.list()).sort(byId), [kept, edited, added].sort(byId));
    t.equal((await store.bases()).sort(byId), [
      { id: edited.id, version: 'v2', fingerprint: t.fingerprint(edited) },
      { id: gone.id, version: 'v1', fingerprint: 'f' },
    ].sort(byId));
    t.equal(await store.settle({ forget: [gone.id] }), true);
    t.equal((await store.bases()).map((base) => base.id), [edited.id]);
  },

  async 'settle changes nothing when a recipe changed meanwhile'(store, t) {
    const recipe = t.recipe('Bolo');
    await store.put(recipe);
    const before = t.fingerprint(recipe);
    await store.put({ ...recipe, title: 'Bolo de fubá' });
    const other = t.recipe('Pastel');
    for (const expect of [{ [recipe.id]: before }, { [recipe.id]: null }, { [other.id]: 'something' }]) {
      const ok = await store.settle({
        expect,
        put: [{ ...recipe, title: 'From elsewhere' }, other],
        bases: [{ id: recipe.id, version: 'v9', fingerprint: 'x' }],
      });
      t.equal(ok, false, JSON.stringify(expect));
    }
    t.equal((await store.list()).map((r) => r.title), ['Bolo de fubá']);
    t.equal(await store.bases(), []);
  },

  async 'settle rejects an invalid recipe and changes nothing'(store, t) {
    const recipe = t.recipe('Pastel');
    await t.rejects(() => store.settle({ put: [{ ...recipe, title: ' ' }], bases: [{ id: recipe.id, version: 'v1', fingerprint: 'f' }] }));
    t.equal(await store.list(), []);
    t.equal(await store.bases(), []);
  },

  async 'removing a recipe keeps its base, so the deletion can go up later'(store, t) {
    const recipe = t.recipe('Bolo');
    await store.put(recipe);
    await store.settle({ bases: [{ id: recipe.id, version: 'v1', fingerprint: t.fingerprint(recipe) }] });
    await store.remove(recipe.id);
    t.equal((await store.bases()).map((base) => base.id), [recipe.id]);
  },

  async 'settings are kept, a key among them, and forgetting them keeps every recipe'(store, t) {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const recipe = t.recipe('Bolo');
    await store.put(recipe);
    await store.settle({ bases: [{ id: recipe.id, version: 'v1', fingerprint: 'f' }] });
    t.equal(await store.setting('head'), undefined);
    await store.setSetting('head', 'abc');
    await store.setSetting('connection', { repository: 'cook/data', branch: 'main', token: 't', key, device: 'Mac', vault: 'v' });
    t.equal(await store.setting('head'), 'abc');
    const connection = await store.setting('connection');
    const iv = new Uint8Array(12);
    const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, connection.key, new Uint8Array([1, 2, 3]));
    t.equal([...new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, sealed))], [1, 2, 3], 'the kept key still works');
    t.equal(connection.key.extractable, false);
    await store.setSetting('head', undefined);
    t.equal(await store.setting('head'), undefined);

    await store.forgetSync();
    t.equal(await store.setting('connection'), undefined);
    t.equal(await store.bases(), []);
    t.equal(await store.list(), [recipe]);
  },
};
