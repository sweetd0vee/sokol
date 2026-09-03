import { chromium } from 'playwright';

const BASE_URL = process.env.SOKOL_UI_URL ?? 'http://localhost:5180';
const LOGIN_ATTEMPTS = [
  { login: 'admin', password: 'admin' },
  { login: 'auditor', password: 'auditor' },
  { login: 'Иванов И.О.', password: 'demo' },
];

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1680, height: 1100 } });

try {
  let loggedIn = false;
  for (const attempt of LOGIN_ATTEMPTS) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('admin или Фамилия И.О.').fill(attempt.login);
    await page.getByPlaceholder('Введите пароль').fill(attempt.password);
    await page.getByRole('button', { name: 'Войти' }).click();
    try {
      await page.waitForURL('**/checks**', { timeout: 15000 });
      loggedIn = true;
      break;
    } catch {
      /* try next credentials */
    }
  }
  if (!loggedIn) {
    throw new Error('Could not log in');
  }

  await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ДВА', exact: true }).click();
  await page.getByRole('heading', { name: 'Итого', exact: true }).waitFor({ timeout: 30000 });
  await page.getByText('Загрузка').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const titles = await page.locator('[data-analytics-export-title]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-analytics-export-title')),
  );

  const forbidden = 'Карта сотрудников по рекомендациям';
  const required = [
    'Карта сотрудников по проверкам',
    'Импакт рекомендаций',
    'Результативность исполнения',
    'Своевременность',
    'Документная дисциплина',
  ];

  if (titles.includes(forbidden)) {
    throw new Error(`Removed chart is still visible: ${forbidden}\nTitles: ${titles.join(', ')}`);
  }
  for (const title of required) {
    if (!titles.includes(title)) {
      throw new Error(`Missing expected chart "${title}"\nTitles: ${titles.join(', ')}`);
    }
  }

  console.log('OK: DVA tab titles:', titles.join(' | '));
} finally {
  await browser.close();
}
