import type {
  MaterialityLevel,
  Recommendation,
  RecommendationAdditionalStatus,
  RecommendationIndicator,
  RecommendationStatus,
} from '../types/recommendation';
import { parseDateValue, toEndOfDayMs, toStartOfDayMs } from './dates';
import {
  getPeriodBucket,
  isDateInAnySelectedPeriods,
  isDateInSelectedPeriods,
  type PeriodBucket,
  type PeriodGranularity,
} from './analyticsPeriod';
import { getRecommendationAuditObjects } from './auditObjects';

export type { PeriodGranularity, PeriodBucket };

export type RecommendationAnalyticsFilters = {
  dateFrom: Date | null;
  dateTo: Date | null;
  auditors: string[];
  departments?: string[];
  statuses?: RecommendationStatus[];
  additionalStatuses?: RecommendationAdditionalStatus[];
  materialityLevels: MaterialityLevel[];
  granularity: PeriodGranularity;
  selectedPeriods: string[];
  selectedYears?: string[];
  selectedQuarters?: string[];
  selectedMonths?: string[];
};

export type PeriodCount = PeriodBucket & {
  total: number;
  completed: number;
  unresolved: number;
  on_control: number;
  in_progress: number;
  low: number;
  medium: number;
  high: number;
};

export const MATERIALITY_COLORS: Record<MaterialityLevel, string> = {
  // Use the same tones as in the "recommendations table" dot styles.
  низкий: '#A7F7C2', // rgb(167,247,194)
  средний: '#FBEB8D',
  высокий: '#FF4347',
};

export const STATUS_COLORS: Record<RecommendationStatus, string> = {
  // Use the same tones as in the "recommendations table" badge styles.
  // Make them closer to the dashboard "Существенность" intensity (less pale).
  completed: MATERIALITY_COLORS.низкий,
  unresolved: MATERIALITY_COLORS.высокий,
  on_control: '#64748B',
  in_progress: MATERIALITY_COLORS.средний,
};

export const ADDITIONAL_STATUS_COLORS: Record<RecommendationAdditionalStatus, string> = {
  // Keep the same mapping as recommendations "table" tones.
  // on_control is intentionally a slate tone to contrast the other categories.
  on_time: MATERIALITY_COLORS.низкий,
  deadline_violated: MATERIALITY_COLORS.высокий,
  on_control: '#64748B',
};

export const INDICATOR_COLORS: Record<RecommendationIndicator, string> = {
  // Match colors from INDICATOR_OPTIONS.dotClassName.
  'не указан': '#64748B',
  'в процессе': MATERIALITY_COLORS.средний,
  'на контроле': '#64748B',
  'не решено': MATERIALITY_COLORS.высокий,
  'исполнено': MATERIALITY_COLORS.низкий,
};

export function getIndicatorColor(value: RecommendationIndicator): string {
  return INDICATOR_COLORS[value] ?? '#e5e7eb';
}

export function getMaterialityLevelColor(value: MaterialityLevel): string {
  return MATERIALITY_COLORS[value] ?? '#e5e7eb';
}

export function getRecommendationStatusColor(value: RecommendationStatus): string {
  return STATUS_COLORS[value] ?? '#e5e7eb';
}

export function getRecommendationAdditionalStatusColor(value: RecommendationAdditionalStatus): string {
  return ADDITIONAL_STATUS_COLORS[value] ?? '#e5e7eb';
}

export function filterRecommendationsForAnalytics(
  recommendations: Recommendation[],
  filters: RecommendationAnalyticsFilters,
): Recommendation[] {
  const fromMs = filters.dateFrom ? toStartOfDayMs(filters.dateFrom) : null;
  const toMs = filters.dateTo ? toEndOfDayMs(filters.dateTo) : null;
  const auditorSet = new Set(filters.auditors.filter(Boolean));
  const departmentSet = new Set((filters.departments ?? []).filter(Boolean));
  const statusSet = new Set(filters.statuses ?? []);
  const additionalStatusSet = new Set(filters.additionalStatuses ?? []);
  const materialitySet = new Set(filters.materialityLevels);

  return recommendations.filter((item) => {
    const deadlineMs = parseDateValue(item.deadline);
    if (deadlineMs === null) {
      return false;
    }
    if (fromMs !== null && deadlineMs < fromMs) {
      return false;
    }
    if (toMs !== null && deadlineMs > toMs) {
      return false;
    }
    if (auditorSet.size > 0 && !auditorSet.has(item.auditor)) {
      return false;
    }
    if (
      departmentSet.size > 0
      && !getRecommendationAuditObjects(item.audit_object).some((department) => departmentSet.has(department))
    ) {
      return false;
    }
    if (statusSet.size > 0 && !statusSet.has(item.status)) {
      return false;
    }
    if (additionalStatusSet.size > 0 && !additionalStatusSet.has(item.additional_status)) {
      return false;
    }
    if (materialitySet.size > 0 && !materialitySet.has(item.materiality_level)) {
      return false;
    }
    const hasMultiPeriodFilter =
      (filters.selectedYears?.length ?? 0) > 0
      || (filters.selectedQuarters?.length ?? 0) > 0
      || (filters.selectedMonths?.length ?? 0) > 0;
    const matchesPeriod = hasMultiPeriodFilter
      ? isDateInAnySelectedPeriods(deadlineMs, {
          years: filters.selectedYears ?? [],
          quarters: filters.selectedQuarters ?? [],
          months: filters.selectedMonths ?? [],
        })
      : isDateInSelectedPeriods(deadlineMs, filters.granularity, filters.selectedPeriods);
    if (!matchesPeriod) {
      return false;
    }
    return true;
  });
}

export function buildPeriodSeries(
  recommendations: Recommendation[],
  granularity: PeriodGranularity,
): PeriodCount[] {
  const map = new Map<string, PeriodCount>();

  recommendations.forEach((item) => {
    const deadlineMs = parseDateValue(item.deadline);
    if (deadlineMs === null) {
      return;
    }
    const bucket = getPeriodBucket(deadlineMs, granularity);
    const current = map.get(bucket.key) ?? {
      ...bucket,
      total: 0,
      completed: 0,
      unresolved: 0,
      on_control: 0,
      in_progress: 0,
      low: 0,
      medium: 0,
      high: 0,
    };
    current.total += 1;
    current[item.status] += 1;
    if (item.materiality_level === 'низкий') {
      current.low += 1;
    } else if (item.materiality_level === 'средний') {
      current.medium += 1;
    } else {
      current.high += 1;
    }
    map.set(bucket.key, current);
  });

  return [...map.values()].sort((a, b) => a.sortKey - b.sortKey);
}

export function buildCumulativeSeries(
  recommendations: Recommendation[],
  granularity: PeriodGranularity,
) {
  const series = buildPeriodSeries(recommendations, granularity);
  let running = 0;
  let completedRunning = 0;
  return series.map((item) => {
    running += item.total;
    completedRunning += item.completed;
    return {
      ...item,
      cumulative: running,
      cumulativeCompleted: completedRunning,
    };
  });
}
