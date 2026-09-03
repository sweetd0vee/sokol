/**
 * Captures analytics tab and per-chart screenshots for the analytics guide DOCX.
 * Requires: frontend on http://localhost:5180 and backend with demo data.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../docs/analytics-screenshots');
const BASE_URL = process.env.SOKOL_UI_URL ?? 'http://localhost:5180';

const LOGIN_ATTEMPTS = [
  { login: 'admin', password: 'admin' },
  { login: 'auditor', password: 'auditor' },
  { login: 'Иванов И.О.', password: 'demo' },
];

const TABS = [
  {
    label: 'Проверки',
    file: 'tab-checks.png',
    charts: [
      { title: 'Итого', file: 'checks-summary.png' },
      { title: 'Количество проверок', file: 'checks-dynamics.png' },
      { title: 'Виды проверок', file: 'checks-views.png' },
      { title: 'Типы проверок', file: 'checks-types.png' },
      { title: 'Карта департаментов (ТОП-10)', file: 'checks-department-map.png' },
      { title: 'Оценка эффективности', file: 'checks-effectiveness.png' },
    ],
  },
  {
    label: 'Рекомендации',
    file: 'tab-recommendations.png',
    charts: [
      { title: 'Итого', file: 'recommendations-summary.png' },
      { title: 'Существенность', file: 'recommendations-materiality.png' },
      { title: 'Матрица существенности', file: 'recommendations-materiality-matrix.png' },
      { title: 'Статусы по периодам', file: 'recommendations-status-by-period.png' },
      { title: 'Карта департаментов (ТОП-10)', file: 'recommendations-department-map.png' },
    ],
  },
  {
    label: 'Мониторинг',
    file: 'tab-monitoring.png',
    charts: [
      { title: 'Итого', file: 'monitoring-summary.png' },
      { title: 'Статусы', file: 'monitoring-statuses.png' },
      { title: 'Дополнительные статусы', file: 'monitoring-additional-statuses.png' },
      { title: 'Перенос срока', file: 'monitoring-deadline-extensions.png' },
      { title: 'Исполнено в ходе аудита', file: 'monitoring-completed-during-audit.png' },
      { title: 'Матрица статусов', file: 'monitoring-status-matrix.png' },
    ],
  },
  {
    label: 'ДВА',
    file: 'tab-dva.png',
    charts: [
      { title: 'Итого', file: 'dva-summary.png' },
      { title: 'Карта сотрудников по проверкам', file: 'dva-auditor-checks-map.png' },
      { title: 'Импакт рекомендаций', file: 'dva-auditor-impact.png' },
      { title: 'Результативность исполнения', file: 'dva-auditor-execution.png' },
      { title: 'Своевременность', file: 'dva-auditor-timeliness.png' },
      { title: 'Документная дисциплина', file: 'dva-auditor-documents.png' },
    ],
  },
];

async function login(page) {
  let lastError = null;
  for (const attempt of LOGIN_ATTEMPTS) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('admin или Фамилия И.О.').fill(attempt.login);
    await page.getByPlaceholder('Введите пароль').fill(attempt.password);
    await page.getByRole('button', { name: 'Войти' }).click();
    try {
      await page.waitForURL('**/checks**', { timeout: 15000 });
      console.log(`Logged in as ${attempt.login}`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Login failed for ${attempt.login}`);
    }
  }
  throw lastError ?? new Error('Could not log in with any known demo credentials');
}

async function waitForDashboard(page) {
  await page.getByRole('heading', { name: 'Итого', exact: true }).waitFor({ timeout: 30000 });
  await page.getByText('Загрузка').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

async function screenshotCard(page, title, file) {
  const heading = page.getByText(title, { exact: true }).first();
  try {
    await heading.waitFor({ state: 'visible', timeout: 8000 });
  } catch {
    console.warn(`Skip ${file}: heading "${title}" not found`);
    return;
  }
  await heading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const card = heading.locator('xpath=ancestor::section[1]');
  await card.screenshot({ path: join(OUT_DIR, file) });
  console.log(`Saved ${file}`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1100 } });

  try {
    await login(page);
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Аналитика' }).waitFor({ timeout: 30000 });
    await waitForDashboard(page);

    const headerBlock = page.locator('div.space-y-3').first();
    await headerBlock.screenshot({ path: join(OUT_DIR, 'analytics-header-tabs.png') });
    console.log('Saved analytics-header-tabs.png');

    const sidebar = page.locator('aside').first();
    await sidebar.screenshot({ path: join(OUT_DIR, 'filters-sidebar.png') });
    console.log('Saved filters-sidebar.png');

    await page.screenshot({
      path: join(OUT_DIR, 'analytics-overview-checks.png'),
      fullPage: true,
    });

    for (const tab of TABS) {
      await page.getByRole('button', { name: tab.label, exact: true }).click();
      await waitForDashboard(page);
      await page.screenshot({ path: join(OUT_DIR, tab.file), fullPage: true });
      console.log(`Saved ${tab.file}`);

      for (const chart of tab.charts) {
        await screenshotCard(page, chart.title, chart.file);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`Screenshots saved to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
