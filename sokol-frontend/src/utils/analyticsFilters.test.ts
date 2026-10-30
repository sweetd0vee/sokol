import { describe, expect, it } from 'vitest';
import {
  collectCalendarPeriodOptions,
  isDateInAnySelectedPeriods,
  labelFromPeriodKey,
  periodKeysFromLabels,
} from './analyticsPeriod';

function ms(year: number, monthIndex = 0, day = 15) {
  return new Date(year, monthIndex, day).getTime();
}

describe('isDateInAnySelectedPeriods', () => {
  it('пустое выделение = все периоды', () => {
    expect(isDateInAnySelectedPeriods(ms(2027), { years: [], quarters: [], months: [] })).toBe(true);
  });

  it('выбор только годов не пропускает чужой год через пустые кварталы/месяцы', () => {
    expect(
      isDateInAnySelectedPeriods(ms(2027), {
        years: ['2025', '2026'],
        quarters: [],
        months: [],
      }),
    ).toBe(false);
    expect(
      isDateInAnySelectedPeriods(ms(2025), {
        years: ['2025', '2026'],
        quarters: [],
        months: [],
      }),
    ).toBe(true);
  });

  it('выбор только кварталов фильтрует корректно', () => {
    expect(
      isDateInAnySelectedPeriods(ms(2025, 0), {
        years: [],
        quarters: ['2025-Q1'],
        months: [],
      }),
    ).toBe(true);
    expect(
      isDateInAnySelectedPeriods(ms(2025, 6), {
        years: [],
        quarters: ['2025-Q1'],
        months: [],
      }),
    ).toBe(false);
  });

  it('выбор только месяцев фильтрует корректно', () => {
    expect(
      isDateInAnySelectedPeriods(ms(2025, 2), {
        years: [],
        quarters: [],
        months: ['2025-03'],
      }),
    ).toBe(true);
    expect(
      isDateInAnySelectedPeriods(ms(2025, 3), {
        years: [],
        quarters: [],
        months: ['2025-03'],
      }),
    ).toBe(false);
  });
});

describe('periodKeysFromLabels (галочки UI → ключи фильтра)', () => {
  const anchors = [ms(2025), ms(2026), ms(2027)];

  it('мапит выбранные подписи годов в ключи', () => {
    const options = collectCalendarPeriodOptions(anchors, 'year');
    const labels = options.filter((item) => item.key !== '2027').map((item) => item.label);
    expect(periodKeysFromLabels(anchors, 'year', labels)).toEqual(['2025', '2026']);
  });

  it('пустой список галочек даёт пустые ключи (= все периоды)', () => {
    expect(periodKeysFromLabels(anchors, 'year', [])).toEqual([]);
  });

  it('снятие одной галочки убирает ключ', () => {
    const options = collectCalendarPeriodOptions(anchors, 'year');
    const allLabels = options.map((item) => item.label);
    const without2026 = allLabels.filter((label) => !label.includes('2026'));
    expect(periodKeysFromLabels(anchors, 'year', without2026)).toEqual(['2025', '2027']);
  });

  it('подпись месяца строится из ключа, а не из порядка выбора', () => {
    const selectedLabels = ['01.11.2026', '01.01.2025', '01.09.2026'];
    const keys = periodKeysFromLabels(anchors, 'month', selectedLabels);

    expect(keys).toEqual(['2025-01', '2026-09', '2026-11']);
    expect(keys.map((key) => labelFromPeriodKey(key, 'month'))).toEqual([
      '01.01.2025',
      '01.09.2026',
      '01.11.2026',
    ]);
  });
});
