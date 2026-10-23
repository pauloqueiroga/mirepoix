import { expect, test, withoutAnalytics } from './fixtures.js';
import { createVault } from '../../app/store/crypto.js';
import { createFakeGitHub } from '../support/fake-github.js';

// Every device (R2): connecting (R2.4), what the chip and the sync screen say
// when things go wrong (R2.5), and everyone's R1 recipes merging (R2.6).
// GitHub is the stand-in from test/support, shared by every test browser, so
// separate browser contexts are separate devices on one repository.

const REPO = 'cook/mirepoix-data';
const PASSPHRASE = 'feijão com arroz';

/** @typedef {import('@playwright/test').Page} Page */

/** @type {string[]} */
let errors = [];
/** @param {Page} page */
function watch(page) {
  page.on('console', (message) => {
    // Browsers log every failed request; expected ones (no vault yet, an
    // expired token, no network) are not errors here, but CSP refusals
    // ("Refused to connect…") and crashes are. WebKit words a request cut
    // off by "no network" as "Fetch API cannot load…".
    if (message.type() === 'error' && !/^(Failed to load resource|Fetch API cannot load https:\/\/api\.github\.com\/)/.test(message.text())) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
}
/** @type {ReturnType<typeof createFakeGitHub>} */
let github;
test.beforeEach(async ({ page }) => {
  errors = [];
  github = createFakeGitHub();
  github.addRepo(REPO);
  for (const token of ['token-a', 'token-b', 'token-c']) github.addToken(token, [REPO]);
  await page.context().route('https://api.github.com/**', github.route);
  watch(page);
});
test.afterEach(() => {
  expect(errors, 'no console errors, including CSP violations').toEqual([]);
});

/**
 * Another device: a browser context of its own, so storage of its own.
 * @param {import('@playwright/test').Browser} browser
 */
async function otherDevice(browser) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'en-US' });
  await withoutAnalytics(context);
  await context.route('https://api.github.com/**', github.route);
  const page = await context.newPage();
  watch(page);
  return page;
}

/**
 * Puts recipes straight into a device's store: its R1 recipes.
 * @param {Page} page
 * @param {string[]} titles
 */
async function seed(page, titles) {
  await page.goto('/');
  await page.evaluate(async (names) => {
    const { openLocalStore } = await import('/store/local-store.js');
    const { newRecipe } = await import('/domain/recipe.js');
    const store = await openLocalStore();
    for (const title of names) await store.put(newRecipe({ title, lang: 'pt' }));
  }, titles);
  await page.reload();
}

/** @param {Page} page */
const stored = (page) => page.evaluate(async () => {
  const { openLocalStore } = await import('/store/local-store.js');
  return (await openLocalStore()).list();
});

/** @param {Page} page */
const titles = async (page) => (await stored(page)).map((recipe) => recipe.title).sort();

/**
 * Fills in the connect form and connects.
 * @param {Page} page
 * @param {{ mode?: 'fresh' | 'join', passphrase?: string, token?: string }} [options]
 */
async function connectDevice(page, { mode = 'join', passphrase = PASSPHRASE, token = 'token-a' } = {}) {
  await page.goto('/#/sync');
  if (mode === 'fresh') await page.getByRole('radio', { name: 'Start fresh' }).check();
  await page.getByLabel('Private repository').fill(REPO);
  await page.getByLabel('GitHub token').fill(token);
  await page.getByLabel('Passphrase', { exact: true }).fill(passphrase);
  if (mode === 'fresh') await page.getByLabel('Passphrase again').fill(passphrase);
  await page.getByRole('button', { name: 'Connect' }).click();
}

/** The sync chip in the list's header. @param {Page} page */
const chip = (page) => page.getByRole('banner').locator('a.sync-chip');

test('starting fresh: the vault is made, recipes go up sealed, and the device opens straight into them', async ({ page }) => {
  await seed(page, ['Feijoada', 'Pão de queijo']);
  await expect(chip(page)).toHaveText('This device only');
  await chip(page).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Connect this device' })).toBeVisible();
  await expect(page.getByText('GitHub only ever stores scrambled files.')).toBeVisible();
  await page.getByText('How do I get these?').click();
  await expect(page.getByText('“Developer settings” → “Personal access tokens” → “Fine-grained tokens”', { exact: false })).toBeVisible();
  await expect(page.getByText('GitHub moves its menus around now and then', { exact: false })).toBeVisible();
  await connectDevice(page, { mode: 'fresh' });

  await expect(page.getByRole('list', { name: 'Recipes' }).getByRole('listitem')).toHaveText(['Feijoada', 'Pão de queijo']);
  await expect(chip(page)).toHaveText('Synced');
  const files = github.files(REPO);
  expect(Object.keys(files).filter((path) => path.startsWith('recipes/'))).toHaveLength(2);
  expect(Object.keys(files)).toContain('vault.json');
  for (const text of Object.values(files)) expect(text).not.toMatch(/Feijoada|queijo|feijão/i);

  // The device keeps the key, never the passphrase (D7).
  const kept = await page.evaluate(async () => {
    const { openLocalStore } = await import('/store/local-store.js');
    const connection = await (await openLocalStore()).setting('connection');
    return { extractable: connection?.key.extractable, text: JSON.stringify({ ...connection, key: null }), local: JSON.stringify({ ...localStorage }) };
  });
  expect(kept.extractable).toBe(false);
  expect(kept.text).not.toContain('feijão com arroz');
  expect(kept.local).not.toContain('feijão com arroz');

  const before = github.requests.length;
  await page.reload();
  await expect(chip(page)).toHaveText('Synced');
  await expect(page.getByRole('list', { name: 'Recipes' }).getByRole('listitem')).toHaveCount(2);
  expect(github.requests.slice(before).map((r) => `${r.method} ${r.path}`), 'a returning device asks one small question')
    .toEqual([`GET /repos/${REPO}/commits/main`]);
});

test('joining: a wrong passphrase is caught before anything downloads, then the right one brings everything', async ({ page, browser }) => {
  await seed(page, ['Feijoada']);
  await connectDevice(page, { mode: 'fresh' });
  await expect(chip(page)).toHaveText('Synced');

  const other = await otherDevice(browser);
  await seed(other, ['Bolo de fubá']);
  const before = github.requests.length;
  await connectDevice(other, { passphrase: 'arroz com feijão', token: 'token-b' });
  await expect(other.getByRole('alert')).toHaveText('That passphrase doesn’t open these recipes.');
  expect(github.requests.slice(before).filter((r) => r.path.includes('/recipes/'))).toEqual([]);

  await other.getByLabel('Passphrase', { exact: true }).fill(PASSPHRASE);
  await other.getByRole('button', { name: 'Connect' }).click();
  await expect(other.getByRole('list', { name: 'Recipes' }).getByRole('listitem')).toHaveText(['Bolo de fubá', 'Feijoada']);
  await expect(chip(other)).toHaveText('Synced');
  await other.context().close();
});

test('connecting explains what is wrong: nothing to join yet, or recipes already there', async ({ page, browser }) => {
  await connectDevice(page);
  await expect(page.getByRole('alert')).toHaveText('There are no recipes there yet. Use Start fresh on your first device.');
  await page.getByRole('radio', { name: 'Start fresh' }).check();
  await page.getByLabel('Passphrase again').fill('something else');
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByRole('alert')).toHaveText('The two passphrases don’t match.');
  await page.getByLabel('Passphrase again').fill(PASSPHRASE);
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(chip(page)).toHaveText('Synced');

  const other = await otherDevice(browser);
  await connectDevice(other, { mode: 'fresh', token: 'token-b' });
  await expect(other.getByRole('alert')).toHaveText('That repository already has recipes. Use Join my recipes instead.');
  await connectDevice(other, { token: 'nope' });
  await expect(other.getByRole('alert')).toHaveText('GitHub doesn’t accept this token. It may be mistyped, expired or revoked.');
  await other.context().close();
});

test('a change on one device reaches the other; deleting does too', async ({ page, browser }) => {
  await seed(page, ['Feijoada', 'Pastel']);
  await connectDevice(page, { mode: 'fresh' });
  await expect(chip(page)).toHaveText('Synced');
  const other = await otherDevice(browser);
  await connectDevice(other, { token: 'token-b' });
  await expect(other.getByRole('list', { name: 'Recipes' }).getByRole('listitem')).toHaveCount(2);

  await page.getByRole('link', { name: 'Feijoada' }).click();
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Title').fill('Feijoada completa');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: 'Recipes' }).click();
  await page.getByRole('link', { name: 'Pastel' }).click();
  await page.getByRole('link', { name: 'Edit' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete recipe' }).click();
  await expect(chip(page)).toHaveText('Synced');
  await expect.poll(() => Object.keys(github.files(REPO)).length).toBe(2);

  await other.reload();
  await expect(other.getByRole('list', { name: 'Recipes' }).getByRole('listitem')).toHaveText(['Feijoada completa']);
  await other.context().close();
});

test('saving an edit to a recipe that another device changed meanwhile keeps both (D6)', async ({ page }) => {
  await seed(page, ['Feijoada']);
  await connectDevice(page, { mode: 'fresh' });
  await expect(chip(page)).toHaveText('Synced');
  await page.getByRole('link', { name: 'Feijoada' }).click();
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Title').fill('Feijoada da Ana');
  // Meanwhile, syncing brings in another device's version of the same recipe.
  await page.evaluate(async () => {
    const { openLocalStore } = await import('/store/local-store.js');
    const store = await openLocalStore();
    const [recipe] = await store.list();
    if (recipe) await store.put({ ...recipe, title: 'Feijoada do Beto', updatedAt: new Date().toISOString() });
  });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Feijoada da Ana \(conflict, \w+, \d{4}-\d{2}-\d{2}\)$/);
  await page.getByRole('link', { name: 'Recipes' }).click();
  await expect(page.getByRole('list', { name: 'Recipes' }).getByRole('listitem').locator('.title'))
    .toHaveText([/^Feijoada da Ana \(conflict/, 'Feijoada do Beto']);
  await expect(chip(page)).toHaveText('Synced');
  expect(Object.keys(github.files(REPO)).filter((path) => path.startsWith('recipes/'))).toHaveLength(2);
});

test('offline: the chip says so, changes wait (even through a reload), and go up once back', async ({ page }) => {
  await seed(page, ['Feijoada']);
  await connectDevice(page, { mode: 'fresh' });
  await expect(chip(page)).toHaveText('Synced');

  github.offline = true;
  await page.getByRole('link', { name: 'Feijoada' }).click();
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Title').fill('Feijoada completa');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: 'Recipes' }).click();
  await expect(chip(page)).toHaveText('Offline');
  await page.reload();
  await expect(chip(page)).toHaveText('Offline');
  await chip(page).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sync' })).toBeVisible();
  await expect(page.getByText('You’re offline. Changes wait on this device and go up when you’re back.')).toBeVisible();
  await expect(page.getByText('1 change is waiting to go up.')).toBeVisible();

  github.offline = false;
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(page.getByRole('status').getByText('Synced')).toBeVisible();
  await expect(page.getByText('1 change is waiting to go up.')).toBeHidden();
  expect(Object.values(github.files(REPO))).toHaveLength(2);
});

test('an expired or revoked token: the chip says so, and a new token gets syncing going again', async ({ page }) => {
  await seed(page, ['Feijoada']);
  await connectDevice(page, { mode: 'fresh' });
  await expect(chip(page)).toHaveText('Synced');
  github.revokeToken('token-a');
  await page.reload();
  await expect(chip(page)).toHaveText('Token expired');
  await chip(page).click();
  await expect(page.getByText('GitHub doesn’t accept this token.', { exact: false })).toBeVisible();
  await page.getByLabel('New GitHub token').fill('not-this-one');
  await page.getByRole('button', { name: 'Use this token' }).click();
  await expect(page.getByRole('alert')).toHaveText('GitHub doesn’t accept this token. It may be mistyped, expired or revoked.');
  github.addToken('token-new', [REPO]);
  await page.getByLabel('New GitHub token').fill('token-new');
  await page.getByRole('button', { name: 'Use this token' }).click();
  await expect(page.getByRole('status').getByText('Synced')).toBeVisible();
  await expect(page.getByLabel('New GitHub token')).toBeHidden();
});

test('a vault made anew with another passphrase: syncing waits for that passphrase', async ({ page }) => {
  await seed(page, ['Feijoada']);
  await connectDevice(page, { mode: 'fresh' });
  await expect(chip(page)).toHaveText('Synced');
  github.writeFile(REPO, 'vault.json', (await createVault('outra frase secreta', { iterations: 1000 })).text);
  await page.reload();
  await expect(chip(page)).toHaveText('Passphrase needed');
  await chip(page).click();
  await expect(page.getByText('The recipes on GitHub now open with a different passphrase. Type it to keep syncing.')).toBeVisible();
  await page.getByLabel('Passphrase').fill(PASSPHRASE);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('alert').last()).toHaveText('That passphrase doesn’t open these recipes.');
  await page.getByLabel('Passphrase').fill('outra frase secreta');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('status').getByText('Synced')).toBeVisible();
});

test('disconnecting keeps every recipe on the device', async ({ page }) => {
  await seed(page, ['Feijoada', 'Pastel']);
  await connectDevice(page, { mode: 'fresh' });
  await expect(chip(page)).toHaveText('Synced');
  await chip(page).click();
  await expect(page.getByText(`Recipes sync with ${REPO} on GitHub, end-to-end encrypted.`)).toBeVisible();
  page.once('dialog', (dialog) => {
    expect(dialog.message()).toBe('Stop syncing on this device? Every recipe stays here, and GitHub keeps its copy.');
    void dialog.accept();
  });
  await page.getByRole('button', { name: 'Disconnect this device' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Connect this device' })).toBeVisible();
  await page.getByRole('link', { name: 'Recipes' }).click();
  await expect(chip(page)).toHaveText('This device only');
  expect(await titles(page)).toEqual(['Feijoada', 'Pastel']);
  expect(Object.keys(github.files(REPO))).toHaveLength(3);
});

test('three devices, each with its own R1 recipes, end up holding the same union (R2.6)', async ({ page, browser }) => {
  // A starts fresh. B and C join. Two people typed the same dish: both stay.
  await seed(page, ['Feijoada', 'Pão de queijo']);
  const b = await otherDevice(browser);
  await seed(b, ['Bolo de fubá', 'Moqueca']);
  const c = await otherDevice(browser);
  await seed(c, ['Feijoada', 'Caldo verde']);

  await connectDevice(page, { mode: 'fresh' });
  await expect(chip(page)).toHaveText('Synced');
  await connectDevice(b, { token: 'token-b' });
  await expect(chip(b)).toHaveText('Synced');
  await connectDevice(c, { token: 'token-c' });
  await expect(chip(c)).toHaveText('Synced');
  for (const device of [page, b]) {
    await device.reload();
    await expect(chip(device)).toHaveText('Synced');
  }

  const union = ['Bolo de fubá', 'Caldo verde', 'Feijoada', 'Feijoada', 'Moqueca', 'Pão de queijo'];
  for (const device of [page, b, c]) {
    await expect(device.getByRole('list', { name: 'Recipes' }).getByRole('listitem').locator('.title')).toHaveCount(6);
    expect(await titles(device)).toEqual(union);
  }
  const byId = (/** @type {{ id: string }} */ x, /** @type {{ id: string }} */ y) => x.id.localeCompare(y.id);
  const everywhere = (await stored(page)).sort(byId);
  expect((await stored(b)).sort(byId)).toEqual(everywhere);
  expect((await stored(c)).sort(byId)).toEqual(everywhere);
  expect(Object.keys(github.files(REPO)).filter((path) => path.startsWith('recipes/'))).toHaveLength(6);
  await b.context().close();
  await c.context().close();
});
