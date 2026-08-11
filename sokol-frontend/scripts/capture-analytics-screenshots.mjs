/**
 * Captures analytics tab screenshots for ANALYTICS_TZ.docx.
 * Requires: frontend dev server on http://localhost:5180
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../docs/analytics-screenshots');
const BASE_URL = process.env.SOKOL_UI_URL ?? 'http://localhost:5180';

const TABS = [
  { label: 'Проверки', file: 'tab-checks.png' },
  { label: 'Рекомендации', file: 'tab-recommendations.png' },
  { label: 'Мониторинг', file: 'tab-monitoring.png' },
  { label: 'ДВА', file: 'tab-dva.png' },
];

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('Введите Фамилию И.О.').fill('Иванов И.О.');
  await page.getByPlaceholder('Введите пароль').fill('demo');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL('**/checks**', { timeout: 30000 });
}

async function waitForAnalytics(page) {
  await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Аналитика' }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 980 } });

  try {
    await login(page);
    await waitForAnalytics(page);

    await page.screenshot({
      path: join(OUT_DIR, 'analytics-overview-checks.png'),
      fullPage: true,
    });

    for (const tab of TABS) {
      await page.getByRole('button', { name: tab.label, exact: true }).click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(OUT_DIR, tab.file), fullPage: true });
      console.log(`Saved ${tab.file}`);
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
