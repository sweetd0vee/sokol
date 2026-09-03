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
await page.getByRole('heading', { name: 'Оценка эффективности' }).waitFor({ timeout: 20000 });
await page.waitForTimeout(800);

const report = await page.evaluate(() => {
  const headings = [...document.querySelectorAll('h3')];
  const card = (title) => headings.find((el) => el.textContent?.trim() === title)?.closest('section');
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), height: Math.round(r.height), width: Math.round(r.width) };
  };
  const overlap = (a, b) => {
    if (!a || !b) return false;
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  };
  const titles = [
    'Итого',
    'Количество проверок',
    'Виды проверок',
    'Типы проверок',
    'Карта департаментов (ТОП-10)',
    'Оценка эффективности',
  ];
  const boxes = Object.fromEntries(titles.map((title) => [title, box(card(title))]));
  const matrix = boxes['Оценка эффективности'];
  const overlaps = titles
    .filter((title) => title !== 'Оценка эффективности')
    .filter((title) => overlap(matrix, boxes[title]));

  const grid = document.querySelector('.react-grid-layout');
  const gridWrap = grid?.parentElement?.parentElement;
  return {
    boxes,
    overlaps,
    grid: box(grid),
    gridWrap: box(gridWrap),
    gridWrapClass: gridWrap?.className,
    gridHeightStyle: grid instanceof HTMLElement ? grid.style.height : null,
    keepAlive: [...document.querySelectorAll('body div')].filter((el) => el.className === 'w-full' || el.className === 'hidden').slice(0, 8).map((el) => ({
      className: el.className,
      height: Math.round(el.getBoundingClientRect().height),
      child: el.querySelector('h3')?.textContent,
    })),
  };
});

console.log(JSON.stringify(report, null, 2));
if (report.overlaps.length) {
  console.error('FAIL: matrix overlaps', report.overlaps);
  process.exitCode = 1;
} else {
  console.log('OK: no overlap');
}

await browser.close();
