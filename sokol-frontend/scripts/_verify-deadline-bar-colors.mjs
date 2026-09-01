import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../docs/analytics-screenshots');
const BASE_URL = process.env.SOKOL_UI_URL ?? 'http://localhost:5180';

const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
});
const page = await browser.newPage({ viewport: { width: 1680, height: 980 } });

try {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('admin или Фамилия И.О.').fill('admin');
  await page.getByPlaceholder('Введите пароль').fill('admin');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL('**/checks**', { timeout: 30000 });

  await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Аналитика' }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Мониторинг', exact: true }).click();
  await page.waitForTimeout(2500);

  const card = page.locator('[data-analytics-export-capture-id="deadlineExtensions"]');
  await card.waitFor({ timeout: 15000 });

  mkdirSync(OUT_DIR, { recursive: true });
  const shotPath = join(OUT_DIR, 'tab-monitoring-deadline-extensions-color-check.png');
  await card.screenshot({ path: shotPath });
  await page.screenshot({
    path: join(OUT_DIR, 'tab-monitoring-layout-check.png'),
    fullPage: true,
  });

  const fills = await card.evaluate((node) => {
    const paths = [...node.querySelectorAll('path, rect')];
    return paths
      .map((el) => ({
        tag: el.tagName,
        className: el.getAttribute('class'),
        fill: el.getAttribute('fill'),
        height: el.getAttribute('height') || el.getBoundingClientRect().height,
      }))
      .filter((item) => item.fill && item.fill !== 'none' && item.fill !== 'transparent');
  });

  console.log(JSON.stringify({ shotPath, fills }, null, 2));
} finally {
  await browser.close();
}
