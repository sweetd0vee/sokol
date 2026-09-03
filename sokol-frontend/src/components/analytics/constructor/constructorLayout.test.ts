import { describe, expect, it } from 'vitest';
import { packNewLayouts } from './constructorLayout';
import { buildConstructorFilterCaption } from './constructorFilterCaption';
import { buildChecksConstructorDrafts, buildDvaConstructorDrafts, buildPlanningConstructorDrafts, buildRecommendationsConstructorDrafts } from './buildConstructorWidgets';

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

  it('merges materiality export checkboxes into one combined widget', () => {
    const drafts = buildRecommendationsConstructorDrafts({
      selectedSections: ['materiality', 'materialityByPeriod', 'objects'],
      filterCaption: 'Все',
      summary: {
        total: 1,
        byStatus: { completed: 0, unresolved: 0, on_control: 0, in_progress: 1 },
        byMateriality: { низкий: 1, средний: 0, высокий: 0 },
        byAdditional: { on_time: 1, deadline_violated: 0, on_control: 0 },
        withExtensions: 0,
        withCompletionDate: 0,
        completionRate: 0,
        violationRate: 0,
      },
      universeTotal: 1,
      completedPeriodSeries: [],
      coloredMaterialityDistribution: [],
      objectDistributionTop: [{ name: 'ДВА', value: 1 }],
      materialityMatrix: [],
      granularity: 'year',
    });
    expect(drafts.map((item) => item.sectionId).sort()).toEqual(['materialityCombined', 'objects']);
  });

  it('snapshots planning charts including the uncovered-department list', () => {
    const drafts = buildPlanningConstructorDrafts({
      selectedSections: ['summary', 'coverage', 'departmentAnalytics', 'highMateriality'],
      filterCaption: '2025 · Все департаменты',
      coverage: {
        covered: 3,
        uncovered: 1,
        total: 4,
        coverageRate: 75,
        uncoveredRate: 25,
        uncoveredDepartments: ['Казначейство'],
      },
      departmentAnalytics: [{ name: 'ДВА', checks: 2, recommendations: 5 }],
      highMaterialityRanking: [{ name: 'ДВА', value: 4 }],
      highMaterialityTotal: 4,
      filteredChecksTotal: 2,
      filteredRecommendationsTotal: 5,
      universeChecksTotal: 10,
      universeRecommendationsTotal: 20,
    });
    expect(drafts.map((item) => item.sectionId)).toEqual([
      'summary',
      'coverage',
      'departmentAnalytics',
      'highMateriality',
    ]);
    expect(drafts[0]?.kind).toBe('planning');
    expect(drafts[1]?.payload.chart).toBe('list');
    expect(drafts[2]?.payload.chart).toBe('stacked');
  });

  it('snapshots DVA employee dashboards', () => {
    const drafts = buildDvaConstructorDrafts({
      selectedSections: ['summary', 'auditorLoad', 'auditorImpact', 'auditorDocuments'],
      filterCaption: '2025 · Все аудиторы · Все департаменты',
      checkTotal: 12,
      recTotal: 40,
      employeeCount: 3,
      highMateriality: 8,
      highMaterialityShare: 20,
      recCompletionRate: 55,
      recViolationRate: 18,
      auditorLoad: [{ name: 'Иванов', checks: 4, recommendations: 10, value: 14 }],
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
        },
      ],
    });
    expect(drafts.map((item) => item.sectionId)).toEqual([
      'summary',
      'auditorLoad',
      'auditorImpact',
      'auditorDocuments',
    ]);
    expect(drafts[0]?.payload.chart).toBe('kpi');
    expect(drafts[1]?.payload.chart).toBe('stacked');
    expect(drafts[3]?.payload.chart).toBe('auditor-documents-matrix');
  });
});
