import { describe, expect, it } from 'vitest';
import {
  isConstructorMatrixChart,
  moveArrayItem,
  packNewLayouts,
  pixelHeightToGridRows,
  reorderConstructorWidgets,
} from './constructorLayout';
import type { ConstructorWidget, ConstructorWidgetLayout } from './constructorTypes';
import { buildConstructorFilterCaption } from './constructorFilterCaption';
import { buildChecksConstructorDrafts, buildDvaConstructorDrafts, buildPlanningConstructorDrafts, buildRecommendationsConstructorDrafts } from './buildConstructorWidgets';

describe('pixelHeightToGridRows', () => {
  it('rounds content height up to the next grid row', () => {
    expect(pixelHeightToGridRows(1)).toBe(1);
    expect(pixelHeightToGridRows(320)).toBe(5);
    expect(pixelHeightToGridRows(321)).toBe(6);
  });

  it('respects a minimum row count', () => {
    expect(pixelHeightToGridRows(40, 6)).toBe(6);
  });
});

describe('isConstructorMatrixChart', () => {
  it('detects matrix payloads', () => {
    expect(isConstructorMatrixChart('effectiveness-matrix')).toBe(true);
    expect(isConstructorMatrixChart('check-lifecycle')).toBe(true);
    expect(isConstructorMatrixChart('donut')).toBe(false);
  });
});

describe('packNewLayouts', () => {
  it('starts at the origin on an empty board', () => {
    const packed = packNewLayouts([], [
      { w: 6, h: 4, minW: 3, minH: 3 },
      { w: 6, h: 4, minW: 3, minH: 3 },
    ]);
    expect(packed).toEqual([
      { x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
      { x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
    ]);
  });

  it('wraps to the next row and appends below existing widgets', () => {
    const packed = packNewLayouts(
      [{ x: 0, y: 0, w: 12, h: 2 }],
      [
        { w: 8, h: 4, minW: 4, minH: 3 },
        { w: 6, h: 4, minW: 3, minH: 3 },
      ],
    );
    expect(packed[0]).toMatchObject({ x: 0, y: 2, w: 8, h: 4 });
    expect(packed[1]).toMatchObject({ x: 0, y: 6, w: 6, h: 4 });
  });
});

describe('moveArrayItem', () => {
  it('moves an item to a new index', () => {
    expect(moveArrayItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveArrayItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveArrayItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
  });

  it('returns the same array when the move is a no-op', () => {
    const items = ['a', 'b'];
    expect(moveArrayItem(items, 1, 1)).toBe(items);
    expect(moveArrayItem(items, -1, 0)).toBe(items);
    expect(moveArrayItem(items, 0, 2)).toBe(items);
  });
});

describe('reorderConstructorWidgets', () => {
  const size = { w: 12, h: 2, minW: 4, minH: 2 };

  function widget(id: string, layout: ConstructorWidgetLayout = { x: 0, y: 0, ...size }): ConstructorWidget {
    return {
      instanceId: id,
      kind: 'checks',
      sectionId: id,
      title: id,
      description: '',
      filterCaption: '',
      size,
      payload: { chart: 'list', items: [] },
      layout,
    };
  }

  it('reorders list items and leaves board coordinates unchanged', () => {
    const widgets = [
      widget('a', { x: 0, y: 0, ...size }),
      widget('b', { x: 0, y: 2, ...size }),
      widget('c', { x: 0, y: 4, ...size }),
    ];
    const next = reorderConstructorWidgets(widgets, 2, 0);
    expect(next.map((item) => item.instanceId)).toEqual(['c', 'a', 'b']);
    expect(next.map((item) => item.layout)).toEqual([
      widgets[2]?.layout,
      widgets[0]?.layout,
      widgets[1]?.layout,
    ]);
  });

  it('does not swap positions of widgets that share a row', () => {
    const half = { w: 6, h: 4, minW: 3, minH: 3 };
    const widgets = [
      widget('a', { x: 0, y: 0, ...half }),
      widget('b', { x: 6, y: 0, ...half }),
    ];
    const next = reorderConstructorWidgets(widgets, 1, 0);
    expect(next.map((item) => item.instanceId)).toEqual(['b', 'a']);
    expect(next[0]?.layout).toEqual(widgets[1]?.layout);
    expect(next[1]?.layout).toEqual(widgets[0]?.layout);
  });
});

describe('buildConstructorFilterCaption', () => {
  it('uses fallbacks when nothing is selected', () => {
    expect(
      buildConstructorFilterCaption({
        periodSliceLabel: 'Год',
        periods: [],
        auditors: [],
        departments: [],
      }),
    ).toBe('Все · Год · Все аудиторы · Все департаменты');
  });

  it('joins selected filters', () => {
    expect(
      buildConstructorFilterCaption({
        periodSliceLabel: 'Квартал',
        periods: ['2025-Q1', '2025-Q2'],
        auditors: ['Иванов'],
        departments: ['ДВА'],
      }),
    ).toBe('2025-Q1, 2025-Q2 · Иванов · ДВА');
  });
});

describe('buildConstructorDrafts', () => {
  it('snapshots selected check charts including duplicates of the same section', () => {
    const drafts = buildChecksConstructorDrafts({
      selectedSections: ['summary', 'types'],
      filterCaption: '2025 · Все аудиторы · Все департаменты',
      summary: { total: 10, not_started: 1, in_progress: 2, completed: 7 },
      universeTotal: 12,
      completionShare: 70,
      flowSeries: [],
      flowColors: [],
      granularity: 'year',
      viewDistribution: [],
      viewColors: [],
      typeDistribution: [{ name: 'Плановая', value: 8 }],
      departmentMapTop: [],
      effectivenessMatrix: [],
    });
    expect(drafts.map((item) => item.sectionId)).toEqual(['summary', 'types']);
    expect(drafts[0]?.payload.chart).toBe('kpi');
    expect(drafts[1]?.payload.chart).toBe('donut');
  });

  it('keeps materiality charts as separate constructor widgets', () => {
    const drafts = buildRecommendationsConstructorDrafts({
      selectedSections: ['materialityByPeriod', 'materiality', 'views', 'objects'],
      filterCaption: 'Все',
      summary: {
        total: 1,
        byStatus: { completed: 0, unresolved: 0, on_control: 0, in_progress: 1 },
        byMateriality: { низкий: 1, средний: 0, высокий: 0 },
        byAdditional: { on_time: 1, deadline_violated: 0, on_control: 0, in_progress: 0 },
        withExtensions: 0,
        withCompletionDate: 0,
        completionRate: 0,
        violationRate: 0,
      },
      universeTotal: 1,
      completedPeriodSeries: [],
      coloredMaterialityDistribution: [],
      viewDistribution: [{ name: 'ИТ', value: 3 }],
      viewColors: ['#0E7490'],
      objectDistributionTop: [{ name: 'ДВА', value: 1 }],
      materialityMatrix: [],
      granularity: 'year',
    });
    expect(drafts.map((item) => item.sectionId)).toEqual([
      'materialityByPeriod',
      'materiality',
      'views',
      'objects',
    ]);
    expect(drafts[0]?.payload.chart).toBe('stacked');
    expect(drafts[1]?.payload.chart).toBe('donut');
    expect(drafts[2]?.payload.chart).toBe('bar');
  });

  it('snapshots planning charts including the uncovered-department list', () => {
    const drafts = buildPlanningConstructorDrafts({
      selectedSections: ['summary', 'coverage', 'unresolved'],
      filterCaption: '2025 · Все департаменты',
      coverage: {
        covered: 3,
        uncovered: 1,
        total: 4,
        coverageRate: 75,
        uncoveredRate: 25,
        uncoveredDepartments: ['Казначейство'],
      },
      unresolvedByDepartment: [
        {
          name: 'ДВА',
          value: 3,
          checks: [{ key: 'П-1', short_name: 'Казначейство', count: 3 }],
        },
      ],
      highMaterialityTotal: 4,
      filteredChecksTotal: 2,
      filteredRecommendationsTotal: 5,
      universeChecksTotal: 10,
      universeRecommendationsTotal: 20,
    });
    expect(drafts.map((item) => item.sectionId)).toEqual([
      'summary',
      'coverage',
      'unresolved',
    ]);
    expect(drafts[0]?.kind).toBe('planning');
    expect(drafts[0]?.payload).toMatchObject({
      chart: 'kpi',
      columns: 3,
      items: [
        { label: 'Охват департаментов' },
        { label: 'Не охвачено' },
        { label: 'Красные рекомендации' },
      ],
    });
    expect(drafts[1]?.payload.chart).toBe('list');
    expect(drafts[2]?.payload.chart).toBe('department-unresolved');
  });

  it('snapshots DVA employee dashboards', () => {
    const drafts = buildDvaConstructorDrafts({
      selectedSections: ['summary', 'auditorChecksMap', 'auditorDocuments'],
      filterCaption: '2025 · Все аудиторы · Все департаменты',
      checkTotal: 12,
      recTotal: 40,
      employeeCount: 3,
      highMateriality: 8,
      averageCheckDurationDays: 18,
      auditorChecksMap: [{ name: 'Иванов', value: 4 }],
      auditorImpact: [{ name: 'Иванов', low: 2, medium: 3, high: 5, total: 10 }],
      auditorExecution: [],
      auditorTimeliness: [],
      auditorDocuments: [
        {
          name: 'Иванов',
          checks: 4,
          order_filled: 4,
          program_filled: 3,
          az_filled: 2,
          dz_filled: 1,
          readiness: 63,
          missing_order: [],
          missing_program: [{ key: 'П-2', short_name: 'Без программы' }],
          missing_az: [],
          missing_dz: [],
        },
      ],
      checkLifecycle: [],
    });
    expect(drafts.map((item) => item.sectionId)).toEqual([
      'summary',
      'auditorChecksMap',
      'auditorDocuments',
    ]);
    expect(drafts[0]?.payload.chart).toBe('kpi');
    expect(drafts[1]?.payload.chart).toBe('treemap');
    expect(drafts[1]?.payload).toMatchObject({ palette: 'indigo' });
    expect(drafts[1]?.size).toEqual({ w: 8, h: 3, minW: 3, minH: 2 });
    expect(drafts[2]?.payload.chart).toBe('auditor-documents-matrix');
  });

  it('sizes the DVA employee checks map like the checks department map', () => {
    const departmentMap = buildChecksConstructorDrafts({
      selectedSections: ['departmentMap'],
      filterCaption: '2025',
      summary: { total: 0, not_started: 0, in_progress: 0, completed: 0 },
      universeTotal: 0,
      completionShare: 0,
      flowSeries: [],
      flowColors: [],
      granularity: 'year',
      viewDistribution: [],
      viewColors: [],
      typeDistribution: [],
      departmentMapTop: [{ name: 'Казначейство', value: 4 }],
      effectivenessMatrix: [],
    });
    const employeeMap = buildDvaConstructorDrafts({
      selectedSections: ['auditorChecksMap'],
      filterCaption: '2025',
      checkTotal: 0,
      recTotal: 0,
      employeeCount: 0,
      highMateriality: 0,
      averageCheckDurationDays: 0,
      auditorChecksMap: [{ name: 'Иванов', value: 4 }],
      auditorImpact: [],
      auditorExecution: [],
      auditorTimeliness: [],
      auditorDocuments: [],
      checkLifecycle: [],
    });
    expect(employeeMap[0]?.size).toEqual(departmentMap[0]?.size);
    expect(employeeMap[0]?.size).toEqual({ w: 8, h: 3, minW: 3, minH: 2 });
  });

  it('snapshots DVA check lifecycle as a dedicated chart', () => {
    const drafts = buildDvaConstructorDrafts({
      selectedSections: ['checkLifecycle'],
      filterCaption: '2026',
      checkTotal: 2,
      recTotal: 0,
      employeeCount: 1,
      highMateriality: 0,
      averageCheckDurationDays: 0,
      auditorChecksMap: [],
      auditorImpact: [],
      auditorExecution: [],
      auditorTimeliness: [],
      auditorDocuments: [],
      checkLifecycle: [
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
      ],
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.payload).toMatchObject({
      chart: 'check-lifecycle',
      rows: [{ key: 'П-1', shortName: 'Казначейство' }],
    });
  });

  it('snapshots DVA unresolved execution as a dedicated chart', () => {
    const drafts = buildDvaConstructorDrafts({
      selectedSections: ['auditorExecution'],
      filterCaption: '2025',
      checkTotal: 12,
      recTotal: 40,
      employeeCount: 1,
      highMateriality: 8,
      averageCheckDurationDays: 18,
      auditorChecksMap: [],
      auditorImpact: [],
      auditorExecution: [
        {
          name: 'Иванов',
          completed: 4,
          in_progress: 1,
          on_control: 2,
          unresolved: 3,
          total: 10,
          unresolved_checks: [{ key: 'П-1', short_name: 'Казначейство', count: 3 }],
        },
      ],
      auditorTimeliness: [],
      auditorDocuments: [],
      checkLifecycle: [],
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.payload).toMatchObject({
      chart: 'auditor-unresolved',
      data: [
        {
          name: 'Иванов',
          unresolved: 3,
          unresolved_checks: [{ key: 'П-1', short_name: 'Казначейство', count: 3 }],
        },
      ],
    });
  });
});
