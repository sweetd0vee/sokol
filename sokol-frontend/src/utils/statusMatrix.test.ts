import { describe, expect, it } from 'vitest';
import {
  cycleStatusMatrixCountSort,
  DEFAULT_STATUS_MATRIX_COUNT_SORT,
  sortStatusMatrixRows,
  type StatusMatrixRow,
} from './statusMatrix';

function row(key: string, counts: StatusMatrixRow['counts']): StatusMatrixRow {
  return {
    id: key,
    key,
    shortName: key,
    name: key,
    counts,
    total: counts.completed + counts.unresolved + counts.in_progress + counts.on_control,
  };
}

describe('status matrix sort', () => {
  it('cycles a column from desc to asc to unsorted', () => {
    const first = cycleStatusMatrixCountSort(DEFAULT_STATUS_MATRIX_COUNT_SORT, 'completed');
    expect(first).toEqual({ key: 'completed', direction: 'desc' });
    const second = cycleStatusMatrixCountSort(first, 'completed');
    expect(second).toEqual({ key: 'completed', direction: 'asc' });
    expect(cycleStatusMatrixCountSort(second, 'completed')).toEqual(DEFAULT_STATUS_MATRIX_COUNT_SORT);
  });

  it('starts a new column from desc even if another column was active', () => {
    expect(
      cycleStatusMatrixCountSort({ key: 'completed', direction: 'asc' }, 'unresolved'),
    ).toEqual({ key: 'unresolved', direction: 'desc' });
  });

  it('keeps the original order when sort is inactive', () => {
    const rows = [
      row('B', { completed: 1, unresolved: 0, in_progress: 0, on_control: 0 }),
      row('A', { completed: 3, unresolved: 0, in_progress: 0, on_control: 0 }),
    ];
    expect(sortStatusMatrixRows(rows, DEFAULT_STATUS_MATRIX_COUNT_SORT)).toBe(rows);
  });

  it('sorts by the selected status column and uses the check key as a tie-breaker', () => {
    const rows = [
      row('ПР-2', { completed: 2, unresolved: 1, in_progress: 0, on_control: 0 }),
      row('ПР-10', { completed: 2, unresolved: 4, in_progress: 0, on_control: 0 }),
      row('ПР-1', { completed: 5, unresolved: 0, in_progress: 0, on_control: 0 }),
    ];

    expect(
      sortStatusMatrixRows(rows, { key: 'completed', direction: 'desc' }).map((item) => item.key),
    ).toEqual(['ПР-1', 'ПР-2', 'ПР-10']);

    expect(
      sortStatusMatrixRows(rows, { key: 'unresolved', direction: 'asc' }).map((item) => item.key),
    ).toEqual(['ПР-1', 'ПР-2', 'ПР-10']);
  });
});
