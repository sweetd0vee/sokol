import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5180';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
await page.getByPlaceholder('admin или Фамилия И.О.').fill('admin');
await page.getByPlaceholder('Введите пароль').fill('admin');
await page.getByRole('button', { name: 'Войти' }).click();
await page.waitForURL('**/checks**', { timeout: 15000 });
await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Мониторинг' }).click();
await page.getByRole('heading', { name: 'Матрица статусов' }).waitFor({ timeout: 20000 });
await page.waitForTimeout(1000);

const report = await page.evaluate(() => {
  const headings = [...document.querySelectorAll('h3')];
  const visibleCard = (title) => {
    const heading = headings.find((el) => {
      if (el.textContent?.trim() !== title) return false;
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.width > 0;
    });
    return heading?.closest('section') ?? null;
  };
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
  };
  const overlap = (a, b) => a && b && a.top < b.bottom && a.bottom > b.top;
  const titles = [
    'Итого',
    'Статусы',
    'Дополнительные статусы',
    'Перенос срока',
    'Исполнено в ходе аудита',
    'Матрица статусов',
  ];
  const boxes = Object.fromEntries(titles.map((title) => [title, box(visibleCard(title))]));
  const matrix = boxes['Матрица статусов'];
  const overlaps = titles
    .filter((title) => title !== 'Матрица статусов')
    .filter((title) => overlap(matrix, boxes[title]));
  const section = visibleCard('Матрица статусов');
  const table = section?.querySelector('table');
  const innerScrollers = section
    ? [...section.querySelectorAll('*')].flatMap((el) => {
        const overflowY = getComputedStyle(el).overflowY;
        if (overflowY !== 'auto' && overflowY !== 'scroll') return [];
        if (el.scrollHeight <= el.clientHeight + 2) return [];
        return [{ className: String(el.className).slice(0, 80), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }];
      })
    : [{ error: 'card missing' }];
  return {
    boxes,
    overlaps,
    rowCount: table ? table.querySelectorAll('tbody tr').length : 0,
    tableHeight: table ? Math.round(table.getBoundingClientRect().height) : 0,
    innerScrollers,
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
if (report.overlaps.length || report.innerScrollers.length || !report.rowCount) {
  process.exit(1);
}
console.log('OK');
