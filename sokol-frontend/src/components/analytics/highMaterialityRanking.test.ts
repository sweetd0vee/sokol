import { describe, expect, it } from 'vitest';
import type { PlanningHighMaterialityDepartmentRow } from '../../api/analytics';
import { cycleHighMaterialitySort, sortHighMaterialityRows } from './highMaterialityRanking';

function row(
  name: string,
  value: number,
  total: number,
  checks: number,
): PlanningHighMaterialityDepartmentRow {
  return {
    name,
    value,
    total,
    checks: Array.from({ length: checks }, (_, index) => ({
      key: `${name}-${index}`,
      short_name: name,
      count: 1,
    })),
  };
}

describe('high materiality ranking', () => {
  const rows = [
    row('Кредит', 47, 196, 17),
    row('Поволжье', 10, 28, 3),
    row('Риски', 41, 166, 14),
  ];

  it('starts a new column from descending', () => {
    expect(cycleHighMaterialitySort({ key: 'value', direction: 'desc' }, 'share')).toEqual({
      key: 'share',
      direction: 'desc',
    });
  });

  it('toggles the active column between desc and asc', () => {
    const next = cycleHighMaterialitySort({ key: 'share', direction: 'desc' }, 'share');
    expect(next).toEqual({ key: 'share', direction: 'asc' });
    expect(cycleHighMaterialitySort(next, 'share')).toEqual({ key: 'share', direction: 'desc' });
  });

  it('sorts by share so concentrated departments rise', () => {
    const ranked = sortHighMaterialityRows(rows, { key: 'share', direction: 'desc' });
    expect(ranked.map((item) => item.name)).toEqual(['Поволжье', 'Риски', 'Кредит']);
  });

  it('sorts by check count', () => {
    const ranked = sortHighMaterialityRows(rows, { key: 'checks', direction: 'desc' });
    expect(ranked.map((item) => item.name)).toEqual(['Кредит', 'Риски', 'Поволжье']);
  });
});
