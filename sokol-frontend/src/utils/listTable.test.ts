import { describe, expect, it } from 'vitest';
import {
  compareListValues,
  cycleSortConfig,
  matchesDateRange,
  matchesSelected,
  sortListItems,
} from './listTable';

describe('listTable helpers', () => {
  it('puts empty values after populated ones', () => {
    expect(compareListValues('', 'abc')).toBe(1);
    expect(compareListValues('abc', '')).toBe(-1);
    expect(compareListValues(2, 10)).toBeLessThan(0);
  });

  it('treats an empty selection as match-all', () => {
    expect(matchesSelected([], 'planned')).toBe(true);
    expect(matchesSelected(['planned'], 'unscheduled')).toBe(false);
  });

  it('cycles sort state from none to asc to desc to none', () => {
    const first = cycleSortConfig({ key: null, direction: 'asc' }, 'name');
    expect(first).toEqual({ key: 'name', direction: 'asc' });
    const second = cycleSortConfig(first, 'name');
    expect(second).toEqual({ key: 'name', direction: 'desc' });
    expect(cycleSortConfig(second, 'name')).toEqual({ key: null, direction: 'asc' });
  });

  it('filters a date range inclusively by calendar day', () => {
    const day = new Date(2026, 2, 15).getTime();
    expect(matchesDateRange(day, new Date(2026, 2, 15), new Date(2026, 2, 15))).toBe(true);
    expect(matchesDateRange(day, new Date(2026, 2, 16), null)).toBe(false);
    expect(matchesDateRange(null, new Date(2026, 2, 1), null)).toBe(false);
  });

  it('sorts items with the current sort config', () => {
    const items = [{ name: 'Бета' }, { name: 'Альфа' }];
    const sorted = sortListItems(items, { key: 'name', direction: 'asc' }, (item) => item.name);
    expect(sorted.map((item) => item.name)).toEqual(['Альфа', 'Бета']);
  });
});
