import { describe, expect, it } from 'vitest';
import {
  cycleMaterialityMatrixCountSort,
  DEFAULT_MATERIALITY_MATRIX_COUNT_SORT,
  sortMaterialityMatrixRows,
  type MaterialityMatrixRow,
} from './materialityMatrix';

function row(
  key: string,
  counts: MaterialityMatrixRow['counts'],
): MaterialityMatrixRow {
  return {
    id: key,
    key,
    shortName: key,
    name: key,
    counts,
    total: counts.высокий + counts.средний + counts.низкий,
  };
}

describe('materiality matrix sort', () => {
  it('cycles a column from desc to asc to unsorted', () => {
    const first = cycleMaterialityMatrixCountSort(DEFAULT_MATERIALITY_MATRIX_COUNT_SORT, 'high');
    expect(first).toEqual({ key: 'high', direction: 'desc' });
    const second = cycleMaterialityMatrixCountSort(first, 'high');
    expect(second).toEqual({ key: 'high', direction: 'asc' });
    expect(cycleMaterialityMatrixCountSort(second, 'high')).toEqual(DEFAULT_MATERIALITY_MATRIX_COUNT_SORT);
  });

  it('starts a new column from desc even if another column was active', () => {
    expect(
      cycleMaterialityMatrixCountSort({ key: 'high', direction: 'asc' }, 'low'),
    ).toEqual({ key: 'low', direction: 'desc' });
  });

  it('keeps the original order when sort is inactive', () => {
    const rows = [
      row('B', { высокий: 1, средний: 0, низкий: 0 }),
      row('A', { высокий: 3, средний: 0, низкий: 0 }),
    ];
    expect(sortMaterialityMatrixRows(rows, DEFAULT_MATERIALITY_MATRIX_COUNT_SORT)).toBe(rows);
  });

  it('sorts by the selected materiality column and uses the check key as a tie-breaker', () => {
    const rows = [
      row('ПР-2', { высокий: 2, средний: 1, низкий: 0 }),
      row('ПР-10', { высокий: 2, средний: 4, низкий: 0 }),
      row('ПР-1', { высокий: 5, средний: 0, низкий: 0 }),
    ];

    expect(
      sortMaterialityMatrixRows(rows, { key: 'high', direction: 'desc' }).map((item) => item.key),
    ).toEqual(['ПР-1', 'ПР-2', 'ПР-10']);

    expect(
      sortMaterialityMatrixRows(rows, { key: 'medium', direction: 'asc' }).map((item) => item.key),
    ).toEqual(['ПР-1', 'ПР-2', 'ПР-10']);
  });

  it('sorts by total recommendations per check', () => {
    const rows = [
      row('A', { высокий: 1, средний: 1, низкий: 1 }),
      row('B', { высокий: 5, средний: 0, низкий: 0 }),
      row('C', { высокий: 2, средний: 2, низкий: 2 }),
    ];

    expect(
      sortMaterialityMatrixRows(rows, { key: 'total', direction: 'desc' }).map((item) => item.key),
    ).toEqual(['C', 'B', 'A']);
  });
});
