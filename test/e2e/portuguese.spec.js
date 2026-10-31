import { configWith, expect, test } from './fixtures.js';

// Mirepoix in Portuguese (R1.17, D15): the screens follow the browser's
// language, and the footer switches it on this device.

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

test.describe('a browser set to Portuguese', () => {
  test.use({ locale: 'pt-BR' });

  test('adds and reads a recipe entirely in Portuguese', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt');
    await expect(page.getByRole('heading', { name: 'Nenhuma receita ainda' })).toBeVisible();
    await page.getByRole('link', { name: 'Nova receita' }).click();
    await expect(page).toHaveTitle('Nova receita · Mirepoix');
    await expect(page.getByRole('radio', { name: 'Português' }), 'new recipes start in the screens\' language').toBeChecked();

    const alert = page.getByRole('alert');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(alert).toHaveText('Dê um título à receita.');

    await page.getByLabel('Título').fill('Pão de queijo');
    await page.getByRole('textbox', { name: 'Ingredientes · cole ou digite, um por linha' })
      .fill('500 g de polvilho azedo\n1 tablete de fermento\n2 xícaras (200 g) de queijo meia-cura');
    const preview = page.getByRole('region', { name: 'Como o Mirepoix lê os ingredientes' });
    const row = (/** @type {string} */ name) => preview.getByRole('row').filter({ hasText: name }).first();
    await expect(preview.getByRole('columnheader')).toHaveText(['Qtd.', 'Unidade', 'Ingrediente']);
    await expect(row('meia-cura').getByRole('cell')).toHaveText(['2', 'xícarasou 200 g', 'queijo meia-cura']);
    await expect(preview.getByText('1 para conferir')).toBeVisible();
    await expect(preview.getByText('Unidade nova, “tablete”. Ela fica como foi escrita, então confira se está certa.')).toBeVisible();

    await page.getByRole('textbox', { name: 'Modo de preparo' }).fill('Misture tudo.\n\nAsse por 25 minutos.');
    await expect(page.getByRole('region', { name: 'Como o Mirepoix lê o modo de preparo' }).getByText('2 passos')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByRole('list', { name: 'Receitas' }).getByRole('listitem')).toHaveText(['Pão de queijo']);
    await expect(page.getByText('1 receita', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Pão de queijo' }).click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Ingredientes', 'Modo de preparo']);
    await expect(page.getByRole('link', { name: 'Editar' })).toBeVisible();
    await page.getByRole('link', { name: 'Receitas' }).click();
    await page.getByRole('searchbox', { name: 'Buscar receitas' }).fill('polvilho');
    await expect(page.getByRole('link', { name: /Pão de queijo/ })).toContainText('com polvilho azedo');
  });

  test('keeping a copy, and the privacy page, are in Portuguese too', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Só neste aparelho' }).click();
    await expect(page.getByRole('heading', { name: 'Conectar este aparelho' })).toBeVisible();
    await page.getByRole('link', { name: 'Exportar ou importar uma cópia' }).click();
    await expect(page.getByRole('heading', { name: 'Guardar uma cópia' })).toBeVisible();
    await expect(page.getByText('Nada para exportar ainda.')).toBeVisible();
    await page.getByLabel('Importar de um arquivo')
      .setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('not json') });
    await expect(page.getByRole('status')).toHaveText('Esse arquivo não é uma exportação do Mirepoix.');

    await expect(page.getByRole('link', { name: 'Apoie o Mirepoix no Ko-fi' })).toBeVisible();
    await page.getByRole('link', { name: 'Privacidade' }).click();
    await expect(page).toHaveTitle('Privacidade · Mirepoix');
    await expect(page.getByText('suas receitas ficam com você')).toBeVisible();
    await expect(page.getByText('As estatísticas de uso estão desligadas neste site, então nada é enviado.')).toBeVisible();
    await page.getByRole('link', { name: 'Receitas' }).click();
    await expect(page.getByRole('heading', { name: 'Nenhuma receita ainda' })).toBeVisible();
  });

  test('connecting a device is in Portuguese too (R2.4)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Só neste aparelho' }).click();
    await expect(page).toHaveTitle('Conectar este aparelho · Mirepoix');
    await expect(page.getByText('O GitHub só guarda arquivos embaralhados.')).toBeVisible();
    await page.getByRole('radio', { name: 'Começar do zero' }).check();
    await expect(page.getByText('Não dá para recuperá-la. Guarde uma cópia num lugar seguro.')).toBeVisible();
    await page.getByRole('button', { name: 'Conectar' }).click();
    await expect(page.getByRole('alert')).toHaveText('Preencha o repositório, o token e a frase secreta.');
    await page.getByLabel('Repositório privado').fill('isto não é um repositório');
    await page.getByLabel('Token do GitHub').fill('token');
    await page.getByLabel('Frase secreta', { exact: true }).fill('curta');
    await page.getByLabel('Frase secreta de novo').fill('curta');
    await page.getByRole('button', { name: 'Conectar' }).click();
    await expect(page.getByRole('alert')).toHaveText('Escreva o repositório como dono/nome, por exemplo voce/mirepoix-data, ou cole o endereço dele.');
  });

  test('asks about usage statistics in Portuguese', async ({ page }) => {
    await page.route('**/config.js', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: configWith('G-TEST12345') }));
    await page.goto('/');
    const banner = page.getByRole('complementary', { name: 'Estatísticas de uso' });
    await expect(banner.getByRole('link', { name: 'Privacidade' })).toHaveAttribute('href', 'privacy.pt.html');
    await banner.getByRole('button', { name: 'Não permitir' }).click();
    await expect(banner).toBeHidden();
  });
});

test('the footer switches the language on this device, and it sticks', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Português' }).click();
  await expect(page.getByRole('heading', { name: 'Nenhuma receita ainda' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nenhuma receita ainda' })).toBeVisible();
  await page.getByRole('link', { name: 'Nova receita' }).click();
  await expect(page.getByRole('radio', { name: 'Português' })).toBeChecked();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible();
});

test('each privacy page links to the other language', async ({ page }) => {
  await page.goto('/privacy.html');
  await page.getByRole('link', { name: 'Em português' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Privacidade' })).toBeVisible();
  await page.getByRole('link', { name: 'In English' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
});
