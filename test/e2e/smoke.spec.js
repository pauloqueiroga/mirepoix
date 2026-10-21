import { expect, test } from '@playwright/test';

test('the app starts under the production security policy', async ({ page }) => {
  /** @type {string[]} */
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));

  await page.goto('/');

  await expect(page).toHaveTitle('Mirepoix');
  await expect(page.getByRole('heading', { name: 'Mirepoix' })).toBeVisible();
  expect(problems).toEqual([]);
});
