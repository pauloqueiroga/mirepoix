// Screenshots of the real app for the website (D20): the sample recipe box
// (tools/sample-recipes.js) on a phone-sized screen, in English and Portuguese,
// light and dark. Run it after the app's looks change: npm run screenshots.
// It serves app/ itself, so nothing else needs to be running.
//
// Syncing goes to the stand-in for GitHub that the tests use, so the screens
// show a connected device without touching real GitHub (D12). Screens look the
// way this computer draws them: run it on a Mac for Apple's fonts.
//
// Uses Playwright's Chromium; set CHROMIUM_PATH to use another Chrome binary.
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createFakeGitHub } from '../test/support/fake-github.js';
import { BOX, SCENES } from './sample-recipes.js';
import { createDevServer } from './serve.js';

/** @typedef {import('@playwright/test').Page} Page */
/** @typedef {'en' | 'pt'} Lang */

const OUT = fileURLToPath(new URL('../app/about/shots/', import.meta.url));
const LANGS = /** @type {const} */ (['en', 'pt']);
const THEMES = /** @type {const} */ (['light', 'dark']);
/** Every screen the website shows, in the order they're taken. */
const SHOTS = /** @type {const} */ (['list', 'search', 'recipe', 'cook', 'note', 'editor', 'sync', 'backup']);

const REPO = 'you/mirepoix-data';
const TOKEN = 'sample-token';
const LOCALES = { en: 'en-US', pt: 'pt-BR' };

/** @param {Lang} lang @param {string} theme @param {string} shot */
const shotName = (lang, theme, shot) => `${lang}-${theme}-${shot}.png`;

// The Wake Lock API needs a visible screen, which a headless browser hasn't
// got. On a phone, cook mode holds the lock and shows "Screen on"; this lets
// the screenshot show the same.
function grantWakeLock() {
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: async () => Object.assign(new EventTarget(), { type: 'screen', released: false, release: async () => {} }),
    },
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const server = createDevServer();
  await new Promise((done) => server.listen(0, '127.0.0.1', () => done(undefined)));
  const address = server.address();
  if (!address || typeof address !== 'object') throw new Error('The dev server has no port.');
  const origin = `http://localhost:${address.port}`;
  const config = (await readFile(new URL('../app/config.js', import.meta.url), 'utf8'))
    .replace(/ANALYTICS_ID = '[^']*'/, "ANALYTICS_ID = ''");

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    for (const lang of LANGS) {
      for (const theme of THEMES) {
        const github = createFakeGitHub();
        github.addRepo(REPO);
        github.addToken(TOKEN, [REPO]);
        const context = await browser.newContext({
          baseURL: origin,
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
          locale: LOCALES[lang],
          timezoneId: 'America/Sao_Paulo',
          colorScheme: theme,
          reducedMotion: 'reduce',
        });
        await context.route('**/config.js', (route) => route.fulfill({ contentType: 'text/javascript', body: config }));
        await context.route('https://api.github.com/**', github.route);
        await context.addInitScript(grantWakeLock);
        const page = await context.newPage();
        // The same evening every time, so taking them again changes only what changed.
        await page.clock.setFixedTime(new Date('2026-11-01T22:05:00Z'));
        page.on('pageerror', (error) => console.error(`${lang} ${theme}: ${error.message}`));
        // Leaving the note half-written asks first; the answer is yes.
        page.on('dialog', (dialog) => void dialog.accept());
        await shoot(page, lang, theme);
        await context.close();
        console.log(`${lang} ${theme}: ${SHOTS.length} screens`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

/**
 * @param {Page} page
 * @param {Lang} lang
 * @param {string} theme
 */
async function shoot(page, lang, theme) {
  const scene = SCENES[lang];
  /** @param {typeof SHOTS[number]} shot */
  const snap = async (shot) => {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${OUT}${shotName(lang, theme, shot)}` });
  };

  await page.goto('/');
  const featured = await page.evaluate(async ({ box, title, repository, token }) => {
    const { openLocalStore } = await import('/store/local-store.js');
    const { readDraft } = await import('/domain/draft.js');
    const { addCooksNote } = await import('/domain/cooks-notes.js');
    const { connect } = await import('/store/sync.js');
    const store = await openLocalStore();
    let id = '';
    for (const { cooksNotes = [], ...draft } of box) {
      let { recipe } = readDraft(draft, { now: new Date('2026-09-01T12:00:00Z') });
      if (!recipe) throw new Error(`The sample “${draft.title}” doesn't read as a recipe.`);
      for (const note of cooksNotes) recipe = addCooksNote(recipe, note.text, { now: new Date(note.at) });
      await store.put(recipe);
      if (recipe.title === title) id = recipe.id;
    }
    await connect({ store, mode: 'fresh', repository, token, passphrase: 'sample passphrase', device: 'iPhone', fetch: (...args) => fetch(...args), iterations: 1000 });
    return id;
  }, { box: BOX, title: scene.featured, repository: REPO, token: TOKEN });
  if (!featured) throw new Error(`No sample recipe is called “${scene.featured}”.`);

  // The list, once everything has gone up and the chip says so.
  await page.reload();
  await page.locator('a.sync-chip.ok').waitFor();
  await snap('list');

  await page.locator('input.search').fill(scene.search);
  await snap('search');

  await page.goto(`/#/recipes/${encodeURIComponent(featured)}`);
  await page.locator('h1').waitFor();
  await snap('recipe');

  // Cooking: a few ingredients gathered, and the first step done.
  await page.goto(`/#/recipes/${encodeURIComponent(featured)}/cook`);
  const ingredients = page.locator('.cook-list:not(.cook-steps) input[type=checkbox]');
  await ingredients.first().waitFor();
  for (const index of [0, 1, 2, 3]) await ingredients.nth(index).check();
  await page.locator('.cook-steps input[type=checkbox]').first().check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await snap('cook');

  await page.locator('.foot button.pen').click();
  await page.locator('textarea').fill(scene.note);
  await snap('note');

  await page.goto('/#/new');
  await page.locator('#title').fill(scene.draft.title);
  await page.locator(`input[type=radio][value=${lang}]`).check();
  await page.locator('#ingredients').fill(scene.draft.ingredients);
  // The whole reading at the bottom of the screen, with what was pasted above it.
  const reading = page.locator('.preview').first();
  await reading.waitFor();
  await reading.evaluate((element) => {
    const { bottom } = element.getBoundingClientRect();
    window.scrollBy(0, bottom - window.innerHeight + 16);
  });
  await snap('editor');

  await page.goto('/#/sync');
  await page.locator('h1').waitFor();
  await snap('sync');

  await page.goto('/#/backup');
  await page.locator('h1').waitFor();
  await snap('backup');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
