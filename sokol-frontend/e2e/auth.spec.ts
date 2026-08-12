import { expect, test } from '@playwright/test';

test('unauthenticated users land on the login page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'SOKOL' })).toBeVisible();
  await expect(page.getByPlaceholder('admin или Фамилия И.О.')).toBeVisible();
  await expect(page.getByPlaceholder('Введите пароль')).toBeVisible();
});

test('login form validates empty credentials without API call', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('button', { name: 'Войти' }).click();

  await expect(page.getByText('Введите логин admin / auditor или Фамилию И.О.')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
