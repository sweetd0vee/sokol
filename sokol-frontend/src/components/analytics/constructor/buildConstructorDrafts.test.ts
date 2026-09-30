import { describe, expect, it } from 'vitest';
import { EMPTY_CHECKS_SUMMARY, EMPTY_RECOMMENDATION_SUMMARY } from '../analyticsEmpty';
import {
  CHECK_EXPORT_SECTIONS,
  DVA_EXPORT_SECTIONS,
  MONITORING_EXPORT_SECTIONS,
  PLANNING_EXPORT_SECTIONS,
  RECOMMENDATION_EXPORT_SECTIONS,
} from '../../../constants/analyticsExportSections';
import {
  buildChecksConstructorDrafts,
  buildDvaConstructorDrafts,
  buildMonitoringConstructorDrafts,
  buildPlanningConstructorDrafts,
  buildRecommendationsConstructorDrafts,
} from './buildConstructorWidgets';

function ids<T extends { id: string }>(sections: readonly T[]): string[] {
  return sections.map((section) => section.id);
}

describe('constructor drafts cover every export section id', () => {
  it('checks', () => {
    const drafts = buildChecksConstructorDrafts({
      selectedSections: ids(CHECK_EXPORT_SECTIONS),
      filterCaption: 'все',
      summary: EMPTY_CHECKS_SUMMARY,
      universeTotal: 0,
      completionShare: 0,
      flowSeries: [],
      flowColors: [],
      granularity: 'year',
      viewDistribution: [],
      viewColors: [],
      typeDistribution: [],
      departmentMapTop: [],
      effectivenessMatrix: [],
    });
    expect(drafts.map((item) => item.sectionId)).toEqual(ids(CHECK_EXPORT_SECTIONS));
    expect(new Set(drafts.map((item) => item.kind))).toEqual(new Set(['checks']));
  });

  it('recommendations', () => {
    const drafts = buildRecommendationsConstructorDrafts({
      selectedSections: ids(RECOMMENDATION_EXPORT_SECTIONS),
      filterCaption: 'все',
      summary: EMPTY_RECOMMENDATION_SUMMARY,
      universeTotal: 0,
      completedPeriodSeries: [],
      coloredMaterialityDistribution: [],
      viewDistribution: [],
      viewColors: [],
      objectDistributionTop: [],
      materialityMatrix: [],
      granularity: 'year',
    });
    expect(drafts.map((item) => item.sectionId)).toEqual(ids(RECOMMENDATION_EXPORT_SECTIONS));
  });

  it('monitoring', () => {
    const drafts = buildMonitoringConstructorDrafts({
      selectedSections: ids(MONITORING_EXPORT_SECTIONS),
      filterCaption: 'все',
      summary: EMPTY_RECOMMENDATION_SUMMARY,
      coloredStatusDistribution: [],
      coloredAdditionalStatusDistribution: [],
      deadlineExtensionsByCheck: [],
      deadlineExtensionColors: [],
      deadlineExtensionShortNames: {},
      completedDuringAuditByCheck: [],
      completedDuringAuditColors: [],
      completedDuringAuditShortNames: {},
      statusMatrix: [],
    });
    expect(drafts.map((item) => item.sectionId)).toEqual(ids(MONITORING_EXPORT_SECTIONS));
  });

  it('dva', () => {
    const drafts = buildDvaConstructorDrafts({
      selectedSections: ids(DVA_EXPORT_SECTIONS),
      filterCaption: 'все',
      checkTotal: 0,
      recTotal: 0,
      employeeCount: 0,
      highMateriality: 0,
      averageCheckDurationDays: 0,
      auditorChecksMap: [],
      auditorImpact: [],
      auditorExecution: [],
      auditorTimeliness: [],
      auditorDocuments: [],
      checkLifecycle: [],
    });
    expect(drafts.map((item) => item.sectionId)).toEqual(ids(DVA_EXPORT_SECTIONS));
  });

  it('planning', () => {
    const drafts = buildPlanningConstructorDrafts({
      selectedSections: ids(PLANNING_EXPORT_SECTIONS),
      filterCaption: 'все',
      coverage: {
        covered: 0,
        uncovered: 0,
        total: 0,
        coverageRate: 0,
        uncoveredRate: 0,
        uncoveredDepartments: [],
      },
      unresolvedByDepartment: [],
      highMaterialityTotal: 0,
      filteredChecksTotal: 0,
      filteredRecommendationsTotal: 0,
      universeChecksTotal: 0,
      universeRecommendationsTotal: 0,
    });
    expect(drafts.map((item) => item.sectionId)).toEqual(ids(PLANNING_EXPORT_SECTIONS));
  });
});
