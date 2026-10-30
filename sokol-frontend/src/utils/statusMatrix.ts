import { escapeHtmlQuoted as escapeHtml } from './escapeHtml';
import type { SortDirection } from './listTable';
import { STATUS_COLORS } from './recommendationAnalytics';

export type StatusMatrixCounts = {
  completed: number;
  unresolved: number;
  in_progress: number;
  on_control: number;
};

export type StatusMatrixRow = {
  id: string;
  key: string;
  shortName: string;
  name: string;
  counts: StatusMatrixCounts;
  total: number;
};

export const STATUS_MATRIX_COLUMNS = [
  { key: 'completed', status: 'completed', label: 'Исполнено' },
  { key: 'unresolved', status: 'unresolved', label: 'Не решено' },
  { key: 'in_progress', status: 'in_progress', label: 'В процессе' },
  { key: 'on_control', status: 'on_control', label: 'На контроле' },
] as const;

export type StatusMatrixColumnKey = (typeof STATUS_MATRIX_COLUMNS)[number]['key'];

export type StatusMatrixCountSortConfig = {
  key: StatusMatrixColumnKey | null;
  direction: SortDirection;
};

export const DEFAULT_STATUS_MATRIX_COUNT_SORT: StatusMatrixCountSortConfig = {
  key: null,
  direction: 'desc',
};

export function getStatusMatrixCount(row: StatusMatrixRow, columnKey: StatusMatrixColumnKey): number {
  return row.counts[columnKey];
}

export function cycleStatusMatrixCountSort(
  prev: StatusMatrixCountSortConfig,
  key: StatusMatrixColumnKey,
): StatusMatrixCountSortConfig {
  if (prev.key !== key) {
    return { key, direction: 'desc' };
  }
  if (prev.direction === 'desc') {
    return { key, direction: 'asc' };
  }
  return { key: null, direction: 'desc' };
}

export function sortStatusMatrixRows(
  rows: StatusMatrixRow[],
  sortConfig: StatusMatrixCountSortConfig,
): StatusMatrixRow[] {
  if (!sortConfig.key) {
    return rows;
  }
  const columnKey = sortConfig.key;
  const direction = sortConfig.direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const countDelta =
      (getStatusMatrixCount(left, columnKey) - getStatusMatrixCount(right, columnKey)) * direction;
    if (countDelta !== 0) {
      return countDelta;
    }
    return left.key.localeCompare(right.key, 'ru', { numeric: true, sensitivity: 'base' });
  });
}

export const STATUS_MATRIX_LEGEND = STATUS_MATRIX_COLUMNS.map((column) => ({
  key: column.key,
  status: column.status,
  label: column.label,
  color: STATUS_COLORS[column.status],
}));

export function buildStatusMatrixColumnTotals(rows: StatusMatrixRow[]) {
  return {
    completed: rows.reduce((sum, row) => sum + row.counts.completed, 0),
    unresolved: rows.reduce((sum, row) => sum + row.counts.unresolved, 0),
    in_progress: rows.reduce((sum, row) => sum + row.counts.in_progress, 0),
    on_control: rows.reduce((sum, row) => sum + row.counts.on_control, 0),
  };
}

export function statusMatrixGrandTotal(rows: StatusMatrixRow[]) {
  const totals = buildStatusMatrixColumnTotals(rows);
  return totals.completed + totals.unresolved + totals.in_progress + totals.on_control;
}

export function formatStatusChecksCount(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) {
    return `${count} проверка`;
  }
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
    return `${count} проверки`;
  }
  return `${count} проверок`;
}

export function buildStatusMatrixColumnShares(rows: StatusMatrixRow[]) {
  const totals = buildStatusMatrixColumnTotals(rows);
  const grandTotal = statusMatrixGrandTotal(rows);
  return STATUS_MATRIX_COLUMNS.map((column) => {
    const count = totals[column.key];
    const percent = grandTotal === 0 ? 0 : Math.round((count / grandTotal) * 100);
    return {
      key: column.key,
      status: column.status,
      label: column.label,
      count,
      percent,
    };
  });
}

/** Self-contained HTML for status matrix export (no Tailwind / Recharts required). */
export function buildStatusMatrixHtmlMarkup(rows: StatusMatrixRow[]): string {
  if (rows.length === 0) {
    return '<div class="chart-html"><p style="margin:0;color:#64748b;font-size:14px">Нет данных</p></div>';
  }

  const shares = buildStatusMatrixColumnShares(rows);

  const headerCells = STATUS_MATRIX_COLUMNS.map(
    (column) =>
      `<th style="padding:8px 4px;text-align:center;font-weight:600">${escapeHtml(column.label)}</th>`,
  ).join('');

  const bodyRows = rows
    .map((row) => {
      const countCells = STATUS_MATRIX_COLUMNS.map((column) => {
        const count = getStatusMatrixCount(row, column.key);
        return `<td style="padding:8px 4px;text-align:center;font-weight:600;font-variant-numeric:tabular-nums;color:#1e293b" title="${escapeHtml(`${column.label}: ${count}`)}">${count}</td>`;
      }).join('');

      return `<tr style="border-bottom:1px solid #f3f4f6">
        <th style="padding:6px 12px;text-align:left;font-weight:500" title="${escapeHtml(row.name)}">${escapeHtml(row.key)}</th>
        <td style="padding:6px 12px;text-align:left;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(row.shortName || row.name)}">${escapeHtml(row.shortName || '—')}</td>
        ${countCells}
      </tr>`;
    })
    .join('');

  const footerShareCells = shares
    .map(
      (share) => `<td style="padding:12px 4px;text-align:center;vertical-align:top">
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
          <span style="font-size:14px;font-weight:600;color:#003366">${escapeHtml(share.label)}</span>
          <span style="font-size:14px;font-weight:600;color:#1e293b;font-variant-numeric:tabular-nums">${share.count}</span>
          <span style="font-size:14px;font-weight:500;color:#374151;font-variant-numeric:tabular-nums">${share.percent}%</span>
        </div>
      </td>`,
    )
    .join('');

  const legend = STATUS_MATRIX_LEGEND.map(
    (item) =>
      `<li style="display:inline-flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${item.color};border:1px solid rgba(0,0,0,0.1)"></span>
        <span>${escapeHtml(item.label)}</span>
      </li>`,
  ).join('');

  return `<div class="chart-html"><div data-export-html style="display:flex;flex-direction:column;gap:8px">
    <div style="border:1px solid #f3f4f6;border-radius:8px;overflow:hidden">
      <div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;table-layout:fixed">
          <colgroup>
            <col style="width:14%" />
            <col style="width:38%" />
            ${STATUS_MATRIX_COLUMNS.map(() => '<col style="width:12%" />').join('')}
          </colgroup>
          <thead>
            <tr style="border-bottom:1px solid #f3f4f6;background:#fff">
              <th style="padding:8px 12px;text-align:left;font-weight:600">Ключ проверки</th>
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
        <span style="font-weight:600;color:#003366">Итого:</span> ${escapeHtml(formatStatusChecksCount(rows.length))}
      </p>
      <ul style="display:flex;flex-wrap:wrap;gap:8px 12px;list-style:none;padding:0;margin:0;font-size:16px;color:#374151">${legend}</ul>
    </div>
  </div></div>`;
}
