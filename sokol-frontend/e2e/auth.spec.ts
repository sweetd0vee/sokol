import { expect, test } from '@playwright/test';

async function mockAuthenticatedApi(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'e2e-access-token',
        token_type: 'bearer',
        username: 'auditor',
        display_name: 'Аудитор E2E',
        role: 'auditor',
      }),
    });
  });

  await page.route('**/api/v1/auth/change-password', async (route) => {
    const payload = route.request().postDataJSON() as {
      current_password?: string;
      new_password?: string;
    };

    if (payload.current_password !== 'old-password') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Текущий пароль указан неверно.' }),
      });
      return;
    }

    await route.fulfill({ status: 204 });
  });

  await page.route('**/api/v1/checks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0 }),
    });
  });

  await page.route('**/api/v1/recommendations**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0 }),
    });
  });

  await page.route('**/api/v1/settings/auditors**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0 }),
    });
  });
}

async function loginAsAuditor(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder('admin или Фамилия И.О.').fill('auditor');
  await page.getByPlaceholder('Введите пароль').fill('password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/checks$/);
}

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

test('successful login stores session and opens checks', async ({ page }) => {
  await mockAuthenticatedApi(page);

  await loginAsAuditor(page);

  await expect(page.getByRole('heading', { name: 'Проверки' })).toBeVisible();
  await expect(page.getByTitle('Профиль')).toContainText('auditor');
  await expect(page.evaluate(() => localStorage.getItem('sokol_auth'))).resolves.toContain('e2e-access-token');
});

test('logout clears session and returns to login', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await loginAsAuditor(page);

  await page.getByRole('button', { name: 'Выйти' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.evaluate(() => localStorage.getItem('sokol_auth'))).resolves.toBeNull();
});

test('profile change password handles success and API error', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await loginAsAuditor(page);

  await page.getByTitle('Профиль').click();
  await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();

  await page.getByLabel('Текущий пароль').fill('old-password');
  await page.getByLabel('Новый пароль').fill('new-password');
  await page.getByLabel('Подтверждение нового пароля').fill('new-password');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('status')).toHaveText('Пароль успешно изменён.');

  await page.getByLabel('Текущий пароль').fill('wrong-password');
  await page.getByLabel('Новый пароль').fill('next-password');
  await page.getByLabel('Подтверждение нового пароля').fill('next-password');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('alert')).toHaveText('Текущий пароль указан неверно.');
});
