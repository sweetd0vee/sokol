import type { SortDirection } from './listTable';
import { getRecommendationStatusColor, STATUS_COLORS } from './recommendationAnalytics';
import type { RecommendationStatus } from '../types/recommendation';

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

export function getStatusMatrixCellColor(status: RecommendationStatus): string {
  return getRecommendationStatusColor(status);
}
