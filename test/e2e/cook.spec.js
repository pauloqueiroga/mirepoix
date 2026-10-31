import { expect, test } from './fixtures.js';

// Cook mode (R3, D10, D16): big type and the screen kept on (R3.1), ticks that
// are never saved (R3.2), and dated notes for next time (R3.3).

test.use({ timezoneId: 'America/Sao_Paulo' });

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

/** @param {string} quantity @param {string} unit @param {string} name @param {string} [note] */
const item = (quantity, unit, name, note = '', alternatives = /** @type {{ quantity: string, unit: string }[]} */ ([])) =>
  ({ quantity, unit, name, note, alternatives });

const PAO_DE_QUEIJO = {
  title: 'Pão de queijo',
  lang: 'pt',
  source: 'Family notebook',
  yield: '30 unidades',
  ingredients: [
    { heading: 'Massa', items: [item('500', 'g', 'polvilho azedo'), item('1', 'copo americano', 'leite'), item('2', 'cup', 'queijo meia-cura', 'ralado', [{ quantity: '200', unit: 'g' }])] },
    { heading: 'Para finalizar', items: [item('', '', 'queijo parmesão', 'a gosto')] },
  ],
  preparation: [{ heading: '', steps: ['Ferva o leite.', 'Escalde o polvilho.', 'Junte os ovos.', 'Asse a 180 °C.'] }],
  variations: ['Use queijo canastra.'],
  notes: ['Congela bem.'],
};

/**
 * Stores a recipe straight into the device's store and returns its id.
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, unknown>} [fields]
 */
async function seed(page, fields = {}) {
  await page.goto('/');
  return page.evaluate(async (recipe) => {
    const { openLocalStore } = await import('/store/local-store.js');
    const { newRecipe } = await import('/domain/recipe.js');
    const full = { ...newRecipe({ title: String(recipe.title), lang: 'pt' }), ...recipe };
    await (await openLocalStore()).put(full);
    return full.id;
  }, { ...PAO_DE_QUEIJO, ...fields });
}

/** @param {import('@playwright/test').Page} page @param {string} id */
const stored = (page, id) => page.evaluate(async (recipeId) => {
  const { openLocalStore } = await import('/store/local-store.js');
  return (await openLocalStore()).get(recipeId);
}, id);

/**
 * A stand-in for the Screen Wake Lock API that records what was asked of it,
 * and a way to hide and show the page the way switching apps does.
 * @param {import('@playwright/test').Page} page
 * @param {{ supported?: boolean }} [options]
 */
async function fakeWakeLock(page, { supported = true } = {}) {
  await page.addInitScript((available) => {
    const page = /** @type {any} */ (window);
    if (!available) {
      delete (/** @type {any} */ (Navigator.prototype)).wakeLock;
      return;
    }
    /** @type {string[]} */
    const log = (page.wakeLog = []);
    /** @type {any} */
    let held = null;
    const wakeLock = {
      async request(/** @type {string} */ type) {
        log.push(`request ${type}`);
        const sentinel = Object.assign(new EventTarget(), {
          type,
          released: false,
          async release() {
            if (sentinel.released) return;
            sentinel.released = true;
            log.push('release');
            sentinel.dispatchEvent(new Event('release'));
          },
        });
        held = sentinel;
        return sentinel;
      },
    };
    Object.defineProperty(Navigator.prototype, 'wakeLock', { configurable: true, get: () => wakeLock });
    let visibility = 'visible';
    Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => visibility });
    page.setVisibility = async (/** @type {string} */ state) => {
      visibility = state;
      if (state === 'hidden') await held?.release(); // browsers let go of the lock when the page is hidden
      document.dispatchEvent(new Event('visibilitychange'));
    };
  }, supported);
}

/** @param {import('@playwright/test').Page} page */
const wakeLog = (page) => page.evaluate(() => /** @type {any} */ (window).wakeLog);

/** @param {import('@playwright/test').Page} page */
const steps = (page) => page.getByRole('list', { name: 'Steps' }).getByRole('listitem');

test('Start cooking opens the recipe in big type with nothing to edit, and Done leads back', async ({ page }) => {
  const id = await seed(page);
  await page.goto(`/#/recipes/${id}`);
  const readingSize = await page.locator('.steps li').first().evaluate((li) => parseFloat(getComputedStyle(li).fontSize));
  await page.getByRole('link', { name: 'Start cooking' }).click();

  await expect(page).toHaveURL(new RegExp(`#/recipes/${id}/cook$`));
  await expect(page).toHaveTitle('Cooking Pão de queijo · Mirepoix');
  await expect(page.getByRole('heading', { level: 1, name: 'Pão de queijo' })).toBeVisible();
  await expect(page.getByText('Family notebook · Makes 30 unidades')).toBeVisible();
  for (const [group, names] of [
    ['Massa', ['500 g polvilho azedo', '1 copo americano leite', '2 xícaras or 200 g queijo meia-cura, ralado']],
    ['Para finalizar', ['queijo parmesão, a gosto']],
  ]) {
    const boxes = page.getByRole('list', { name: String(group) }).getByRole('checkbox');
    await expect(boxes).toHaveCount(names.length);
    for (const [i, name] of [...names].entries()) await expect(boxes.nth(i)).toHaveAccessibleName(name);
  }
  await expect(steps(page)).toHaveText(['1 Ferva o leite.', '2 Escalde o polvilho.', '3 Junte os ovos.', '4 Asse a 180 °C.']);
  await expect(page.getByRole('region', { name: 'Variations' })).toContainText('Use queijo canastra.');
  await expect(page.getByRole('region', { name: 'Notes' })).toContainText('Congela bem.');

  const cookingSize = await page.locator('.cook-steps .line').first().evaluate((line) => parseFloat(getComputedStyle(line).fontSize));
  expect(cookingSize, 'bigger than reading').toBeGreaterThanOrEqual(readingSize * 1.15);
  await expect(page.locator('main').locator('input:not([type="checkbox"]), select, textarea, [contenteditable]')).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Done' }).click();
  await expect(page).toHaveURL(new RegExp(`#/recipes/${id}$`));
  await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
});

test('ticking off ingredients counts them, and the first step not done is the one to do now', async ({ page }) => {
  const id = await seed(page);
  await page.goto(`/#/recipes/${id}/cook`);
  const ingredients = page.getByRole('region', { name: 'Ingredients' });
  await expect(ingredients.getByText('0 of 4 ready')).toBeVisible();
  await page.getByRole('checkbox', { name: '500 g polvilho azedo' }).check();
  await page.getByText('1 copo americano leite').click();
  await expect(ingredients.getByText('2 of 4 ready')).toBeVisible();
  await page.getByRole('checkbox', { name: '500 g polvilho azedo' }).uncheck();
  await expect(ingredients.getByText('1 of 4 ready')).toBeVisible();
  for (const box of await ingredients.getByRole('checkbox').all()) await box.check();
  await expect(ingredients.getByText('All ready')).toBeVisible();

  const preparation = page.getByRole('region', { name: 'Preparation' });
  const current = () => steps(page).and(page.locator('[aria-current="step"]'));
  await expect(preparation.getByText('Step 1 of 4')).toBeVisible();
  await expect(current()).toHaveText('1 Ferva o leite.');

  await steps(page).nth(0).click();
  await expect(current()).toHaveText('2 Escalde o polvilho.');
  await expect(preparation.getByText('Step 2 of 4')).toBeVisible();
  await steps(page).nth(2).click();
  await expect(current(), 'skipping ahead leaves the skipped step to do').toHaveText('2 Escalde o polvilho.');
  await steps(page).nth(0).click();
  await expect(current(), 'unticking goes back').toHaveText('1 Ferva o leite.');

  for (const i of [0, 1, 3]) await steps(page).nth(i).click();
  await expect(current()).toHaveCount(0);
  await expect(preparation.getByText('All steps done')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Escalde/ })).toBeChecked();
});

test('ticks are never saved: the recipe is untouched, and they are gone after Done or a reload', async ({ page }) => {
  const id = await seed(page);
  const before = await stored(page, id);
  await page.goto(`/#/recipes/${id}/cook`);
  await page.getByRole('checkbox', { name: '500 g polvilho azedo' }).check();
  await steps(page).nth(0).click();
  expect(await stored(page, id)).toEqual(before);

  await page.reload();
  await expect(page.getByRole('checkbox', { name: '500 g polvilho azedo' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(0);

  await page.getByRole('checkbox', { name: '500 g polvilho azedo' }).check();
  await page.getByRole('link', { name: 'Done' }).click();
  await page.getByRole('link', { name: 'Start cooking' }).click();
  await expect(page.getByRole('checkbox', { name: '500 g polvilho azedo' })).not.toBeChecked();
  expect(await stored(page, id)).toEqual(before);
});

test('the screen stays on while cooking, asks again after switching apps, and lets go on the way out', async ({ page }) => {
  await fakeWakeLock(page);
  const id = await seed(page);
  await page.goto(`/#/recipes/${id}`);
  const chip = page.getByRole('status').filter({ hasText: 'Screen on' });
  expect(await wakeLog(page)).toEqual([]);

  await page.getByRole('link', { name: 'Start cooking' }).click();
  await expect(chip).toBeVisible();
  expect(await wakeLog(page)).toEqual(['request screen']);

  await page.evaluate(() => /** @type {any} */ (window).setVisibility('hidden'));
  await expect(chip).toBeHidden();
  await page.evaluate(() => /** @type {any} */ (window).setVisibility('visible'));
  await expect(chip).toBeVisible();
  expect(await wakeLog(page)).toEqual(['request screen', 'release', 'request screen']);

  await page.getByRole('link', { name: 'Done' }).click();
  await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
  await expect.poll(() => wakeLog(page)).toEqual(['request screen', 'release', 'request screen', 'release']);
});

test('where the screen can\'t be kept on, cook mode works the same and says nothing', async ({ page }) => {
  await fakeWakeLock(page, { supported: false });
  const id = await seed(page);
  await page.goto(`/#/recipes/${id}/cook`);
  await steps(page).nth(0).click();
  await expect(page.getByRole('region', { name: 'Preparation' }).getByText('Step 2 of 4')).toBeVisible();
  await expect(page.getByText('Screen on')).toBeHidden();
});

test('a note for next time is added with the date, and the recipe and the ticks stay as they were', async ({ page }) => {
  const id = await seed(page);
  const before = await stored(page, id);
  await page.clock.setFixedTime(new Date('2026-10-31T22:42:00Z')); // 19:42 in São Paulo
  await page.goto(`/#/recipes/${id}/cook`);
  await steps(page).nth(0).click();

  await page.getByRole('button', { name: 'Note for next time' }).click();
  const sheet = page.getByRole('dialog', { name: 'Note for next time' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('This is added to Pão de queijo with today’s date. The recipe itself stays as it is.')).toBeVisible();
  await expect(sheet.getByText(/^Oct 31, 2026, 7:42\sPM$/)).toBeVisible();
  const note = sheet.getByRole('textbox', { name: 'Your note' });
  await expect(note).toBeFocused();
  const save = sheet.getByRole('button', { name: 'Save note' });
  await expect(save).toBeDisabled();
  await note.fill('   ');
  await expect(save).toBeDisabled();

  await note.fill('A massa ficou mole:\nusei 50 g a mais de polvilho.');
  await save.click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: 'Note saved.' })).toHaveText('Note saved. It shows as “Last time” when you open this recipe.');
  await expect(page.getByRole('checkbox', { name: /Ferva o leite/ }), 'still cooking: the ticks stay').toBeChecked();

  const after = await stored(page, id);
  expect(after.cooksNotes).toEqual([{ id: expect.any(String), at: '2026-10-31T22:42:00.000Z', text: 'A massa ficou mole:\nusei 50 g a mais de polvilho.' }]);
  expect({ ...after, cooksNotes: [] }, 'the recipe itself, update time included, is as it was').toEqual(before);

  await page.getByRole('link', { name: 'Done' }).click();
  const lastTime = page.getByRole('complementary', { name: 'Last time · Oct 31, 2026' });
  await expect(lastTime).toContainText('A massa ficou mole:\nusei 50 g a mais de polvilho.');
  await expect(page.getByRole('region', { name: 'Cook’s notes' }), 'one note needs no list').toHaveCount(0);
});

test('"Last time" is the newest note; every note is listed further down, newest first', async ({ page }) => {
  const id = await seed(page, {
    cooksNotes: [
      { id: 'b', at: '2026-10-12T22:40:00Z', text: 'Usei 50 g a mais de polvilho.' },
      { id: 'c', at: '2026-10-20T15:00:00Z', text: 'Perfeito com 600 g.' },
      { id: 'a', at: '2026-09-20T22:00:00Z', text: 'Asse direto do congelador.' },
    ],
  });
  await page.goto(`/#/recipes/${id}`);
  await expect(page.getByRole('complementary', { name: 'Last time · Oct 20, 2026' })).toContainText('Perfeito com 600 g.');
  const log = page.getByRole('region', { name: 'Cook’s notes' }).getByRole('listitem');
  await expect(log).toHaveText([
    'Oct 20, 2026Perfeito com 600 g.',
    'Oct 12, 2026Usei 50 g a mais de polvilho.',
    'Sep 20, 2026Asse direto do congelador.',
  ]);
  await expect(log.first().locator('time')).toHaveAttribute('datetime', '2026-10-20T15:00:00Z');

  await page.getByRole('link', { name: 'Start cooking' }).click();
  await expect(page.getByRole('complementary', { name: 'Last time · Oct 20, 2026' }), 'read before cooking, too').toBeVisible();
});

test('a half-written note asks before it is thrown away, by any way out', async ({ page }) => {
  const id = await seed(page);
  await page.goto(`/#/recipes/${id}`);
  await page.getByRole('link', { name: 'Start cooking' }).click();
  await page.getByRole('button', { name: 'Note for next time' }).click();
  const sheet = page.getByRole('dialog', { name: 'Note for next time' });

  // Nothing typed: Cancel just closes.
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole('button', { name: 'Note for next time' }).click();
  await sheet.getByRole('textbox', { name: 'Your note' }).fill('Menos sal.');
  /** @type {string[]} */
  const asked = [];
  page.on('dialog', (dialog) => {
    asked.push(dialog.message());
    void (asked.length % 2 === 1 ? dialog.dismiss() : dialog.accept());
  });

  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet.getByRole('textbox', { name: 'Your note' })).toHaveValue('Menos sal.');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  expect(asked).toEqual(['Discard this note?', 'Discard this note?']);

  await page.getByRole('button', { name: 'Note for next time' }).click();
  await expect(sheet.getByRole('textbox', { name: 'Your note' }), 'a discarded note is gone').toHaveValue('');
  await sheet.getByRole('textbox', { name: 'Your note' }).fill('Menos sal.');
  await page.goBack();
  await expect(sheet).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
  expect(asked.slice(2)).toEqual(['Leave without saving? Your changes will be lost.', 'Leave without saving? Your changes will be lost.']);
  expect((await stored(page, id)).cooksNotes).toEqual([]);
});

test.describe('in Portuguese', () => {
  test.use({ locale: 'pt-BR' });

  test('cook mode and its notes speak Portuguese', async ({ page }) => {
    const id = await seed(page, { cooksNotes: [{ id: 'a', at: '2026-10-12T22:40:00Z', text: 'Usei 50 g a mais de polvilho.' }] });
    await page.goto(`/#/recipes/${id}`);
    await expect(page.getByRole('complementary', { name: 'Da última vez · 12 de out. de 2026' })).toBeVisible();
    await page.getByRole('link', { name: 'Começar a cozinhar' }).click();
    await expect(page).toHaveTitle('Cozinhando Pão de queijo · Mirepoix');
    await expect(page.getByRole('region', { name: 'Ingredientes' }).getByText('0 de 4 separados')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: '2 xícaras ou 200 g queijo meia-cura, ralado' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Modo de preparo' }).getByText('Passo 1 de 4')).toBeVisible();
    await page.getByRole('button', { name: 'Nota para a próxima vez' }).click();
    const sheet = page.getByRole('dialog', { name: 'Nota para a próxima vez' });
    await sheet.getByRole('textbox', { name: 'Sua nota' }).fill('Menos sal.');
    await sheet.getByRole('button', { name: 'Salvar nota' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Nota salva.' })).toBeVisible();
    await page.getByRole('link', { name: 'Fechar' }).click();
    await expect(page.getByRole('complementary', { name: /^Da última vez/ })).toContainText('Menos sal.');
    await expect(page.getByRole('region', { name: 'Notas de cozinha' }).getByRole('listitem')).toHaveCount(2);
  });
});
