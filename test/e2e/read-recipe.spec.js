import { expect, test } from './fixtures.js';

/** @type {string[]} */
let errors = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(() => {
  expect(errors, 'no console errors, including CSP violations').toEqual([]);
});

/**
 * Stores a recipe straight into the device's store and returns its id.
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, unknown> & { title: string }} fields
 */
async function seed(page, fields) {
  return page.evaluate(async (recipe) => {
    const { openLocalStore } = await import('/store/local-store.js');
    const { newRecipe } = await import('/domain/recipe.js');
    const full = { ...newRecipe({ title: recipe.title, lang: recipe.lang === 'pt' ? 'pt' : 'en' }), ...recipe };
    await (await openLocalStore()).put(full);
    return full.id;
  }, fields);
}

test('a recipe added in the editor opens from the list, ready to read', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByLabel('Title').fill('Pão de queijo');
  await page.getByRole('radio', { name: 'Português' }).check();
  await page.getByLabel(/^Ingredients/).fill([
    'Massa:',
    '500 g de polvilho azedo',
    'pitada de sal',
    '2 xícaras (200 g) de queijo meia-cura ralado',
    'queijo parmesão a gosto',
  ].join('\n'));
  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('link', { name: 'Pão de queijo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pão de queijo' })).toBeVisible();
  await expect(page).toHaveTitle('Pão de queijo · Mirepoix');

  const massa = page.getByRole('list', { name: 'Massa' });
  await expect(page.getByRole('heading', { level: 3, name: 'Massa' })).toBeVisible();
  await expect(massa.getByRole('listitem')).toHaveCount(4);
  await expect(massa.locator('.amount')).toHaveText(['500 g', '1 pitada', '2 xícarasor 200 g', '']);
  await expect(massa.locator('.name')).toHaveText(['polvilho azedo', 'sal', 'queijo meia-cura ralado', 'queijo parmesão, a gosto']);
});

test('reading has nothing editable; only the Edit link leads to changes', async ({ page }) => {
  await page.goto('/');
  const id = await seed(page, {
    title: 'Brown butter cookies',
    ingredients: [{ heading: '', items: [{ quantity: '1', unit: 'cup', name: 'butter', note: 'browned', alternatives: [] }] }],
  });
  await page.goto(`/#/recipes/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Brown butter cookies' })).toBeVisible();
  await expect(page.locator('input, textarea, select, button, [contenteditable]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', `#/recipes/${id}/edit`);
  const address = page.url();
  await page.getByText('butter, browned').click();
  await page.getByRole('heading', { level: 1 }).click();
  expect(page.url()).toBe(address);
});

test('amounts line up, with equivalents, counts and to-taste lines', async ({ page }) => {
  await page.goto('/');
  const id = await seed(page, {
    title: 'Brown butter cookies',
    ingredients: [{
      heading: '',
      items: [
        { quantity: '1 1/2', unit: 'cup', name: 'light brown sugar', note: 'packed', alternatives: [{ quantity: '300', unit: 'g' }] },
        { quantity: '2', unit: 'count', name: 'large eggs', note: '', alternatives: [] },
        { quantity: '2-3', unit: 'clove', name: 'garlic', note: '', alternatives: [] },
        { quantity: '', unit: '', name: 'flaky salt', note: 'to taste', alternatives: [] },
      ],
    }],
  });
  await page.goto(`/#/recipes/${id}`);
  const list = page.getByRole('list', { name: 'Ingredients' });
  await expect(list.locator('.amount')).toHaveText(['1 ½ cupsor 300 g', '2', '2–3 cloves', '']);
  await expect(list.locator('.name')).toHaveText(['light brown sugar, packed', 'large eggs', 'garlic', 'flaky salt, to taste']);

  const [first, second] = await list.locator('.name').evaluateAll((names) => names.slice(0, 2).map((name) => name.getBoundingClientRect().left));
  expect(first).toBe(second);
});

test('names line up across groups', async ({ page }) => {
  await page.goto('/');
  const item = (/** @type {string} */ quantity, /** @type {string} */ unit, /** @type {string} */ name) => ({ quantity, unit, name, note: '', alternatives: [] });
  const id = await seed(page, {
    title: 'Pão de queijo',
    lang: 'pt',
    ingredients: [
      { heading: 'Massa', items: [item('1/2', 'copo americano', 'óleo'), item('2', 'count', 'ovos')] },
      { heading: 'Para finalizar', items: [item('1', 'drizzle', 'azeite')] },
    ],
  });
  await page.goto(`/#/recipes/${id}`);
  const lefts = await page.locator('.ingredients .name').evaluateAll((names) => names.map((name) => Math.round(name.getBoundingClientRect().left)));
  expect(new Set(lefts).size).toBe(1);
});

test('a recipe with no ingredients says so', async ({ page }) => {
  await page.goto('/');
  const id = await seed(page, { title: 'Ideas for Sunday' });
  await page.goto(`/#/recipes/${id}`);
  await expect(page.getByText('No ingredients yet.')).toBeVisible();
});

test('a recipe address opens directly, survives a reload, and leads back', async ({ page }) => {
  await page.goto('/');
  const id = await seed(page, { title: 'Feijoada', lang: 'pt' });
  await page.goto(`/#/recipes/${id}`);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Feijoada' })).toBeVisible();
  await page.getByRole('link', { name: 'Recipes' }).click();
  await expect(page.getByRole('link', { name: 'Feijoada' })).toBeVisible();
  await expect(page).toHaveTitle('Mirepoix');
});

test('an unknown recipe address says so', async ({ page }) => {
  await page.goto('/#/recipes/no-such-recipe');
  await expect(page.getByRole('heading', { name: 'Recipe not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Recipes' }).click();
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
});
