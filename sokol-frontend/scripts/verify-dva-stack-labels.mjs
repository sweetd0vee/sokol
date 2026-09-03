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
  throw lastError ?? new Error('Could not log in');
}

async function screenshotCard(page, title, file) {
  const heading = page.getByText(title, { exact: true }).first();
  await heading.waitFor({ state: 'visible', timeout: 15000 });
  await heading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const card = heading.locator('xpath=ancestor::section[1]');
  await card.screenshot({ path: join(OUT_DIR, file) });
  console.log(`Saved ${file}`);
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1680, height: 1100 } });
mkdirSync(OUT_DIR, { recursive: true });
try {
  await login(page);
  await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Аналитика' }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'ДВА', exact: true }).click();
  await page.getByRole('heading', { name: 'Итого', exact: true }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Рекомендации', exact: true }).click();
  await page.getByRole('heading', { name: 'Итого', exact: true }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
  await screenshotCard(page, 'Существенность', 'recommendations-materiality-labels-check.png');
} finally {
  await browser.close();
}
