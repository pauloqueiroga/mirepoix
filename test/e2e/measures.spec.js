// R5 · Your measures: more ways to write equivalents (R5.1), and units of
// your own, known once a recipe uses them (R5.2).
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
 * @param {import('@playwright/test').Page} page
 * @param {{ title: string, pt?: boolean, ingredients: string }} recipe
 */
async function startRecipe(page, { title, pt = false, ingredients }) {
  await page.goto('/#/new');
  await page.getByLabel('Title').fill(title);
  if (pt) await page.getByRole('radio', { name: 'Português' }).check();
  await page.getByLabel(/^Ingredients/).fill(ingredients);
  return page.getByRole('region', { name: 'How Mirepoix reads the ingredients' });
}

test('equivalents written with a slash or "or" read as equivalents, not as names (R5.1)', async ({ page }) => {
  const preview = await startRecipe(page, {
    title: 'Brown butter cookies',
    ingredients: '2 cups / 437 g unsalted butter\n2 1/4 cups flour or 280 g\n2 tbsp oil or butter',
  });
  const row = (/** @type {string} */ name) => preview.getByRole('row').filter({ hasText: name }).first();
  await expect(row('unsalted butter').getByRole('cell')).toHaveText(['2', 'cupsor 437 g', 'unsalted butter']);
  await expect(row('flour').getByRole('cell')).toHaveText(['2 ¼', 'cupsor 280 g', 'flour']);
  await expect(row('oil or butter').getByRole('cell')).toHaveText(['2', 'tbsp', 'oil or butter']);

  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: 'Brown butter cookies' }).click();
  await expect(page.getByRole('list', { name: 'Ingredients' }).getByRole('listitem').first()).toHaveText('2 cupsor 437 gunsalted butter');
});

test('a new unit is flagged once, and known in every recipe after it is saved (R5.2)', async ({ page }) => {
  let preview = await startRecipe(page, { title: 'Pão caseiro', pt: true, ingredients: '1 tablete de fermento biológico' });
  await expect(preview.getByText('New unit “tablete”.')).toBeVisible();
  await expect(preview.getByText('1 to check')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('list', { name: 'Recipes' }).getByRole('listitem')).toHaveText(['Pão caseiro']);

  preview = await startRecipe(page, { title: 'Pizza', pt: true, ingredients: '2 tabletes de fermento\n15 g (1 tablete) de fermento' });
  const row = (/** @type {number} */ n) => preview.getByRole('row').nth(n);
  await expect(row(1).getByRole('cell')).toHaveText(['2', 'tabletes', 'fermento']);
  await expect(row(2).getByRole('cell')).toHaveText(['15', 'gor 1 tablete', 'fermento']);
  await expect(preview.getByText(/to check/)).toHaveCount(0);
  await expect(preview.getByText(/New unit/)).toHaveCount(0);
});
