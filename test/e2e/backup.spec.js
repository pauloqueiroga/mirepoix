import { readFile } from 'node:fs/promises';
import { expect, test, withoutAnalytics } from './fixtures.js';

/** @type {string[]} */
let errors = [];
/** @param {import('@playwright/test').Page} page */
function watch(page) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
}
test.beforeEach(({ page }) => {
  errors = [];
  watch(page);
});
test.afterEach(() => {
  expect(errors, 'no console errors, including CSP violations').toEqual([]);
});

/**
 * Puts recipes straight into a device's store.
 * @param {import('@playwright/test').Page} page
 * @param {string[]} titles
 */
async function seed(page, titles) {
  await page.goto('/');
  await page.evaluate(async (names) => {
    const { openLocalStore } = await import('/store/local-store.js');
    const { newRecipe } = await import('/domain/recipe.js');
    const store = await openLocalStore();
    for (const title of names) {
      await store.put({
        ...newRecipe({ title, lang: 'pt' }),
        ingredients: [{ heading: '', items: [{ quantity: '500', unit: 'g', name: 'polvilho azedo', note: '', alternatives: [] }] }],
      });
    }
  }, titles);
  await page.reload();
}

/** @param {import('@playwright/test').Page} page */
const stored = (page) => page.evaluate(async () => {
  const { openLocalStore } = await import('/store/local-store.js');
  return (await openLocalStore()).list();
});

/**
 * Exports from the Keep a copy screen and returns the file's name and text.
 * @param {import('@playwright/test').Page} page
 */
async function exportAll(page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all recipes' }).click();
  const file = await download;
  return { name: file.suggestedFilename(), text: await readFile(await file.path(), 'utf8') };
}

test('the "This device only" chip leads, past connecting, to Export, which saves every recipe in one file', async ({ page }) => {
  await seed(page, ['Feijoada', 'Pão de queijo']);
  await page.getByRole('link', { name: 'This device only' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Connect this device' })).toBeVisible();
  await page.getByRole('link', { name: 'Export or import a copy' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Keep a copy' })).toBeVisible();
  await expect(page.getByText('Saves all 2 recipes in one file.')).toBeVisible();

  const { name, text } = await exportAll(page);
  expect(name).toMatch(/^mirepoix-recipes-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(text);
  expect(data).toMatchObject({ format: 'mirepoix-recipes', version: 1 });
  const byId = (/** @type {{ id: string }} */ a, /** @type {{ id: string }} */ b) => a.id.localeCompare(b.id);
  expect(data.recipes.sort(byId)).toEqual((await stored(page)).sort(byId));
  await expect(page.getByRole('status')).toContainText(`Saved ${name}.`);
});

test('an export from one device imports into another, merging by id', async ({ page, browser }) => {
  await seed(page, ['Feijoada', 'Pão de queijo']);
  await page.goto('/#/backup');
  const { name, text } = await exportAll(page);

  const otherDevice = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  await withoutAnalytics(otherDevice);
  const other = await otherDevice.newPage();
  watch(other);
  await seed(other, ['Bolo de fubá']);
  await other.goto('/#/backup');
  const file = { name, mimeType: 'application/json', buffer: Buffer.from(text) };

  await other.getByLabel('Import from a file').setInputFiles(file);
  await expect(other.getByRole('status')).toHaveText('Added 2 recipes. See your recipes');
  await other.getByRole('link', { name: 'See your recipes' }).click();
  await expect(other.getByRole('list', { name: 'Recipes' }).getByRole('listitem').locator('.title'))
    .toHaveText(['Bolo de fubá', 'Feijoada', 'Pão de queijo']);

  // Importing the same file again changes nothing.
  await other.goto('/#/backup');
  await other.getByLabel('Import from a file').setInputFiles(file);
  await expect(other.getByRole('status')).toHaveText('Nothing new to add. 2 were already here. See your recipes');
  expect(await stored(other)).toHaveLength(3);
  await otherDevice.close();
});

test('cook\'s notes made on two devices both survive an import, whichever copy was edited last (R3.3)', async ({ page, browser }) => {
  await seed(page, ['Pão de queijo']);
  const [{ id }] = await stored(page);
  /**
   * Writes a note in cook mode, the way a person would.
   * @param {import('@playwright/test').Page} device
   * @param {string} text
   */
  const writeNote = async (device, text) => {
    await device.goto(`/#/recipes/${id}/cook`);
    await device.getByRole('button', { name: 'Note for next time' }).click();
    await device.getByRole('textbox', { name: 'Your note' }).fill(text);
    await device.getByRole('button', { name: 'Save note' }).click();
    await expect(device.getByRole('status').filter({ hasText: 'Note saved.' })).toBeVisible();
  };
  await page.goto('/#/backup');
  const first = await exportAll(page);

  // A second device gets the recipe, edits it and cooks it.
  const otherDevice = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  await withoutAnalytics(otherDevice);
  const other = await otherDevice.newPage();
  watch(other);
  await other.goto('/#/backup');
  await other.getByLabel('Import from a file').setInputFiles({ name: first.name, mimeType: 'application/json', buffer: Buffer.from(first.text) });
  await expect(other.getByRole('status')).toHaveText('Added 1 recipe. See your recipes');
  await other.goto(`/#/recipes/${id}/edit`);
  await other.getByLabel('Title').fill('Pão de queijo mineiro');
  await other.getByRole('button', { name: 'Save' }).click();
  await expect(other.getByRole('heading', { level: 1, name: 'Pão de queijo mineiro' })).toBeVisible();
  await writeNote(other, 'Ficou ótimo com canastra.');

  // Meanwhile, this device cooks the older text and writes its own note.
  await writeNote(page, 'Usei 50 g a mais de polvilho.');

  await other.goto('/#/backup');
  const second = await exportAll(other);
  await page.goto('/#/backup');
  await page.getByLabel('Import from a file').setInputFiles({ name: second.name, mimeType: 'application/json', buffer: Buffer.from(second.text) });
  await expect(page.getByRole('status')).toHaveText('Updated 1. See your recipes');

  await page.goto(`/#/recipes/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Pão de queijo mineiro' }), 'the newer text').toBeVisible();
  await expect(page.getByRole('region', { name: 'Cook’s notes' }).getByRole('listitem').locator('p'))
    .toHaveText(['Usei 50 g a mais de polvilho.', 'Ficou ótimo com canastra.']);
  await otherDevice.close();
});

test('a file that is not an export is refused, and nothing changes', async ({ page }) => {
  await seed(page, ['Feijoada']);
  await page.goto('/#/backup');
  await page.getByLabel('Import from a file').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello": "world"}') });
  await expect(page.getByRole('status')).toHaveText('That file isn’t a Mirepoix export.');
  expect(await stored(page)).toHaveLength(1);
});

test('an empty recipe box offers to import, and has nothing to export', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Import it' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Keep a copy' })).toBeVisible();
  await expect(page.getByText('Nothing to export yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export all recipes' })).toHaveCount(0);
});
