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
  { login: 'auditor', password: 'auditor' },
  { login: 'Иванов И.О.', password: 'demo' },
  { login: 'admin', password: 'admin' },
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
      { title: 'Нагрузка аудиторов: проверки', file: 'dva-auditor-load-checks.png' },
      { title: 'Нагрузка аудиторов: рекомендации', file: 'dva-auditor-load-recommendations.png' },
      { title: 'Документы и закрытие', file: 'dva-documents-closure.png' },
      { title: 'Карта аудиторов по количеству проверок', file: 'dva-auditor-checks-treemap.png' },
      { title: 'Карта аудиторов по количеству рекомендаций', file: 'dva-auditor-recommendations-treemap.png' },
    ],
  },
];

async function login(page) {
  let lastError = null;
  for (const attempt of LOGIN_ATTEMPTS) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.getByLabel('Логин').fill(attempt.login);
    await page.getByLabel('Пароль').fill(attempt.password);
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
  await page.waitForTimeout(1800);
}

async function screenshotCard(page, title, file) {
  const heading = page.getByRole('heading', { name: title, exact: true }).first();
  await heading.waitFor({ timeout: 15000 });
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
