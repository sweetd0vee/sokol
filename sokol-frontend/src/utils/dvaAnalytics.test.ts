import { describe, expect, it } from 'vitest';
import { parseDateValue } from './dates';
import {
  buildCheckLifecycleChartModel,
  buildCheckLifecycleExportRows,
  buildLifecycleAxisTicks,
  calendarDaysBetween,
  formatDurationDays,
  formatLifecycleChecksCount,
  formatUnresolvedBarLabel,
  formatUnresolvedCheckLine,
  formatUnresolvedShare,
  rankAuditorRows,
  sortCheckLifecycleRows,
  unresolvedSharePercent,
} from './dvaAnalytics';

describe('rankAuditorRows', () => {
  it('ranks by metric and keeps a stable name order on ties', () => {
    const ranked = rankAuditorRows(
      [
        { name: 'Борисов', value: 4 },
        { name: 'Андреев', value: 4 },
        { name: 'Волков', value: 9 },
        { name: 'Громов', value: 0 },
      ],
      (row) => row.value,
      { limit: 3 },
    );

    expect(ranked.map((row) => row.name)).toEqual(['Волков', 'Андреев', 'Борисов']);
  });

  it('can surface the weakest rows first', () => {
    const ranked = rankAuditorRows(
      [
        { name: 'Иванов', readiness: 90 },
        { name: 'Петров', readiness: 20 },
      ],
      (row) => row.readiness,
      { direction: 'asc' },
    );

    expect(ranked[0]?.name).toBe('Петров');
  });
});

describe('unresolved share labels', () => {
  it('rounds the share to one decimal and formats the bar label', () => {
    expect(unresolvedSharePercent(32, 252)).toBe(12.7);
    expect(formatUnresolvedShare(32, 252)).toBe('12,7%');
    expect(formatUnresolvedBarLabel(32, 252)).toBe('32 · 12,7%');
    expect(formatUnresolvedShare(0, 0)).toBe('0%');
  });

  it('renders check keys with names and recommendation counts', () => {
    expect(
      formatUnresolvedCheckLine({ key: 'П-1', short_name: 'Казначейство', count: 12 }),
    ).toBe('П-1 — Казначейство (12)');
    expect(formatUnresolvedCheckLine({ key: 'П-2', short_name: '', count: 1 })).toBe('П-2 (1)');
  });
});

describe('check lifecycle', () => {
  it('formats calendar duration in Russian', () => {
    expect(formatDurationDays(0)).toBe('в тот же день');
    expect(formatDurationDays(1)).toBe('1 день');
    expect(formatDurationDays(2)).toBe('2 дня');
    expect(formatDurationDays(17)).toBe('17 дней');
    expect(formatLifecycleChecksCount(1)).toBe('1 проверка');
    expect(formatLifecycleChecksCount(3)).toBe('3 проверки');
    expect(formatLifecycleChecksCount(11)).toBe('11 проверок');
  });

  it('counts calendar days between local dates', () => {
    expect(calendarDaysBetween(parseDateValue('2026-01-10') ?? 0, parseDateValue('2026-01-27') ?? 0)).toBe(17);
  });

  it('labels lifecycle months as MM.YY and keeps every month on the axis', () => {
    const start = new Date(2024, 10, 15).getTime();
    const end = new Date(2025, 2, 20).getTime();
    const ticks = buildLifecycleAxisTicks(start, end);
    expect(ticks.map((tick) => tick.label)).toEqual([
      '11.24',
      '12.24',
      '01.25',
      '02.25',
      '03.25',
    ]);
  });

  it('builds four milestones and three stage segments on a shared axis', () => {
    const model = buildCheckLifecycleChartModel([
      {
        id: '1',
        key: 'П-1',
        shortName: 'Казначейство',
        auditor: 'Иванов',
        orderDate: '2026-01-10',
        programDate: '2026-01-20',
        azDate: '2026-02-15',
        dzDate: '2026-02-20',
      },
      {
        id: '2',
        key: 'П-2',
        shortName: 'Кадры',
        auditor: 'Петров',
        orderDate: '2026-03-01',
        programDate: null,
        azDate: null,
        dzDate: null,
      },
    ]);

    expect(model.rows).toHaveLength(2);
    expect(model.ticks.length).toBeGreaterThan(1);
    const first = model.rows[0];
    expect(first?.points.map((point) => point.key)).toEqual(['order', 'program', 'az', 'dz']);
    expect(first?.segments.map((segment) => segment.key)).toEqual([
      'order_to_program',
      'program_to_az',
      'az_to_dz',
    ]);
    expect(first?.segments[0]?.days).toBe(10);
    expect(first?.segments[2]?.days).toBe(5);
    expect(first?.totalDays).toBe(41);
    expect(model.rows[1]?.points).toHaveLength(1);
    expect(model.rows[1]?.segments).toHaveLength(0);
    expect(model.rows[1]?.totalDays).toBeNull();
  });

  it('connects available milestones when a middle date is missing', () => {
    const model = buildCheckLifecycleChartModel([
      {
        id: '1',
        key: 'П-1',
        shortName: 'Казначейство',
        auditor: 'Иванов',
        orderDate: '2026-01-10',
        programDate: null,
        azDate: '2026-02-15',
        dzDate: '2026-02-20',
      },
    ]);

    expect(model.rows[0]?.segments.map((segment) => segment.label)).toEqual(['Приказ → АЗ', 'АЗ → ДЗ']);
    expect(model.rows[0]?.segments[0]?.days).toBe(36);
  });

  it('sorts lifecycle rows and keeps empty totals last', () => {
    const model = buildCheckLifecycleChartModel([
      {
        id: '2',
        key: 'П-2',
        shortName: 'Кадры',
        auditor: 'Петров',
        orderDate: '2026-03-01',
        programDate: null,
        azDate: null,
        dzDate: null,
      },
      {
        id: '1',
        key: 'П-1',
        shortName: 'Казначейство',
        auditor: 'Иванов',
        orderDate: '2026-01-10',
        programDate: '2026-01-20',
        azDate: '2026-02-15',
        dzDate: '2026-02-20',
      },
      {
        id: '3',
        key: 'П-3',
        shortName: 'ИТ',
        auditor: 'Сидоров',
        orderDate: '2026-01-01',
        programDate: '2026-01-05',
        azDate: '2026-01-10',
        dzDate: '2026-01-12',
      },
    ]);

    expect(sortCheckLifecycleRows(model.rows, { key: 'auditor', direction: 'asc' }).map((row) => row.key)).toEqual([
      'П-1',
      'П-2',
      'П-3',
    ]);
    expect(sortCheckLifecycleRows(model.rows, { key: 'totalDays', direction: 'desc' }).map((row) => row.key)).toEqual([
      'П-1',
      'П-3',
      'П-2',
    ]);
    expect(sortCheckLifecycleRows(model.rows, { key: 'start', direction: 'asc' }).map((row) => row.key)).toEqual([
      'П-3',
      'П-1',
      'П-2',
    ]);
  });

  it('builds a full export table for every check instead of a clipped screenshot', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      id: String(index + 1),
      key: `П-${index + 1}`,
      shortName: `Проверка ${index + 1}`,
      auditor: `Аудитор ${index + 1}`,
      orderDate: '2026-01-01',
      programDate: '2026-01-11',
      azDate: '2026-02-01',
      dzDate: '2026-02-11',
    }));

    const exported = buildCheckLifecycleExportRows(rows);
    expect(exported).toHaveLength(12);
    expect(exported[0]?.key).toBe('П-1');
    expect(exported[11]?.key).toBe('П-12');
    expect(exported[0]?.stages).toContain('Приказ → Программа');
    expect(exported[0]?.totalDays).toBe('41 день');
  });
});

