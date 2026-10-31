import { expect, test } from './fixtures.js';

test('opens on the recipe list, empty at first', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
  await expect(page.getByText('This device only')).toBeVisible();
});

/** @param {import('@playwright/test').Locator} image */
const loadedFile = (image) => image.evaluate((img) => {
  const element = /** @type {HTMLImageElement} */ (img);
  return element.naturalWidth > 0 ? element.currentSrc.split('/').pop() : 'not loaded';
});

test('the header logo carries the name, in a light and a dark version', async ({ page }) => {
  await page.goto('/');
  const heading = page.getByRole('heading', { level: 1, name: 'Mirepoix' });
  await expect(heading).toBeVisible();
  await expect.poll(() => loadedFile(heading.getByRole('img'))).toBe('logo-horizontal.svg');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => loadedFile(heading.getByRole('img'))).toBe('logo-horizontal-dark.svg');
});

test('the empty list shows the mark', async ({ page }) => {
  await page.goto('/');
  const mark = page.locator('.empty img.logo');
  await expect(mark).toHaveAttribute('alt', '');
  await expect.poll(() => loadedFile(mark)).toBe('icon.svg');
});

test('no font is ever downloaded: system fonts only (D13)', async ({ page }) => {
  /** @type {string[]} */
  const fonts = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') fonts.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Mirepoix' })).toBeVisible();
  expect(await page.evaluate(() => document.fonts.size)).toBe(0);
  expect(fonts).toEqual([]);
});

test('no screen lets its content touch the edge of the window', async ({ page }) => {
  await page.goto('/');
  const id = await page.evaluate(async () => {
    const { openLocalStore } = await import('/store/local-store.js');
    const { newRecipe } = await import('/domain/recipe.js');
    const recipe = newRecipe({ title: 'Feijoada' });
    await (await openLocalStore()).put(recipe);
    return recipe.id;
  });
  for (const address of ['/', '/#/new', `/#/recipes/${id}`, `/#/recipes/${id}/edit`, `/#/recipes/${id}/cook`, '/#/backup', '/#/sync', '/#/nope']) {
    await page.goto(address);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    // Text, not rows: list rows run edge to edge on purpose, with their text inset.
    const text = 'main h1, main h2, main h3, main p, main label, main input, main textarea, main .title, main .amount, main .name';
    const lefts = await page.locator(text).evaluateAll(
      (elements) => elements.filter((el) => el.getClientRects().length > 0).map((el) => el.getBoundingClientRect().left));
    expect(Math.min(...lefts), address).toBeGreaterThanOrEqual(12);
  }
});

test('unknown addresses say so and lead back to the recipes', async ({ page }) => {
  await page.goto('/#/no-such-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Recipes' }).click();
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
});

test('reopens offline after the first visit', async ({ page, context }) => {
  await page.goto('/?sw');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
});

test('the home-screen icons and the manifest load', async ({ page }) => {
  await page.goto('/');
  const responses = await page.evaluate(async () => {
    /** @param {string} rel */
    const linked = (rel) => new URL(document.querySelector(`link[rel="${rel}"]`)?.getAttribute('href') ?? '', location.href);
    const manifestUrl = linked('manifest');
    const manifest = await (await fetch(manifestUrl)).json();
    const urls = [
      ...manifest.icons.map((/** @type {{ src: string }} */ icon) => new URL(icon.src, manifestUrl)),
      linked('apple-touch-icon'),
      linked('icon'),
    ];
    return Promise.all(urls.map(async (url) => {
      const response = await fetch(url);
      return `${response.status} ${response.headers.get('content-type')}`;
    }));
  });
  expect(responses).toHaveLength(5);
  for (const response of responses) expect(response).toMatch(/^200 image\/(png|svg\+xml)$/);
});

test('Chromium reads the manifest without errors', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'uses the Chrome DevTools Protocol');
  await page.goto('/');
  const cdp = await page.context().newCDPSession(page);
  const { errors, manifest } = await cdp.send('Page.getAppManifest');
  expect(errors).toEqual([]);
  expect(manifest?.name).toBe('Mirepoix');
  expect(manifest?.display).toMatch(/standalone/i); // Chromium reports "kStandalone"
  expect(manifest?.icons).toHaveLength(3);
});

test('the footer has a Ko-fi link, and nothing loads from Ko-fi until it is followed (R2.0.1, D16)', async ({ page }) => {
  /** @type {string[]} */
  const kofi = [];
  page.on('request', (request) => {
    if (/ko-fi/.test(request.url())) kofi.push(request.url());
  });
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Support Mirepoix on Ko-fi' });
  await expect(link).toHaveAttribute('href', /^https:\/\/ko-fi\.com\/\w+$/);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener');
  await page.goto('/#/backup');
  await expect(page.getByRole('link', { name: 'Support Mirepoix on Ko-fi' })).toBeVisible();
  expect(kofi).toEqual([]);
});
