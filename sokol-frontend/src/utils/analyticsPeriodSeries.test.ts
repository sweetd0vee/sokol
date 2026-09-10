import { describe, expect, it } from 'vitest';
import {
  completeSelectedPeriodPoints,
  emptyChecksPeriodPoint,
  sortKeyFromPeriodKey,
  withRunningTotal,
} from './analyticsPeriodSeries';

describe('analyticsPeriodSeries', () => {
  it('sortKeyFromPeriodKey matches period key shape', () => {
    expect(sortKeyFromPeriodKey('2024', 'year')).toBe(2024);
    expect(sortKeyFromPeriodKey('2024-Q3', 'quarter')).toBe(2024 * 10 + 3);
    expect(sortKeyFromPeriodKey('2024-05', 'month')).toBe(2024 * 100 + 5);
  });

  it('completeSelectedPeriodPoints fills gaps and sorts', () => {
    const series = [
      { ...emptyChecksPeriodPoint('2024', 'year'), total: 2 },
      { ...emptyChecksPeriodPoint('2026', 'year'), total: 5 },
    ];
    const completed = withRunningTotal(
      completeSelectedPeriodPoints(series, ['2026', '2024', '2025'], (key) =>
        emptyChecksPeriodPoint(key, 'year'),
      ),
    );
    expect(completed.map((item) => item.key)).toEqual(['2024', '2025', '2026']);
    expect(completed.map((item) => item.total)).toEqual([2, 0, 5]);
    expect(completed.map((item) => item.cumulative)).toEqual([2, 2, 7]);
  });

  it('completeSelectedPeriodPoints returns series when no keys selected', () => {
    const series = [{ key: 'a', sortKey: 1, total: 1 }];
    expect(completeSelectedPeriodPoints(series, [], () => ({ key: 'x', sortKey: 0, total: 0 }))).toBe(series);
  });
});
