import { toEndOfDayMs, toStartOfDayMs } from './dates';

export type SortDirection = 'asc' | 'desc';

export type SortConfig<K extends string> = {
  key: K | null;
  direction: SortDirection;
};

export function compareListValues(a: string | number | null, b: string | number | null) {
  if (a === b) {
    return 0;
  }
  if (a === null || a === undefined || a === '') {
    return 1;
  }
  if (b === null || b === undefined || b === '') {
    return -1;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b), 'ru', { numeric: true, sensitivity: 'base' });
}

export function matchesSelected(selected: string[], value: string) {
  return selected.length === 0 || selected.includes(value);
}

export function matchesDateRange(valueMs: number | null, from: Date | null, to: Date | null) {
  if (!from && !to) {
    return true;
  }
  if (valueMs === null) {
    return false;
  }
  if (from && valueMs < toStartOfDayMs(from)) {
    return false;
  }
  if (to && valueMs > toEndOfDayMs(to)) {
    return false;
  }
  return true;
}

export function cycleSortConfig<K extends string>(prev: SortConfig<K>, key: K): SortConfig<K> {
  if (prev.key !== key) {
    return { key, direction: 'asc' };
  }
  if (prev.direction === 'asc') {
    return { key, direction: 'desc' };
  }
  return { key: null, direction: 'asc' };
}

export function sortListItems<T, K extends string>(
  items: T[],
  sortConfig: SortConfig<K>,
  getSortValue: (item: T, key: K) => string | number | null,
) {
  const sortKey = sortConfig.key;
  if (!sortKey) {
    return items;
  }
  const sorted = [...items];
  sorted.sort((a, b) => {
    const cmp = compareListValues(getSortValue(a, sortKey), getSortValue(b, sortKey));
    return sortConfig.direction === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

export const LIST_PAGE_SIZE_OPTIONS = [10, 15, 20, 50, 100] as const;
export const DEFAULT_LIST_PAGE_SIZE = 50;
