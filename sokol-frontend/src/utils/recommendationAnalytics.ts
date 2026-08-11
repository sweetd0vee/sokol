import type {
  MaterialityLevel,
  Recommendation,
  RecommendationAdditionalStatus,
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
  низкий: '#22C55E',
  средний: '#F59E0B',
  высокий: '#EF4444',
};

export const STATUS_COLORS: Record<RecommendationStatus, string> = {
  completed: '#22C55E',
  unresolved: '#EF4444',
  on_control: '#64748B',
  in_progress: '#F59E0B',
};

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
    if (departmentSet.size > 0 && !departmentSet.has(item.audit_object)) {
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
