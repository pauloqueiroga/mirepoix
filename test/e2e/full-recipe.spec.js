import { expect, test } from '@playwright/test';

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

test('a whole recipe: source, makes, steps, variations and notes', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByLabel('Title').fill('Pão de queijo');
  await page.getByRole('radio', { name: 'Português' }).check();
  await page.getByLabel('Source').fill('Family notebook');
  await page.getByLabel('Makes').fill('30 pieces');
  await page.getByLabel(/^Ingredients/).fill('500 g de polvilho azedo\n2 ovos');

  const preparation = page.getByLabel('Preparation', { exact: true });
  await expect(page.getByText('One step per line, blank lines between steps, or numbered steps.')).toBeVisible();
  await preparation.fill('1. Ferva o leite, o óleo\ne o sal.\n2. Escalde o polvilho.\n3. Asse a 180 °C por 25 minutos.');
  const stepsPreview = page.getByRole('region', { name: 'How Mirepoix reads the preparation' });
  await expect(stepsPreview.getByText('3 steps', { exact: true })).toBeVisible();
  await expect(stepsPreview.getByRole('listitem')).toHaveText([
    'Ferva o leite, o óleo e o sal.',
    'Escalde o polvilho.',
    'Asse a 180 °C por 25 minutos.',
  ]);

  await page.getByText('Variations').click();
  await page.getByLabel('Variations').fill('- Use queijo canastra.\n- Recheie com goiabada.');
  await page.getByText('Notes', { exact: true }).click();
  await page.getByLabel('Notes').fill('Congela bem, crus.');
  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('link', { name: /Pão de queijo/ }).click();
  await expect(page.getByText('Family notebook · Makes 30 pieces')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Steps' }).getByRole('listitem')).toHaveText([
    'Ferva o leite, o óleo e o sal.',
    'Escalde o polvilho.',
    'Asse a 180 °C por 25 minutos.',
  ]);
  const variations = page.getByRole('region', { name: 'Variations' });
  await expect(variations.getByRole('listitem')).toHaveText(['Use queijo canastra.', 'Recheie com goiabada.']);
  await expect(page.getByRole('region', { name: 'Notes' })).toContainText('Congela bem, crus.');
});

test('steps are numbered straight through their groups', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByLabel('Title').fill('Torta');
  await page.getByLabel('Preparation', { exact: true }).fill('Massa:\nMisture a farinha.\nDescanse 30 minutos.\nRecheio:\nCozinhe o frango.');
  const stepsPreview = page.getByRole('region', { name: 'How Mirepoix reads the preparation' });
  await expect(stepsPreview.getByText('3 steps in 2 groups')).toBeVisible();
  await expect(stepsPreview.getByRole('heading', { name: 'Recheio' })).toBeVisible();
  await expect(stepsPreview.getByRole('list', { name: 'Recheio' })).toHaveAttribute('start', '3');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: 'Torta' }).click();

  await expect(page.getByRole('heading', { level: 3, name: 'Massa' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Massa' })).toHaveAttribute('start', '1');
  await expect(page.getByRole('list', { name: 'Recheio' })).toHaveAttribute('start', '3');
  await expect(page.getByRole('list', { name: 'Recheio' }).getByRole('listitem')).toHaveText(['Cozinhe o frango.']);
});

test('the preparation preview sits beside its box on a wide screen, and under it on a phone', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByLabel('Preparation', { exact: true }).fill('Mix.\nBake.');
  const box = await page.getByLabel('Preparation', { exact: true }).boundingBox();
  const preview = await page.getByRole('region', { name: 'How Mirepoix reads the preparation' }).boundingBox();
  expect(box && preview).toBeTruthy();
  if (!box || !preview) return;
  const wide = (page.viewportSize()?.width ?? 0) >= 760;
  if (wide) expect(preview.x).toBeGreaterThan(box.x + box.width - 1);
  else expect(preview.y).toBeGreaterThan(box.y + box.height - 1);
});

test('parts a recipe does not have stay out of the way', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByLabel('Title').fill('Just ingredients');
  await page.getByLabel(/^Ingredients/).fill('2 eggs');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: 'Just ingredients' }).click();

  await expect(page.getByRole('heading', { name: 'Ingredients', exact: true })).toBeVisible();
  for (const name of ['Preparation', 'Variations', 'Notes']) {
    await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.locator('.meta')).toHaveCount(0);
});
