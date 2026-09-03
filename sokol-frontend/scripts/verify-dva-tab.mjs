import { chromium } from 'playwright';

const BASE_URL = process.env.SOKOL_UI_URL ?? 'http://localhost:5180';
const LOGIN_ATTEMPTS = [
  { login: 'admin', password: 'admin' },
  { login: 'auditor', password: 'auditor' },
  { login: 'Иванов И.О.', password: 'demo' },
];
const TITLES = [
  'Итого',
  'Нагрузка сотрудников',
  'Импакт рекомендаций',
  'Результативность исполнения',
  'Своевременность',
  'Документная дисциплина',
];

async function login(page) {
  for (const attempt of LOGIN_ATTEMPTS) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('admin или Фамилия И.О.').fill(attempt.login);
    await page.getByPlaceholder('Введите пароль').fill(attempt.password);
    await page.getByRole('button', { name: 'Войти' }).click();
    try {
      await page.waitForURL('**/checks**', { timeout: 15000 });
      return attempt.login;
    } catch {
      // try next
    }
  }
  throw new Error('Could not log in');
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
try {
  const user = await login(page);
  await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ДВА', exact: true }).click();
  await page.getByRole('heading', { name: 'Итого', exact: true }).waitFor({ timeout: 30000 });
  await page.getByText('Загрузка').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const missing = [];
  for (const title of TITLES) {
    const visible = await page.getByText(title, { exact: true }).first().isVisible().catch(() => false);
    if (!visible) missing.push(title);
  }
  const kpiLabels = ['Проверки', 'Рекомендации', 'Сотрудники', 'Высокая существенность', 'Исполнение', 'Нарушение сроков'];
  const missingKpis = [];
  for (const label of kpiLabels) {
    const visible = await page.getByText(label, { exact: true }).first().isVisible().catch(() => false);
    if (!visible) missingKpis.push(label);
  }

  console.log(`logged in as ${user}`);
  console.log(`missing charts: ${missing.length ? missing.join(', ') : 'none'}`);
  console.log(`missing kpis: ${missingKpis.length ? missingKpis.join(', ') : 'none'}`);
  if (missing.length || missingKpis.length) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
