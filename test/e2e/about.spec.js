import { expect, test } from './fixtures.js';

// The website (D20): two languages that lead to each other and to the app,
// a "Try a line" box that reads with the app's own reader, and a service
// worker that leaves the website alone.

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
const reading = (page) => page.getByRole('region', { name: /^(How Mirepoix reads it|Como o Mirepoix lê)$/ });

test('the website reads in English and Portuguese, and leads to the app', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('From the page to the pan.');
  await expect(page).toHaveTitle('Mirepoix · A private recipe box');

  await page.getByRole('banner').getByRole('link', { name: 'Português' }).click();
  await expect(page).toHaveURL(/\/about\/index\.pt\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Do caderno para a panela.');
  await expect(reading(page).getByRole('cell')).toHaveText(['2', 'xícarasou 280 g', 'farinha de trigo, peneirada']);

  await page.getByRole('banner').getByRole('link', { name: 'English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('From the page to the pan.');

  await page.getByRole('main').getByRole('link', { name: /^Open Mirepoix/ }).first().click();
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
});

test('every picture on the website loads, in light and in dark', async ({ page }) => {
  for (const colorScheme of /** @type {const} */ (['light', 'dark'])) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/about/');
    const images = page.locator('main img');
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((img) => /** @type {HTMLImageElement} */ (img).naturalWidth), { message: colorScheme }).toBeGreaterThan(0);
    }
    // The app's screens come in both themes; the icon on the drawn home screen is the same in both.
    const screens = page.locator('main img[src^="shots/"]');
    const dark = await screens.evaluateAll((all) => all.filter((img) => /** @type {HTMLImageElement} */ (img).currentSrc.includes('-dark-')).length);
    expect(dark).toBe(colorScheme === 'dark' ? await screens.count() : 0);
  }
});

test('"Try a line" reads ingredients with the app\'s own reader, in either language', async ({ page }) => {
  await page.goto('/about/');
  const box = page.getByLabel('An ingredient line');
  await expect(reading(page).getByRole('cell')).toHaveText(['1 ½', 'cupsor 300 g', 'light brown sugar, packed']);

  await box.fill('2 cups (437 g) butter, softened');
  await expect(reading(page).getByRole('cell')).toHaveText(['2', 'cupsor 437 g', 'butter, softened']);

  await box.fill('three eggs');
  await expect(reading(page).getByRole('cell')).toHaveText(['3', 'count', 'eggs']);

  // A Portuguese example switches the recipe's language, and a new unit is flagged.
  await page.getByRole('button', { name: '1 tablete de fermento biológico' }).click();
  await expect(box).toHaveValue('1 tablete de fermento biológico');
  await expect(page.getByRole('radio', { name: 'Português' })).toBeChecked();
  await expect(reading(page).getByText('1 to check')).toBeVisible();
  await expect(reading(page).getByRole('cell').nth(3)).toHaveText('New unit “tablete”. It’s kept as written, so check it’s right.');

  // Units show in the recipe's language (D9, D15): xícaras are cups in an English recipe.
  await box.fill('2 xícaras de farinha');
  await expect(reading(page).getByRole('cell')).toHaveText(['2', 'xícaras', 'farinha']);
  await expect(reading(page).getByText('1 to check')).toBeHidden();
  await page.getByRole('radio', { name: 'English' }).check();
  await expect(reading(page).getByRole('cell')).toHaveText(['2', 'cups', 'farinha']);

  await box.fill('');
  await expect(reading(page).getByRole('cell')).toHaveText('As you type, each ingredient shows here as quantity, unit and name.');
});

test('the Portuguese page words its reading in Portuguese', async ({ page }) => {
  await page.goto('/about/index.pt.html');
  await page.getByRole('button', { name: '1 tablete de fermento biológico' }).click();
  await expect(reading(page).getByText('1 para conferir')).toBeVisible();
  await page.getByLabel('Uma linha de ingrediente').fill('três ovos');
  await expect(reading(page).getByRole('cell')).toHaveText(['3', 'unidade', 'ovos']);
});

test('the app, once installed, leaves the website alone', async ({ page }) => {
  await page.goto('/?sw');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await page.goto('/about/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('From the page to the pan.');
  const kept = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (name) =>
    (await (await caches.open(name)).keys()).map((request) => request.url)))).flat());
  expect(kept.length).toBeGreaterThan(0);
  expect(kept.filter((url) => url.includes('/about/'))).toEqual([]);
});

/**
 * Puts a recipe straight into the device's store, so the box isn't empty.
 * @param {import('@playwright/test').Page} page
 */
async function oneRecipe(page) {
  await page.evaluate(async () => {
    const { openLocalStore } = await import('/store/local-store.js');
    const { newRecipe } = await import('/domain/recipe.js');
    await (await openLocalStore()).put(newRecipe({ title: 'Pão de queijo', lang: 'pt' }));
  });
  await page.reload();
}

/** The app's small print, at the bottom of a screen. @param {import('@playwright/test').Page} page */
const footer = (page) => page.locator('.app-footer');

test('the app leads to the website: from the empty recipe box, and always from the footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
  await expect(page.locator('.empty').getByText('New to Mirepoix?')).toBeVisible();
  await expect(footer(page).getByRole('link', { name: 'About', exact: true })).toHaveAttribute('href', 'about/');

  await page.getByRole('link', { name: 'See what it can do' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('From the page to the pan.');
  await page.getByRole('main').getByRole('link', { name: 'Open Mirepoix' }).first().click();
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();

  // With a recipe in the box, the newcomer's line is gone; the footer's link stays.
  await oneRecipe(page);
  await expect(page.getByRole('link', { name: /Pão de queijo/ })).toBeVisible();
  await expect(page.getByText('New to Mirepoix?')).toHaveCount(0);
  await expect(footer(page).getByRole('link', { name: 'About', exact: true })).toBeVisible();
  for (const screen of ['/#/backup', '/#/sync']) {
    await page.goto(screen);
    await expect(footer(page).getByRole('link', { name: 'About', exact: true }), screen).toHaveAttribute('href', 'about/');
  }
});

test.describe('in Portuguese', () => {
  test.use({ locale: 'pt-BR' });

  test('the app leads to the website in Portuguese', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.empty').getByText('Novo no Mirepoix?')).toBeVisible();
    await expect(footer(page).getByRole('link', { name: 'Sobre', exact: true })).toHaveAttribute('href', 'about/index.pt.html');
    await page.getByRole('link', { name: 'Veja o que ele sabe fazer' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Do caderno para a panela.');
  });
});
