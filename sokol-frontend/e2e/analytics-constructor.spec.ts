import { expect, test, type Page } from '@playwright/test';

async function mockAuthenticatedApi(page: Page) {
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

  await page.route('**/api/v1/analytics/checks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        universeTotal: 10,
        filteredTotal: 10,
        granularity: 'year',
        summary: { total: 10, not_started: 1, in_progress: 2, completed: 7 },
        completionShare: 70,
        periodSeries: [
          {
            key: '2025',
            label: '2025',
            sortKey: 2025,
            total: 10,
            not_started: 1,
            in_progress: 2,
            completed: 7,
            cumulative: 10,
          },
        ],
        viewDistribution: [{ name: 'Комплексная', value: 6 }],
        typeDistribution: [{ name: 'Плановая', value: 8 }],
        departmentMap: [{ name: 'ДВА', value: 5 }],
        effectivenessMatrix: [],
        filterOptions: {
          auditors: ['Иванов'],
          departments: ['ДВА'],
          anchorDates: ['2025-01-15'],
        },
      }),
    });
  });
}

async function loginAsAuditor(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('admin или Фамилия И.О.').fill('auditor');
  await page.getByPlaceholder('Введите пароль').fill('password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/checks$/);
}

test('constructor history can create a dashboard and accept charts from analytics', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await loginAsAuditor(page);

  await page.getByRole('link', { name: 'Конструктор' }).click();
  await expect(page).toHaveURL(/\/constructor$/);
  await expect(page.getByRole('heading', { name: 'Конструктор дашбордов' })).toBeVisible();
  await expect(page.getByText('Пока нет дашбордов')).toBeVisible();

  await page.getByRole('button', { name: 'Создать дашборд' }).click();
  await page.getByLabel('Название').fill('Отчёт E2E');
  await page.getByRole('button', { name: 'Создать' }).click();
  await expect(page).toHaveURL(/\/constructor\/.+/);
  await expect(page.getByRole('heading', { name: 'Отчёт E2E' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Пустой лист отчёта' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Экспорт' })).toBeDisabled();

  await page.getByRole('link', { name: 'Аналитика' }).click();
  await expect(page).toHaveURL(/\/analytics$/);
  await expect(page.getByRole('heading', { name: 'Количество проверок' })).toBeVisible();

  await page.getByRole('button', { name: 'В конструктор', exact: true }).first().click();
  await page.getByRole('button', { name: 'Добавить в конструктор (1)' }).click();
  await expect(page.getByRole('button', { name: 'Добавлено' })).toBeVisible();

  await page.getByRole('link', { name: 'Конструктор' }).click();
  await expect(page.getByRole('link', { name: 'Отчёт E2E' })).toBeVisible();
  await expect(page.getByText('Текущий')).toBeVisible();

  await page.getByRole('button', { name: 'Создать дашборд' }).click();
  await page.getByLabel('Название').fill('Второй лист');
  await page.getByRole('button', { name: 'Создать' }).click();
  await page.getByRole('link', { name: 'К списку дашбордов' }).click();
  await page.getByPlaceholder('Название').fill('Отчёт');
  await expect(page.getByRole('link', { name: 'Отчёт E2E' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Второй лист' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await expect(page.getByRole('link', { name: 'Второй лист' })).toBeVisible();
  await page.getByRole('button', { name: 'Название' }).click();
  await page.getByRole('button', { name: 'Ещё действия для «Отчёт E2E»' }).click();
  await page.getByRole('button', { name: 'Сделать текущим' }).click();
  await expect(page.getByText('Текущий')).toBeVisible();

  await page.getByRole('link', { name: /Редактировать «Отчёт E2E»/ }).click();
  await expect(page.getByRole('heading', { name: 'Итого' })).toBeVisible();
  await expect(page.getByText('Проверки', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Экспорт' })).toBeEnabled();

  await page.getByRole('button', { name: 'Удалить с дашборда' }).click();
  await expect(page.getByRole('heading', { name: 'Пустой лист отчёта' })).toBeVisible();
});
