import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const outDir = 'C:/Users/audit/.cursor/projects/c-Users-audit-Work-sokol/tmp-chart-verify';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1680, height: 980 } });
page.setDefaultTimeout(15000);

await page.goto('http://127.0.0.1:5180/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${outDir}/debug-login.png` });
console.log('url', page.url());
console.log('placeholders', await page.locator('input').evaluateAll((els) => els.map((el) => ({ type: el.type, placeholder: el.placeholder, name: el.name }))));

await page.getByPlaceholder('admin или Фамилия И.О.').fill('Иванов И.О.');
await page.getByPlaceholder('Введите пароль').fill('demo');
await page.getByRole('button', { name: 'Войти' }).click();
await page.waitForTimeout(4000);
console.log('after click', page.url());
await page.screenshot({ path: `${outDir}/debug-after-login.png` });
const err = await page.locator('.text-red-600').textContent().catch(() => null);
console.log('error', err);

await browser.close();
