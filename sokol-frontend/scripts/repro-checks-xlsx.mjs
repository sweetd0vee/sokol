import XLSX from 'xlsx-js-style';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BORDER_GRAY = 'D1D5DB';
const HEADER_BLUE = '003366';
const WHITE = 'FFFFFF';
const CHECK_STATUS_FILLS = {
  Запланировано: 'E5E7EB',
  'В процессе': 'FEF9C3',
  Завершено: 'DCFCE7',
};

function getCellBorderStyle() {
  return {
    top: { style: 'thin', color: { rgb: BORDER_GRAY } },
    bottom: { style: 'thin', color: { rgb: BORDER_GRAY } },
    left: { style: 'thin', color: { rgb: BORDER_GRAY } },
    right: { style: 'thin', color: { rgb: BORDER_GRAY } },
  };
}

function applySheetTableStyle(ws, headers, rows) {
  const ref = ws['!ref'];
  const range = XLSX.utils.decode_range(ref);
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = ws[cellAddress];
      if (!cell) continue;
      const isHeader = row === range.s.r;
      const header = headers[col - range.s.c];
      const valueFill = !isHeader && header === 'Статус' ? CHECK_STATUS_FILLS[cell.v] : undefined;
      cell.s = {
        font: { name: 'Times New Roman', sz: 12, bold: isHeader, color: isHeader ? { rgb: WHITE } : { rgb: '111827' } },
        fill: isHeader
          ? { fgColor: { rgb: HEADER_BLUE } }
          : valueFill
            ? { fgColor: { rgb: valueFill } }
            : undefined,
        alignment: {
          horizontal: isHeader || valueFill ? 'center' : 'left',
          vertical: 'center',
          wrapText: true,
        },
        border: getCellBorderStyle(),
      };
    }
  }
  ws['!cols'] = headers.map((header) => {
    const maxLength = Math.max(header.length, ...rows.map((row) => String(row[header] ?? '').length));
    return { wch: Math.min(Math.max(maxLength + 2, 12), 42) };
  });
}

const rows = Array.from({ length: 80 }, (_, i) => ({
  ID: `26-${i + 1}`,
  Ключ: `26KVS${i + 1}`,
  'Название проверки': `Очень длинное название проверки номер ${i + 1} чтобы текст переносился в ячейке Excel и занимал много места на печатной странице`,
  'Тип проверки': 'Плановая',
  Вид: 'ИТ',
  'Квартал проверки': 1,
  'Дата начала': '01.01.2026',
  'Руководитель проверки': 'Иванов И.И.',
  Статус: 'В процессе',
}));
const headers = Object.keys(rows[0]);
const ws = XLSX.utils.json_to_sheet(rows);
console.log('!ref after json_to_sheet', ws['!ref']);
console.log('cell count', Object.keys(ws).filter((k) => !k.startsWith('!')).length);
applySheetTableStyle(ws, headers, rows);
console.log('!ref after style', ws['!ref']);
console.log('!views', ws['!views']);
console.log('!pageSetup', ws['!pageSetup']);
console.log('!margins', ws['!margins']);

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Проверки');
console.log('wb.Workbook', JSON.stringify(wb.Workbook));
console.log('wb.SheetNames', wb.SheetNames);

const dir = join(tmpdir(), 'sokol-xlsx-repro');
mkdirSync(dir, { recursive: true });
const file = join(dir, 'checks.xlsx');
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true });
writeFileSync(file, buf);

const unzipDir = join(dir, 'unzipped');
execSync(`rm -rf "${unzipDir}" && mkdir -p "${unzipDir}" && unzip -q -o "${file}" -d "${unzipDir}"`);
const sheet = readFileSync(join(unzipDir, 'xl/worksheets/sheet1.xml'), 'utf8');
const dim = sheet.match(/<dimension[^>]*>/);
const pageSetup = sheet.match(/<pageSetup[^/]*\/>/);
const sheetViews = sheet.match(/<sheetViews[\s\S]*?<\/sheetViews>/);
const printOptions = sheet.match(/<printOptions[^/]*\/>/);
const pageMargins = sheet.match(/<pageMargins[^/]*\/>/);
const rowCount = (sheet.match(/<row /g) || []).length;
const cCount = (sheet.match(/<c /g) || []).length;
console.log({
  dim,
  pageSetup,
  printOptions,
  pageMargins,
  rowCount,
  cCount,
  sheetViews: sheetViews?.[0]?.slice(0, 800),
});
console.log('sheet xml length', sheet.length);
console.log('file', file);
