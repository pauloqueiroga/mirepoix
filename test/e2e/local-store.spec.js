import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures.js';
import { scenarios } from '../contract/recipe-store.js';

const contract = fileURLToPath(new URL('../contract/recipe-store.js', import.meta.url));

test.describe('IndexedDB store keeps the recipe-store contract', () => {
  test.beforeEach(async ({ page }) => {
    // Serve the contract from the app's origin so the page's CSP allows importing it.
    await page.route('**/__contract__/recipe-store.js', (route) =>
      route.fulfill({ path: contract, contentType: 'text/javascript; charset=utf-8' }));
    await page.goto('/');
  });

  for (const name of Object.keys(scenarios)) {
    test(name, async ({ page }) => {
      await page.evaluate(async (scenario) => {
        const { scenarios, tools } = await import('/__contract__/recipe-store.js');
        const { openLocalStore } = await import('/store/local-store.js');
        const { newRecipe } = await import('/domain/recipe.js');
        const { fingerprint } = await import('/domain/fingerprint.js');
        const store = await openLocalStore({ name: `contract-${crypto.randomUUID()}` });
        await scenarios[scenario](store, tools(newRecipe, fingerprint));
      }, name);
    });
  }
});

test('recipes survive a reload and are listed by title', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { openLocalStore } = await import('/store/local-store.js');
    const { newRecipe } = await import('/domain/recipe.js');
    const store = await openLocalStore();
    for (const [title, source] of [['Shakshuka', 'Weeknight Pan, p. 41'], ['pão de queijo', 'Family notebook'], ['Bolo de fubá', '']]) {
      await store.put({ ...newRecipe({ title, lang: 'pt' }), source });
    }
  });
  await page.reload();
  const rows = page.getByRole('list', { name: 'Recipes' }).getByRole('listitem');
  await expect(rows).toHaveText(['Bolo de fubá', 'pão de queijoFamily notebook', 'ShakshukaWeeknight Pan, p. 41']);
});

test('says so plainly when the browser refuses storage', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      value: { open() { throw new DOMException('blocked', 'SecurityError'); } },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'This browser can’t keep recipes' })).toBeVisible();
});

test('an R1 device\'s recipes survive the upgrade to the store that syncing needs (R2.3)', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { newRecipe } = await import('/domain/recipe.js');
    const name = `upgrade-${crypto.randomUUID()}`;
    const recipe = newRecipe({ title: 'Bolo de fubá', lang: 'pt' });
    // The R1 store, exactly as R1 made it: version 1, one object store.
    await new Promise((resolve, reject) => {
      const opening = indexedDB.open(name, 1);
      opening.onupgradeneeded = () => opening.result.createObjectStore('recipes', { keyPath: 'id' });
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const tx = db.transaction('recipes', 'readwrite');
        tx.objectStore('recipes').put(recipe);
        tx.oncomplete = () => {
          db.close();
          resolve(undefined);
        };
      };
    });
    const { openLocalStore } = await import('/store/local-store.js');
    const store = await openLocalStore({ name });
    return { kept: await store.list(), bases: await store.bases(), connection: await store.setting('connection'), recipe };
  });
  expect(result.kept).toEqual([result.recipe]);
  expect(result.bases).toEqual([]);
  expect(result.connection).toBeUndefined();
});
