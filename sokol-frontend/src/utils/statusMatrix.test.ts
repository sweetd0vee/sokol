import { describe, expect, it } from 'vitest';
import {
  buildStatusMatrixColumnShares,
  buildStatusMatrixHtmlMarkup,
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

describe('status matrix export markup', () => {
  it('includes every check row instead of a clipped screenshot', () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      row(`ПР-${index + 1}`, {
        completed: index,
        unresolved: 1,
        in_progress: 2,
        on_control: 3,
      }),
    );

    const markup = buildStatusMatrixHtmlMarkup(rows);
    expect(markup).toContain('Ключ проверки');
    expect(markup).toContain('Доля рекомендаций');
    rows.forEach((item) => {
      expect(markup).toContain(item.key);
    });
  });

  it('computes share percents from all rows', () => {
    const shares = buildStatusMatrixColumnShares([
      row('A', { completed: 2, unresolved: 1, in_progress: 1, on_control: 0 }),
      row('B', { completed: 2, unresolved: 1, in_progress: 1, on_control: 0 }),
    ]);
    expect(shares.find((item) => item.key === 'completed')).toEqual(
      expect.objectContaining({ count: 4, percent: 50 }),
    );
    expect(shares.find((item) => item.key === 'unresolved')).toEqual(
      expect.objectContaining({ count: 2, percent: 25 }),
    );
  });
});
