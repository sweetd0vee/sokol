import { getMaterialityChartColor } from '../constants/analyticsPalette';
import { escapeHtmlQuoted as escapeHtml } from './escapeHtml';
import type { SortDirection } from './listTable';

export type MaterialityMatrixCounts = {
  низкий: number;
  средний: number;
  высокий: number;
};

export type MaterialityMatrixRow = {
  id: string;
  key: string;
  shortName: string;
  name: string;
  counts: MaterialityMatrixCounts;
  total: number;
};

export const MATERIALITY_MATRIX_COLUMNS = [
  { key: 'high', level: 'высокий', label: 'Высокий' },
  { key: 'medium', level: 'средний', label: 'Средний' },
  { key: 'low', level: 'низкий', label: 'Низкий' },
] as const;

export const MATERIALITY_MATRIX_TOTAL_COLUMN = {
  key: 'total',
  label: 'Всего рекомендаций',
} as const;

export type MaterialityMatrixColumnKey = (typeof MATERIALITY_MATRIX_COLUMNS)[number]['key'];
export type MaterialityMatrixSortKey = MaterialityMatrixColumnKey | typeof MATERIALITY_MATRIX_TOTAL_COLUMN.key;

export type MaterialityMatrixCountSortConfig = {
  key: MaterialityMatrixSortKey | null;
  direction: SortDirection;
};

export const DEFAULT_MATERIALITY_MATRIX_COUNT_SORT: MaterialityMatrixCountSortConfig = {
  key: null,
  direction: 'desc',
};

export function getMaterialityMatrixCount(
  row: MaterialityMatrixRow,
  columnKey: MaterialityMatrixColumnKey,
): number {
  if (columnKey === 'high') {
    return row.counts.высокий;
  }
  if (columnKey === 'medium') {
    return row.counts.средний;
  }
  return row.counts.низкий;
}

export function getMaterialityMatrixSortValue(
  row: MaterialityMatrixRow,
  columnKey: MaterialityMatrixSortKey,
): number {
  if (columnKey === 'total') {
    return row.total;
  }
  return getMaterialityMatrixCount(row, columnKey);
}

export function cycleMaterialityMatrixCountSort(
  prev: MaterialityMatrixCountSortConfig,
  key: MaterialityMatrixSortKey,
): MaterialityMatrixCountSortConfig {
  if (prev.key !== key) {
    return { key, direction: 'desc' };
  }
  if (prev.direction === 'desc') {
    return { key, direction: 'asc' };
  }
  return { key: null, direction: 'desc' };
}

export function sortMaterialityMatrixRows(
  rows: MaterialityMatrixRow[],
  sortConfig: MaterialityMatrixCountSortConfig,
): MaterialityMatrixRow[] {
  if (!sortConfig.key) {
    return rows;
  }
  const columnKey = sortConfig.key;
  const direction = sortConfig.direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const countDelta =
      (getMaterialityMatrixSortValue(left, columnKey) - getMaterialityMatrixSortValue(right, columnKey))
      * direction;
    if (countDelta !== 0) {
      return countDelta;
    }
    return left.key.localeCompare(right.key, 'ru', { numeric: true, sensitivity: 'base' });
  });
}

export const MATERIALITY_MATRIX_LEGEND = MATERIALITY_MATRIX_COLUMNS.map((column) => ({
  key: column.key,
  level: column.level,
  label: column.label,
  color: getMaterialityChartColor(column.level),
}));

export function buildMaterialityMatrixColumnTotals(rows: MaterialityMatrixRow[]) {
  return {
    high: rows.reduce((sum, row) => sum + row.counts.высокий, 0),
    medium: rows.reduce((sum, row) => sum + row.counts.средний, 0),
    low: rows.reduce((sum, row) => sum + row.counts.низкий, 0),
  };
}

export function materialityMatrixGrandTotal(rows: MaterialityMatrixRow[]) {
  const totals = buildMaterialityMatrixColumnTotals(rows);
  return totals.high + totals.medium + totals.low;
}

/** Self-contained HTML for materiality matrix export (no Tailwind / Recharts required). */
export function buildMaterialityMatrixHtmlMarkup(rows: MaterialityMatrixRow[]): string {
  if (rows.length === 0) {
    return '<div class="chart-html"><p style="margin:0;color:#64748b;font-size:14px">Нет данных</p></div>';
  }

  const totals = buildMaterialityMatrixColumnTotals(rows);
  const grandTotal = totals.high + totals.medium + totals.low;

  const headerCells = [
    ...MATERIALITY_MATRIX_COLUMNS.map(
      (column) =>
        `<th style="padding:8px 4px;text-align:center;font-weight:600">${escapeHtml(column.label)}</th>`,
    ),
    `<th style="padding:8px 4px;text-align:center;font-weight:600">${escapeHtml(MATERIALITY_MATRIX_TOTAL_COLUMN.label)}</th>`,
  ].join('');

  const bodyRows = rows
    .map((row) => {
      const countCells = MATERIALITY_MATRIX_COLUMNS.map((column) => {
        const count = getMaterialityMatrixCount(row, column.key);
        return `<td style="padding:8px 4px;text-align:center;font-weight:700;font-variant-numeric:tabular-nums;color:#111827" title="${escapeHtml(`${column.label}: ${count}`)}">${count}</td>`;
      }).join('');
      const rowTotal = row.total;

      return `<tr style="border-bottom:1px solid #f3f4f6">
        <th style="padding:6px 12px;text-align:left;font-weight:500" title="${escapeHtml(row.name)}">${escapeHtml(row.key)}</th>
        <td style="padding:6px 12px;text-align:left;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(row.shortName || row.name)}">${escapeHtml(row.shortName || '—')}</td>
        ${countCells}
        <td style="padding:8px 4px;text-align:center;font-weight:700;font-variant-numeric:tabular-nums;color:#111827" title="${escapeHtml(`${MATERIALITY_MATRIX_TOTAL_COLUMN.label}: ${rowTotal}`)}">${rowTotal}</td>
      </tr>`;
    })
    .join('');

  const footerShareCells = [
    ...MATERIALITY_MATRIX_COLUMNS.map((column) => {
      const count = totals[column.key];
      const percent = grandTotal === 0 ? 0 : Math.round((count / grandTotal) * 100);
      return `<td style="padding:12px 4px;text-align:center;vertical-align:top">
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
          <span style="font-size:14px;font-weight:600;color:#003366">${escapeHtml(column.label)}</span>
          <span style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:#fff;border:4px solid ${getMaterialityChartColor(column.level)};color:#111827;text-align:center;line-height:1.15" title="${escapeHtml(`${column.label}: ${percent}% (${count})`)}">
            <span style="font-size:12px;font-weight:700">${percent}%</span>
          </span>
          <span style="font-size:14px;font-weight:700;color:#374151;font-variant-numeric:tabular-nums">${count}</span>
        </div>
      </td>`;
    }),
    `<td style="padding:12px 4px;text-align:center;vertical-align:top">
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <span style="font-size:14px;font-weight:600;color:#003366">Всего</span>
        <span style="font-size:14px;font-weight:700;color:#374151;font-variant-numeric:tabular-nums">${grandTotal}</span>
      </div>
    </td>`,
  ].join('');

  const legend = MATERIALITY_MATRIX_LEGEND.map(
    (item) =>
      `<li style="display:inline-flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${item.color};border:1px solid rgba(0,0,0,0.1)"></span>
        <span>${escapeHtml(item.label)}</span>
      </li>`,
  ).join('');

  return `<div class="chart-html"><div data-export-html style="display:flex;flex-direction:column;gap:8px">
    <div style="border:1px solid #f3f4f6;border-radius:8px;overflow:hidden">
      <div style="overflow:auto">
        <table style="width:100%;border-collapse:collapse;font-size:14px;table-layout:fixed">
          <colgroup>
            <col style="width:12%" />
            <col style="width:40%" />
            ${MATERIALITY_MATRIX_COLUMNS.map(() => '<col style="width:11%" />').join('')}
            <col style="width:15%" />
          </colgroup>
          <thead>
            <tr style="border-bottom:1px solid #f3f4f6;background:#fff">
              <th style="padding:8px 12px;text-align:left;font-weight:600">Ключ</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600">Краткое название проверки</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
          <tfoot>
            <tr style="border-top:1px solid #e5e7eb;background:#f9fafb">
              <th colspan="2" style="padding:12px;text-align:left;vertical-align:top;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#003366">Доля рекомендаций</th>
              ${footerShareCells}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:8px 16px">
      <p style="margin:0;font-size:16px;color:#374151">
        <span style="font-weight:600;color:#003366">Итого:</span> ${escapeHtml(formatMaterialityChecksCount(rows.length))}
      </p>
      <ul style="display:flex;flex-wrap:wrap;gap:8px 12px;list-style:none;padding:0;margin:0;font-size:16px;color:#374151">${legend}</ul>
    </div>
  </div></div>`;
}

export function formatMaterialityChecksCount(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) {
    return `${count} проверка`;
  }
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
    return `${count} проверки`;
  }
  return `${count} проверок`;
}
