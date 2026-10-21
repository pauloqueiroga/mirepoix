import { expect, test } from './fixtures.js';

// Privacy page (R1.13), opt-in Google Analytics (R1.14, D14) and the public
// pages' description for search engines and link previews (R1.15). Google's
// script is replaced by a stand-in here: tests never talk to Google.

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
 * Turns analytics on with a test Measurement ID and records every request
 * meant for Google.
 * @param {import('@playwright/test').Page} page
 */
async function withAnalytics(page) {
  /** @type {string[]} */
  const google = [];
  await page.route('**/config.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: "export const ANALYTICS_ID = 'G-TEST12345';" }));
  await page.route(/googletagmanager\.com|google-analytics\.com/, (route) => {
    google.push(route.request().url());
    return route.fulfill({ contentType: 'text/javascript', body: 'window.gtagStandIn = true;' });
  });
  return google;
}

/** Everything the app queued for Google, as plain lists. @param {import('@playwright/test').Page} page */
const queued = (page) => page.evaluate(() => {
  const layer = /** @type {{ dataLayer?: ArrayLike<unknown>[] }} */ (/** @type {unknown} */ (window)).dataLayer ?? [];
  return layer.map((args) => Array.from(args));
});
/** @param {unknown[][]} calls */
const pageViews = (calls) => calls.filter((call) => call[0] === 'event' && call[1] === 'page_view')
  .map((call) => /** @type {{ page_title: string }} */ (call[2]).page_title);

const banner = (/** @type {import('@playwright/test').Page} */ page) => page.getByRole('complementary', { name: 'Usage statistics' });

test('the privacy page is linked from the app and says what is kept and sent', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Privacy' }).click();
  await expect(page).toHaveTitle('Privacy · Mirepoix');
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
  await expect(page.getByText('your recipes stay with you')).toBeVisible();
  await expect(page.getByText('Nothing about your recipes, to anyone.')).toBeVisible();
  await expect(page.getByText('Usage statistics are switched off on this site, so nothing is sent.')).toBeVisible();
  await page.getByRole('link', { name: 'Recipes' }).click();
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
});

test('the shipped settings ask first, and nothing reaches Google before a yes', async ({ page, context }) => {
  await context.unroute('**/config.js'); // the real app/config.js, with the real ID
  /** @type {string[]} */
  const google = [];
  await page.route(/googletagmanager\.com|google-analytics\.com/, (route) => {
    google.push(route.request().url());
    return route.fulfill({ contentType: 'text/javascript', body: '' });
  });
  await page.goto('/');
  await expect(banner(page)).toBeVisible();
  expect(google).toEqual([]);
  await banner(page).getByRole('button', { name: 'Allow' }).click();
  await expect.poll(() => google.some((url) => url.includes('gtag/js?id=G-'))).toBe(true);
});

test('without a Measurement ID nothing asks and nothing loads', async ({ page }) => {
  /** @type {string[]} */
  const google = [];
  page.on('request', (request) => {
    if (/google/.test(new URL(request.url()).hostname)) google.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  expect(google).toEqual([]);
});

test('with an ID, a visitor is asked once, and "No thanks" means nothing loads', async ({ page }) => {
  const google = await withAnalytics(page);
  await page.goto('/');
  await expect(banner(page)).toBeVisible();
  expect(google, 'nothing before an answer').toEqual([]);

  await banner(page).getByRole('button', { name: 'No thanks' }).click();
  await expect(banner(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  expect(google).toEqual([]);
  expect(await queued(page)).toEqual([]);
});

test('"Allow" loads Google Analytics, which only ever hears screen names', async ({ page }) => {
  const google = await withAnalytics(page);
  await page.goto('/');
  const id = await page.evaluate(async () => {
    const { openLocalStore } = await import('/store/local-store.js');
    const { newRecipe } = await import('/domain/recipe.js');
    const recipe = {
      ...newRecipe({ title: 'Pão de queijo', lang: 'pt' }),
      ingredients: [{ heading: '', items: [{ quantity: '500', unit: 'g', name: 'polvilho azedo', note: '', alternatives: [] }] }],
    };
    await (await openLocalStore()).put(recipe);
    return recipe.id;
  });
  await page.reload();
  await banner(page).getByRole('button', { name: 'Allow' }).click();
  await expect.poll(() => google.some((url) => url.includes('gtag/js?id=G-TEST12345'))).toBe(true);

  await page.getByRole('searchbox', { name: 'Search recipes' }).fill('polvilho');
  await page.getByRole('link', { name: /Pão de queijo/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pão de queijo' })).toBeVisible();
  await expect(page, 'no recipe title in the tab while analytics is on').toHaveTitle('Recipe · Mirepoix');

  const calls = await queued(page);
  const config = calls.find((call) => call[0] === 'config');
  expect(config?.[1]).toBe('G-TEST12345');
  expect(config?.[2]).toMatchObject({ send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  expect(pageViews(calls)).toEqual(['recipes', 'recipe']);
  const everything = JSON.stringify(calls);
  for (const secret of ['Pão', 'queijo', 'polvilho', id]) expect(everything).not.toContain(secret);

  // Next visit: no question, and statistics start straight away.
  google.length = 0;
  await page.goto('/');
  await expect(page.getByRole('searchbox')).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  await expect.poll(() => google.length).toBeGreaterThan(0);
});

test('the privacy page shows your choice and lets you change it', async ({ page, context }) => {
  await withAnalytics(page);
  await page.goto('/');
  await banner(page).getByRole('button', { name: 'Allow' }).click();
  await context.addCookies([{ name: '_ga', value: 'GA1.1.123.456', url: test.info().project.use.baseURL ?? '' }]);

  await page.goto('/privacy.html');
  await expect(page.getByText('On this device, you allow usage statistics.')).toBeVisible();
  await page.getByRole('button', { name: 'Stop sharing usage statistics' }).click();
  await expect(page.getByText('On this device, usage statistics are not allowed, so nothing is sent.')).toBeVisible();
  expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain('_ga');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

test('the front door describes itself for search engines and link previews', async ({ page, request }) => {
  await page.goto('/');
  const meta = (/** @type {string} */ selector) => page.locator(selector).getAttribute('content');
  expect((await meta('meta[name="description"]'))?.length).toBeGreaterThan(80);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://pauloq.com/mirepoix/');
  expect(await meta('meta[property="og:title"]')).toBe('Mirepoix, a private recipe box');
  expect(await meta('meta[property="og:image"]')).toBe('https://pauloq.com/mirepoix/icons/social.png');
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  const structured = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '{}');
  expect(structured).toMatchObject({ '@type': 'WebApplication', name: 'Mirepoix', url: 'https://pauloq.com/mirepoix/' });

  const image = await request.get('/icons/social.png');
  expect(image.headers()['content-type']).toBe('image/png');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.headers()['content-type']).toMatch(/xml/);
  expect(await sitemap.text()).toContain('<loc>https://pauloq.com/mirepoix/privacy.html</loc>');
  expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap: https://pauloq.com/mirepoix/sitemap.xml');
});
