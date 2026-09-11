import type { Check } from '../../types/check';
import type { Recommendation } from '../../types/recommendation';
import { downloadBlob } from '../download';
import { indicatorIconBytesToDataUrl, preloadIndicatorIcons } from '../exportIndicatorIcons';
import {
  CHECK_COLUMN_KEYS,
  getHeaders,
  getHighlightFill,
  getMaterialityDotColor,
  HEADER_BLUE,
  INDICATOR_ICON_DISPLAY_PX,
  isIndicatorHeader,
  isMaterialityHeader,
  LIGHT_ROW_FILL,
  MATERIALITY_DOT_CHAR,
  RECOMMENDATION_TABLE_COLUMN_KEYS,
  toCellText,
  toCheckRows,
  toRecommendationTableRows,
} from './shared';
import type { ExportRow } from './types';

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildHtmlCellContent(
  header: string,
  value: unknown,
  indicatorIcons?: Map<string, Uint8Array>,
) {
  if (isMaterialityHeader(header)) {
    const color = getMaterialityDotColor(value) ?? '9CA3AF';
    return `<span style="color:#${color};font-size:18px;line-height:1">${MATERIALITY_DOT_CHAR}</span>`;
  }
  if (isIndicatorHeader(header)) {
    const label = toCellText(value);
    const icon = indicatorIcons?.get(label);
    if (icon) {
      return `<img src="${indicatorIconBytesToDataUrl(icon)}" alt="${escapeHtml(label)}" width="${INDICATOR_ICON_DISPLAY_PX}" height="${INDICATOR_ICON_DISPLAY_PX}" style="display:block;margin:0 auto" />`;
    }
    return '';
  }
  return escapeHtml(toCellText(value)).replace(/\r?\n/g, '<br>');
}

export function buildHtmlCellStyle(header: string, value: unknown) {
  const parts: string[] = [];
  const fill = getHighlightFill(header, value);
  if (fill) {
    parts.push(`background-color:#${fill}`, 'text-align:center');
  } else if (isMaterialityHeader(header) || isIndicatorHeader(header)) {
    parts.push('text-align:center');
  }
  if (isHtmlNoWrapHeader(header)) {
    parts.push('white-space:nowrap', 'word-break:normal');
  }
  return parts.length > 0 ? `${parts.join(';')};` : '';
}

export const HTML_NO_WRAP_HEADERS = new Set([
  'ID',
  'Ключ',
  'Вид',
  'Срок контроля',
  'Дата начала',
  'Аудитор',
  'Руководитель объекта аудита',
  'Руководитель проверки',
  'Статус',
  'Дополнительный статус',
]);

export function isHtmlNoWrapHeader(header: string | undefined) {
  return header !== undefined && HTML_NO_WRAP_HEADERS.has(header);
}

export function exportRowsHtml(
  rows: ExportRow[],
  headers: string[],
  title: string,
  filename: string,
  indicatorIcons?: Map<string, Uint8Array>,
) {
  const headerCells = headers
    .map((header) => `<th scope="col">${escapeHtml(header)}</th>`)
    .join('');
  const bodyRows = rows
    .map((row, rowIndex) => {
      const rowFill = rowIndex % 2 === 1 ? `background-color:#${LIGHT_ROW_FILL};` : '';
      const cells = headers
        .map((header) => {
          const value = row[header];
          const style = [rowFill, buildHtmlCellStyle(header, value)].filter(Boolean).join('');
          const nowrapClass = isHtmlNoWrapHeader(header) ? ' class="nowrap"' : '';
          return `<td${nowrapClass}${style ? ` style="${style}"` : ''}>${buildHtmlCellContent(header, value, indicatorIcons)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --brand: #003366;
      --line: #d1d5db;
      --ink: #111827;
      --muted: #5b6b7c;
      --bg: #f3f5f7;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Times New Roman", "Segoe UI", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.45;
    }
    .page {
      width: min(1400px, calc(100% - 32px));
      margin: 24px auto 48px;
    }
    .hero {
      background: #fff;
      border: 1px solid var(--line);
      border-top: 3px solid var(--brand);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 16px;
    }
    .hero h1 {
      margin: 0;
      color: var(--brand);
      font-size: 1.5rem;
      font-weight: 700;
    }
    .hero p {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 0.92rem;
    }
    .table-wrap {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: #${HEADER_BLUE};
      color: #fff;
      font-weight: 700;
      text-align: center;
      vertical-align: middle;
      padding: 10px 12px;
      border: 1px solid var(--line);
      white-space: nowrap;
    }
    tbody td {
      padding: 8px 12px;
      border: 1px solid var(--line);
      vertical-align: middle;
      word-break: break-word;
    }
    tbody td.nowrap {
      white-space: nowrap;
      word-break: normal;
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="hero">
      <h1>${escapeHtml(title)}</h1>
      <p>Сформировано: ${escapeHtml(new Date().toLocaleString('ru-RU'))} · Записей: ${rows.length}</p>
    </header>
    <div class="table-wrap">
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), filename);
}

export function exportChecksHtml(checks: Check[], filename: string, yearlyNumbers: Map<string, number>) {
  const rows = toCheckRows(checks, yearlyNumbers);
  exportRowsHtml(rows, getHeaders(rows, CHECK_COLUMN_KEYS), 'Проверки — Сокол', filename);
}

export async function exportRecommendationsTableHtml(
  recommendations: Recommendation[],
  checks: Check[],
  filename: string,
  yearlyNumbers: Map<string, number>,
) {
  const rows = toRecommendationTableRows(recommendations, checks, yearlyNumbers);
  const indicatorIcons = await preloadIndicatorIcons(rows.map((row) => toCellText(row.Индикатор)));
  exportRowsHtml(
    rows,
    getHeaders(rows, RECOMMENDATION_TABLE_COLUMN_KEYS),
    'Рекомендации — Сокол',
    filename,
    indicatorIcons
  );
}
