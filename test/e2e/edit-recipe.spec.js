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

/** @param {import('@playwright/test').Page} page */
const stored = (page) => page.evaluate(async () => {
  const { openLocalStore } = await import('/store/local-store.js');
  return (await openLocalStore()).list();
});

/**
 * Adds a recipe through the editor, the way a person would, and opens it.
 * @param {import('@playwright/test').Page} page
 */
async function addPaoDeQueijo(page) {
  await page.goto('/#/new');
  await page.getByLabel('Title').fill('Pão de queijo');
  await page.getByRole('radio', { name: 'Português' }).check();
  await page.getByLabel('Source').fill('Family notebook');
  await page.getByLabel(/^Ingredients/).fill('Massa:\n500 g de polvilho azedo\n2 xícaras (200 g) de queijo meia-cura ralado\n3 | | ovos de codorna\nsal a gosto');
  await page.getByLabel('Preparation', { exact: true }).fill('Ferva o leite.\n\nEscalde o polvilho.');
  await page.getByText('Notes', { exact: true }).click();
  await page.getByLabel('Notes').fill('Congela bem.');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: /Pão de queijo/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pão de queijo' })).toBeVisible();
}

test('Edit opens the recipe in the editor, filled in, and saving shows the change', async ({ page }) => {
  await addPaoDeQueijo(page);
  await page.getByRole('link', { name: 'Edit' }).click();

  await expect(page.getByRole('heading', { name: 'Edit recipe' })).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('Pão de queijo');
  await expect(page.getByRole('radio', { name: 'Português' })).toBeChecked();
  await expect(page.getByLabel('Source')).toHaveValue('Family notebook');
  await expect(page.getByLabel(/^Ingredients/)).toHaveValue(
    'Massa:\n500 g de polvilho azedo\n2 xícaras (200 g) de queijo meia-cura ralado\n3 |  | ovos de codorna\nsal, a gosto');
  await expect(page.getByLabel('Notes')).toHaveValue('Congela bem.');
  const preview = page.getByRole('region', { name: 'How Mirepoix reads the ingredients' });
  await expect(preview.getByRole('row').filter({ hasText: 'polvilho azedo' }).getByRole('cell')).toHaveText(['500', 'g', 'polvilho azedo']);
  await expect(page.getByRole('region', { name: 'How Mirepoix reads the preparation' }).getByRole('listitem'))
    .toHaveText(['Ferva o leite.', 'Escalde o polvilho.']);

  await page.getByLabel('Title').fill('Pão de queijo mineiro');
  await page.getByLabel(/^Ingredients/).fill('Massa:\n1 kg de polvilho azedo');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Pão de queijo mineiro' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Massa' }).locator('.amount')).toHaveText(['1 kg']);
  await page.getByRole('link', { name: 'Recipes' }).click();
  await expect(page.getByRole('list', { name: 'Recipes' }).getByRole('listitem')).toHaveText(['Pão de queijo mineiroFamily notebook']);
  expect(await stored(page)).toHaveLength(1);
});

test('saving without changes leaves the recipe exactly as it was, apart from its update time', async ({ page }) => {
  await addPaoDeQueijo(page);
  const [before] = await stored(page);
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pão de queijo' })).toBeVisible();
  const [after] = await stored(page);
  expect({ ...after, updatedAt: '' }).toEqual({ ...before, updatedAt: '' });
  expect(after.updatedAt >= before.updatedAt).toBe(true);
});

test('leaving the editor with unsaved changes asks first, by any way out', async ({ page }) => {
  await addPaoDeQueijo(page);
  await page.getByRole('link', { name: 'Edit' }).click();
  const title = page.getByLabel('Title');

  // Untouched: back leaves straight away.
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Pão de queijo' })).toBeVisible();
  await page.getByRole('link', { name: 'Edit' }).click();
  await title.fill('Changed my mind');

  /** @type {string[]} */
  const asked = [];
  page.on('dialog', (dialog) => {
    asked.push(`${dialog.type()}: ${dialog.message()}`);
    void (asked.length === 1 ? dialog.dismiss() : dialog.accept());
  });

  // The back button: the first time we stay, the second time we go.
  await page.goBack();
  await expect(title).toHaveValue('Changed my mind');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Pão de queijo' })).toBeVisible();
  expect(asked).toEqual([
    'confirm: Leave without saving? Your changes will be lost.',
    'confirm: Leave without saving? Your changes will be lost.',
  ]);
});

test('Cancel asks before discarding changes to a recipe', async ({ page }) => {
  await addPaoDeQueijo(page);
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Source').fill('Somewhere else');
  page.once('dialog', (dialog) => {
    expect(dialog.message()).toBe('Discard your changes?');
    void dialog.accept();
  });
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Family notebook')).toBeVisible();
});

test('closing or reloading the tab with unsaved changes asks first', async ({ page }) => {
  await addPaoDeQueijo(page);
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Title').fill('Changed my mind');
  const prompt = page.waitForEvent('dialog');
  void page.close({ runBeforeUnload: true });
  const dialog = await prompt;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
});

test('Delete is in the editor and asks first', async ({ page }) => {
  await addPaoDeQueijo(page);
  const address = page.url();
  await page.getByRole('link', { name: 'Edit' }).click();

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toBe('Delete “Pão de queijo”? This can’t be undone.');
    void dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Delete recipe' }).click();
  await expect(page.getByRole('heading', { name: 'Edit recipe' })).toBeVisible();
  expect(await stored(page)).toHaveLength(1);

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Delete recipe' }).click();
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
  expect(await stored(page)).toHaveLength(0);
  await page.goto(address);
  await expect(page.getByRole('heading', { name: 'Recipe not found' })).toBeVisible();
});

test('a new recipe has no Delete button', async ({ page }) => {
  await page.goto('/#/new');
  await expect(page.getByRole('heading', { name: 'New recipe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete recipe' })).toHaveCount(0);
});
