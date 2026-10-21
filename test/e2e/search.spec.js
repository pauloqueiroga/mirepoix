import { expect, test } from '@playwright/test';

/** @type {string[]} */
let errors = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.evaluate(async () => {
    const { openLocalStore } = await import('/store/local-store.js');
    const { newRecipe } = await import('/domain/recipe.js');
    const store = await openLocalStore();
    /** @type {[string, string, string[]][]} */
    const recipes = [
      ['Angu', 'Family notebook', ['fubá', 'água', 'sal']],
      ['Bolo de fubá', 'Family notebook', ['fubá', 'açúcar', 'ovos']],
      ['Brown butter cookies', 'The Flour Diaries', ['butter', 'brown sugar', 'eggs']],
      ['Pão de queijo', 'Family notebook', ['polvilho azedo', 'queijo meia-cura', 'ovos']],
      ['Torta de frango', '', ['frango', 'polvilho azedo', 'requeijão']],
    ];
    for (const [title, source, names] of recipes) {
      await store.put({
        ...newRecipe({ title, lang: 'pt' }),
        source,
        ingredients: [{ heading: '', items: names.map((name) => ({ quantity: '1', unit: 'count', name, note: '', alternatives: [] })) }],
      });
    }
  });
  await page.reload();
});
test.afterEach(() => {
  expect(errors, 'no console errors, including CSP violations').toEqual([]);
});

/** @param {import('@playwright/test').Page} page */
const titles = (page) => page.getByRole('list', { name: 'Recipes' }).getByRole('listitem').locator('.title');

test('typing filters the list as you go, ignoring case and accents', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Search recipes' });
  await expect(page.getByText('5 recipes')).toBeVisible();

  await search.fill('pao');
  await expect(titles(page)).toHaveText(['Pão de queijo']);
  await expect(page.getByText('1 of 5 recipes')).toBeVisible();
  await expect(search).toBeFocused();

  await search.fill('PÃO');
  await expect(titles(page)).toHaveText(['Pão de queijo']);

  await search.fill('');
  await expect(titles(page)).toHaveCount(5);
});

test('ingredients count too, and each result says which one matched', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Search recipes' });
  await search.fill('polvilho');
  const items = page.getByRole('list', { name: 'Recipes' }).getByRole('listitem');
  await expect(items).toHaveText(['Pão de queijowith polvilho azedo', 'Torta de frangowith polvilho azedo']);

  await search.fill('acucar');
  await expect(items).toHaveText(['Bolo de fubáwith açúcar']);
});

test('every word must match, and title matches come first', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Search recipes' });
  await search.fill('polvilho frango');
  await expect(titles(page)).toHaveText(['Torta de frango']);
  await search.fill('fuba');
  await expect(titles(page)).toHaveText(['Bolo de fubá', 'Angu']);
});

test('no match says so', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search recipes' }).fill('lasanha');
  await expect(page.getByRole('heading', { name: 'No matches' })).toBeVisible();
  await expect(page.getByText('No title or ingredient matches “lasanha”.')).toBeVisible();
  await expect(page.getByText('0 of 5 recipes')).toBeVisible();
});

test('the search is still there after opening a recipe and coming back', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search recipes' }).fill('ovos');
  await expect(page).toHaveURL(/#\/\?q=ovos$/);
  await page.getByRole('link', { name: /Pão de queijo/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pão de queijo' })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('searchbox', { name: 'Search recipes' })).toHaveValue('ovos');
  await expect(titles(page)).toHaveText(['Bolo de fubá', 'Pão de queijo']);
});

test('an empty recipe box has no search box', async ({ page }) => {
  await page.evaluate(async () => {
    const { openLocalStore } = await import('/store/local-store.js');
    const store = await openLocalStore();
    for (const recipe of await store.list()) await store.remove(recipe.id);
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
  await expect(page.getByRole('searchbox')).toHaveCount(0);
});
