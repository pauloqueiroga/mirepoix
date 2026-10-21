import { expect, test } from './fixtures.js';

/**
 * Collects console errors and page errors, including CSP violations.
 * @param {import('@playwright/test').Page} page
 */
function watchForErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** @type {string[]} */
let errors = [];
test.beforeEach(({ page }) => {
  errors = watchForErrors(page);
});
test.afterEach(() => {
  expect(errors, 'no console errors, including CSP violations').toEqual([]);
});

const PAO_DE_QUEIJO = [
  'Massa:',
  '500 g de polvilho azedo',
  '1 copo americano de leite',
  'pitada de sal',
  '2 xícaras (200 g) de queijo meia-cura ralado',
  '',
  'queijo parmesão a gosto',
].join('\n');

test('adds a recipe by pasting its ingredients', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'New recipe' }).click();
  await expect(page.getByRole('heading', { name: 'New recipe' })).toBeVisible();

  await page.getByLabel('Title').fill('Pão de queijo');
  await page.getByRole('radio', { name: 'Português' }).check();
  await page.getByLabel(/^Ingredients/).fill(PAO_DE_QUEIJO);

  const preview = page.getByRole('region', { name: 'How Mirepoix reads the ingredients' });
  const row = (/** @type {string} */ name) => preview.getByRole('row').filter({ hasText: name }).first();
  await expect(row('polvilho azedo').getByRole('cell')).toHaveText(['500', 'g', 'polvilho azedo']);
  await expect(row('leite').getByRole('cell')).toHaveText(['1', 'copo americano', 'leite']);
  await expect(row('meia-cura').getByRole('cell')).toHaveText(['2', 'xícarasor 200 g', 'queijo meia-cura ralado']);
  await expect(row('parmesão').getByRole('cell')).toHaveText(['–', '–', 'queijo parmesão, a gosto']);
  await expect(preview.getByRole('columnheader', { name: 'Massa' })).toBeVisible();
  await expect(preview.getByText('No amount was given, so it reads as 1.')).toBeVisible();
  await expect(preview.getByText('1 to check')).toBeVisible();

  await page.getByRole('button', { name: 'Save' }).click();
  const recipes = page.getByRole('list', { name: 'Recipes' }).getByRole('listitem');
  await expect(recipes).toHaveText(['Pão de queijo']);

  await page.reload();
  await expect(recipes).toHaveText(['Pão de queijo']);
  const [saved] = await page.evaluate(async () => {
    const { openLocalStore } = await import('/store/local-store.js');
    return (await openLocalStore()).list();
  });
  expect(saved).toMatchObject({ title: 'Pão de queijo', lang: 'pt' });
  expect(saved.ingredients).toEqual([{
    heading: 'Massa',
    items: [
      { quantity: '500', unit: 'g', name: 'polvilho azedo', note: '', alternatives: [] },
      { quantity: '1', unit: 'copo americano', name: 'leite', note: '', alternatives: [] },
      { quantity: '1', unit: 'pinch', name: 'sal', note: '', alternatives: [] },
      { quantity: '2', unit: 'cup', name: 'queijo meia-cura ralado', note: '', alternatives: [{ quantity: '200', unit: 'g' }] },
      { quantity: '', unit: '', name: 'queijo parmesão', note: 'a gosto', alternatives: [] },
    ],
  }]);
});

test('the preview follows the recipe language', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByLabel(/^Ingredients/).fill('1.500 g de farinha');
  const quantity = page.getByRole('region', { name: 'How Mirepoix reads the ingredients' }).getByRole('cell').first();
  await page.getByRole('radio', { name: 'English' }).check();
  await expect(quantity).toHaveText('1.5');
  await page.getByRole('radio', { name: 'Português' }).check();
  await expect(quantity).toHaveText('1500');
});

test('the preview reads numbers written as words', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('radio', { name: 'Português' }).check();
  await page.getByLabel(/^Ingredients/).fill('dois ovos\ntrês quartos de xícara de leite\nvinte e cinco gramas de fermento');
  const preview = page.getByRole('region', { name: 'How Mirepoix reads the ingredients' });
  const row = (/** @type {string} */ name) => preview.getByRole('row').filter({ hasText: name }).first();
  await expect(row('ovos').getByRole('cell')).toHaveText(['2', 'count', 'ovos']);
  await expect(row('leite').getByRole('cell')).toHaveText(['¾', 'xícara', 'leite']);
  await expect(row('fermento').getByRole('cell')).toHaveText(['25', 'g', 'fermento']);
});

test('says what is missing instead of saving', async ({ page }) => {
  await page.goto('/#/new');
  const alert = page.getByRole('alert');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(alert).toHaveText('Give the recipe a title.');

  await page.getByLabel('Title').fill('Cookies');
  await page.getByLabel(/^Ingredients/).fill('2 eggs\n2 cups');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(alert).toHaveText('Line 2 has no ingredient name.');
  await expect(page.getByRole('heading', { name: 'New recipe' })).toBeVisible();
});

test('cancel leaves at once when nothing was typed, and asks otherwise', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();

  await page.getByRole('link', { name: 'New recipe' }).click();
  await page.getByLabel('Title').fill('Half-typed');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('Title')).toHaveValue('Half-typed');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
});
