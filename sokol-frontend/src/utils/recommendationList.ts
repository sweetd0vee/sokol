import { getCheckViewLabel } from '../constants/checks';
import { resolveRecommendationAdditionalIndicator } from '../constants/recommendations';
import type { Check } from '../types/check';
import type { Recommendation } from '../types/recommendation';
import { formatRecommendationAuditObjects, getRecommendationAuditObjects } from './auditObjects';
import { parseDateValue } from './dates';
import { matchesDateRange, matchesSelected } from './listTable';
import { recommendationMatchesCurrentUser } from './personMatch';
import {
  getRecommendationYearlyId,
  getRecommendationYearlySortValue,
} from './recommendationYearlyNumber';

export type RecommendationSortKey =
  | 'id'
  | 'serial_number'
  | 'name'
  | 'audit_object'
  | 'deadline'
  | 'execution_deadline'
  | 'check_view'
  | 'indicator'
  | 'additional_indicator'
  | 'materiality_level'
  | 'auditor'
  | 'manager'
  | 'status'
  | 'additional_status';

export function buildCheckViewBySerial(
  checks: Pick<Check, 'serial_number' | 'check_view'>[],
): Map<string, string> {
  return new Map(
    checks.map((check) => [check.serial_number, getCheckViewLabel(check.check_view)] as const),
  );
}

export function getRecommendationCheckView(
  recommendation: Recommendation,
  checkViewBySerial: Map<string, string>,
) {
  return checkViewBySerial.get(recommendation.serial_number) ?? '';
}

const INDICATOR_ORDER: Record<string, number> = {
  исполнено: 0,
  'исполнено в ходе аудита': 1,
  'в процессе': 2,
  'на контроле': 3,
  'не решено': 4,
  'не указан': 5,
};

const ADDITIONAL_INDICATOR_ORDER: Record<string, number> = {
  'в срок': 0,
  'срок нарушен': 1,
  'на контроле': 2,
  'в процессе': 3,
  'не указан': 4,
};

const MATERIALITY_ORDER: Record<string, number> = {
  высокий: 0,
  средний: 1,
  низкий: 2,
};

const STATUS_ORDER: Record<string, number> = {
  completed: 0,
  unresolved: 1,
  on_control: 2,
  in_progress: 3,
};

const ADDITIONAL_STATUS_ORDER: Record<string, number> = {
  on_time: 0,
  deadline_violated: 1,
  on_control: 2,
  in_progress: 3,
};

export function getRecommendationSortValue(
  recommendation: Recommendation,
  key: RecommendationSortKey,
  yearlyNumbers: Map<string, number>,
  checkViewBySerial: Map<string, string> = new Map(),
) {
  switch (key) {
    case 'id':
      return getRecommendationYearlySortValue(recommendation, yearlyNumbers);
    case 'serial_number':
      return recommendation.serial_number;
    case 'name':
      return `${recommendation.name} ${recommendation.observation_name ?? ''}`;
    case 'audit_object':
      return formatRecommendationAuditObjects(recommendation.audit_object);
    case 'check_view':
      return getRecommendationCheckView(recommendation, checkViewBySerial);
    case 'deadline':
      return parseDateValue(recommendation.deadline);
    case 'execution_deadline':
      return parseDateValue(recommendation.execution_deadline);
    case 'indicator':
      return INDICATOR_ORDER[recommendation.indicator] ?? 999;
    case 'additional_indicator':
      return (
        ADDITIONAL_INDICATOR_ORDER[
          resolveRecommendationAdditionalIndicator(
            recommendation.additional_status,
            recommendation.additional_indicator,
          )
        ] ?? 999
      );
    case 'materiality_level':
      return MATERIALITY_ORDER[recommendation.materiality_level] ?? 999;
    case 'auditor':
      return recommendation.auditor;
    case 'manager':
      return recommendation.manager;
    case 'status':
      return STATUS_ORDER[recommendation.status] ?? 999;
    case 'additional_status':
      return ADDITIONAL_STATUS_ORDER[recommendation.additional_status] ?? 999;
    default:
      return '';
  }
}

export type RecommendationListFilters = {
  idFilter: string;
  keyFilter: string;
  nameFilter: string;
  statuses: string[];
  additionalIndicators: string[];
  auditObjects: string[];
  indicators: string[];
  checkViews: string[];
  materialityLevels: string[];
  auditors: string[];
  managers: string[];
  showOnlyMe: boolean;
  trimmedMyName: string;
  deadlineFrom: Date | null;
  deadlineTo: Date | null;
};

export function filterRecommendations(
  recommendations: Recommendation[],
  yearlyNumbers: Map<string, number>,
  filters: RecommendationListFilters,
  checkViewBySerial: Map<string, string> = new Map(),
) {
  return recommendations.filter((recommendation) => {
    if (filters.idFilter) {
      const yearlyId = getRecommendationYearlyId(recommendation, yearlyNumbers) ?? '';
      if (!yearlyId.includes(filters.idFilter.trim())) {
        return false;
      }
    }
    if (
      filters.keyFilter &&
      !recommendation.serial_number.toLowerCase().includes(filters.keyFilter.trim().toLowerCase())
    ) {
      return false;
    }
    if (filters.nameFilter) {
      const query = filters.nameFilter.trim().toLowerCase();
      const searchableName = [recommendation.name, recommendation.observation_name ?? ''].join(' ').toLowerCase();
      if (!searchableName.includes(query)) {
        return false;
      }
    }
    if (!matchesSelected(filters.statuses, recommendation.status)) {
      return false;
    }
    if (
      !matchesSelected(
        filters.additionalIndicators,
        resolveRecommendationAdditionalIndicator(
          recommendation.additional_status,
          recommendation.additional_indicator,
        ),
      )
    ) {
      return false;
    }
    if (
      filters.auditObjects.length > 0 &&
      !getRecommendationAuditObjects(recommendation.audit_object).some((item) =>
        filters.auditObjects.includes(item),
      )
    ) {
      return false;
    }
    if (!matchesSelected(filters.indicators, recommendation.indicator)) {
      return false;
    }
    if (
      !matchesSelected(
        filters.checkViews,
        getRecommendationCheckView(recommendation, checkViewBySerial),
      )
    ) {
      return false;
    }
    if (!matchesSelected(filters.materialityLevels, recommendation.materiality_level)) {
      return false;
    }
    if (!matchesSelected(filters.auditors, recommendation.auditor)) {
      return false;
    }
    if (!matchesSelected(filters.managers, recommendation.manager)) {
      return false;
    }
    if (filters.showOnlyMe) {
      if (!filters.trimmedMyName) {
        return false;
      }
      if (!recommendationMatchesCurrentUser(recommendation, filters.trimmedMyName)) {
        return false;
      }
    }
    return matchesDateRange(parseDateValue(recommendation.deadline), filters.deadlineFrom, filters.deadlineTo);
  });
}
