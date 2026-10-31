import { expect, test } from './fixtures.js';

// Tags (R3.4) and filtering the list by tag (R3.5), D17.

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

/** @type {[string, string[]][]} */
const BOX = [
  ['Bolo de fubá', ['café da tarde', 'sobremesa']],
  ['Brigadeiro', ['festa', 'Sobremesa']],
  ['Coxinha', ['festa', 'salgado']],
  ['Feijoada', []],
  ['Pudim', ['sobremesa']],
];

/**
 * Puts recipes with tags straight into the device's store.
 * @param {import('@playwright/test').Page} page
 * @param {[string, string[] | undefined][]} recipes undefined: saved before tags existed
 */
async function seed(page, recipes = BOX) {
  await page.goto('/');
  await page.evaluate(async (list) => {
    const { openLocalStore } = await import('/store/local-store.js');
    const { newRecipe } = await import('/domain/recipe.js');
    const store = await openLocalStore();
    for (const [title, tags] of list) {
      const recipe = { ...newRecipe({ title, lang: 'pt' }), tags };
      if (!tags) delete recipe.tags;
      await store.put(recipe);
    }
  }, recipes);
  await page.reload();
}

/** @param {import('@playwright/test').Page} page */
const titles = (page) => page.getByRole('list', { name: 'Recipes' }).getByRole('listitem').locator('.title');
/** @param {import('@playwright/test').Page} page */
const filter = (page) => page.getByRole('group', { name: 'Filter by tag' });
/** @param {import('@playwright/test').Page} page */
const tagsBox = (page) => page.getByRole('textbox', { name: 'Tags' });

test('tags typed in the editor show on the recipe, and come back for editing', async ({ page }) => {
  await page.goto('/#/new');
  await expect(page.getByText('Separate tags with commas.')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Your tags' }), 'no tags in use yet').toHaveCount(0);
  await page.getByLabel('Title').fill('Pão de queijo');
  await tagsBox(page).fill('#lanche,  Minas   Gerais, LANCHE, ');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: 'Pão de queijo' }).click();

  await expect(page.getByRole('list', { name: 'Tags' }).getByRole('link')).toHaveText(['lanche', 'Minas Gerais']);
  await page.getByRole('link', { name: 'Edit' }).click();
  await expect(tagsBox(page)).toHaveValue('lanche, Minas Gerais');
});

test('tags already in use are a tap away in the editor', async ({ page }) => {
  await seed(page);
  await page.goto('/#/new');
  const picks = page.getByRole('group', { name: 'Your tags' }).getByRole('button');
  await expect(picks).toHaveText(['café da tarde', 'festa', 'salgado', 'sobremesa']);
  await expect(page.getByText('Separate tags with commas, or tap the ones you already use.')).toBeVisible();
  const pick = (/** @type {string} */ name) => picks.filter({ hasText: name });

  await pick('sobremesa').click();
  await expect(tagsBox(page)).toHaveValue('sobremesa');
  await expect(pick('sobremesa')).toHaveAttribute('aria-pressed', 'true');
  await pick('festa').click();
  await expect(tagsBox(page)).toHaveValue('sobremesa, festa');
  await pick('sobremesa').click();
  await expect(tagsBox(page)).toHaveValue('festa');
  await expect(pick('sobremesa')).toHaveAttribute('aria-pressed', 'false');

  await tagsBox(page).fill('Salgado, natal');
  await expect(pick('salgado'), 'typed any way at all').toHaveAttribute('aria-pressed', 'true');
  await expect(pick('festa')).toHaveAttribute('aria-pressed', 'false');
});

test('picking tags shows the recipes with all of them, alongside the search', async ({ page }) => {
  await seed(page);
  await expect(filter(page).getByRole('button')).toHaveText(['café da tarde', 'festa', 'salgado', 'sobremesa']);
  const chip = (/** @type {string} */ name) => filter(page).getByRole('button', { name });

  await chip('festa').click();
  await expect(chip('festa')).toHaveAttribute('aria-pressed', 'true');
  await expect(titles(page)).toHaveText(['Brigadeiro', 'Coxinha']);
  await expect(page.getByText('2 of 5 recipes')).toBeVisible();

  await chip('sobremesa').click();
  await expect(titles(page), 'every tag picked, not any').toHaveText(['Brigadeiro']);
  await chip('festa').click();
  await expect(titles(page), 'sobremesa however it was written').toHaveText(['Bolo de fubá', 'Brigadeiro', 'Pudim']);

  const search = page.getByRole('searchbox', { name: 'Search recipes' });
  await search.fill('pud');
  await expect(titles(page)).toHaveText(['Pudim']);
  await search.fill('coxinha');
  await expect(page.getByRole('heading', { name: 'No matches' })).toBeVisible();
  await expect(page.getByText('Nothing with the tags you picked matches “coxinha”.')).toBeVisible();
  await search.fill('');
  await chip('salgado').click();
  await expect(page.getByText('No recipe has all the tags you picked.')).toBeVisible();

  await chip('salgado').click();
  await chip('sobremesa').click();
  await expect(titles(page)).toHaveCount(5);
  await expect(page.getByText('5 recipes', { exact: true })).toBeVisible();
});

test('the picked tags are still there after opening a recipe and coming back, and stay out of the address', async ({ page }) => {
  await seed(page);
  await filter(page).getByRole('button', { name: 'festa' }).click();
  await page.getByRole('searchbox', { name: 'Search recipes' }).fill('co');
  expect(page.url(), 'filters stay out of the address (D14)').not.toMatch(/festa|co$/);
  await page.getByRole('link', { name: /Coxinha/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Coxinha' })).toBeVisible();

  await page.goBack();
  await expect(filter(page).getByRole('button', { name: 'festa' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('searchbox', { name: 'Search recipes' })).toHaveValue('co');
  await expect(titles(page)).toHaveText(['Coxinha']);
});

test('a tag on a recipe opens the list of recipes that have it', async ({ page }) => {
  await seed(page);
  await page.getByRole('searchbox', { name: 'Search recipes' }).fill('brigadeiro');
  await page.getByRole('link', { name: /Brigadeiro/ }).click();
  const tags = page.getByRole('list', { name: 'Tags' });
  await expect(tags.getByRole('link')).toHaveText(['festa', 'Sobremesa']);

  await tags.getByRole('link', { name: 'festa' }).click();
  await expect(page.getByRole('searchbox', { name: 'Search recipes' }), 'the search starts over').toHaveValue('');
  await expect(filter(page).getByRole('button', { name: 'festa' })).toHaveAttribute('aria-pressed', 'true');
  await expect(titles(page)).toHaveText(['Brigadeiro', 'Coxinha']);
  expect(page.url()).not.toContain('festa');

  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Brigadeiro' })).toBeVisible();
  await page.goForward();
  await expect(titles(page)).toHaveText(['Brigadeiro', 'Coxinha']);

  await page.goBack();
  await tags.getByRole('link', { name: 'Sobremesa' }).click();
  await expect(filter(page).getByRole('button', { name: 'sobremesa' }), 'the list writes it the way most recipes do')
    .toHaveAttribute('aria-pressed', 'true');
  await expect(titles(page)).toHaveText(['Bolo de fubá', 'Brigadeiro', 'Pudim']);
});

test('search finds tags too, and says which tag matched', async ({ page }) => {
  await seed(page);
  await page.getByRole('searchbox', { name: 'Search recipes' }).fill('cafe');
  await expect(page.getByRole('list', { name: 'Recipes' }).getByRole('listitem')).toHaveText(['Bolo de fubátagged café da tarde']);
  await page.getByRole('searchbox', { name: 'Search recipes' }).fill('lasanha');
  await expect(page.getByText('No title, ingredient or tag matches “lasanha”.')).toBeVisible();
});

test('a recipe box with no tags has no tag filter, and older recipes work as before', async ({ page }) => {
  await seed(page, [['Feijoada', undefined], ['Shakshuka', []]]);
  await expect(titles(page)).toHaveText(['Feijoada', 'Shakshuka']);
  await expect(filter(page)).toHaveCount(0);
  await page.getByRole('link', { name: 'Feijoada' }).click();
  await expect(page.getByRole('list', { name: 'Tags' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Edit' }).click();
  await expect(tagsBox(page)).toHaveValue('');
  await tagsBox(page).fill('domingo');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: 'Recipes' }).click();
  await expect(filter(page).getByRole('button')).toHaveText(['domingo']);
});

test.describe('in Portuguese', () => {
  test.use({ locale: 'pt-BR' });

  test('tags are "etiquetas"', async ({ page }) => {
    await seed(page);
    const chips = page.getByRole('group', { name: 'Filtrar por etiqueta' });
    await chips.getByRole('button', { name: 'festa' }).click();
    await expect(page.getByText('2 de 5 receitas')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Buscar receitas' }).fill('salgado');
    await expect(page.getByRole('list', { name: 'Receitas' }).getByRole('listitem')).toHaveText(['Coxinhaetiqueta salgado']);
    await page.getByRole('link', { name: /Coxinha/ }).click();
    await expect(page.getByRole('list', { name: 'Etiquetas' }).getByRole('link')).toHaveText(['festa', 'salgado']);
    await page.getByRole('link', { name: 'Editar' }).click();
    await expect(page.getByRole('textbox', { name: 'Etiquetas' })).toHaveValue('festa, salgado');
    await expect(page.getByRole('group', { name: 'Suas etiquetas' })).toBeVisible();
    await expect(page.getByText('Separe as etiquetas com vírgulas, ou toque nas que você já usa.')).toBeVisible();
  });
});
