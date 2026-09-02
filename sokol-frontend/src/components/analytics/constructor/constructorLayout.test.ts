import { describe, expect, it } from 'vitest';
import { packNewLayouts } from './constructorLayout';
import { buildConstructorFilterCaption } from './constructorFilterCaption';
import { buildChecksConstructorDrafts, buildRecommendationsConstructorDrafts } from './buildConstructorWidgets';

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
});
