import type { Check, CheckStatus, CheckType, CheckView } from '../types/check';
import type { Recommendation } from '../types/recommendation';
import { getCheckStatusLabel, getCheckTypeLabel, getCheckViewLabel } from '../constants/checks';
import { parseDateValue } from './dates';
import {
  getPeriodBucket,
  isDateInAnySelectedPeriods,
  isDateInSelectedPeriods,
  type PeriodBucket,
  type PeriodGranularity,
} from './analyticsPeriod';

export type { PeriodGranularity, PeriodBucket };

export type EffectivenessArea = 'any' | 'process' | 'svk' | 'sur' | 'svik';

export type CheckAnalyticsFilters = {
  auditors: string[];
  granularity: PeriodGranularity;
  selectedPeriods: string[];
  selectedYears?: string[];
  selectedQuarters?: string[];
  selectedMonths?: string[];
  departments?: string[];
  recommendations?: Recommendation[];
  effectivenessArea: EffectivenessArea;
  selectedEffectivenessRatings: string[];
};

export const EFFECTIVENESS_AREA_OPTIONS: { value: EffectivenessArea; label: string }[] = [
  { value: 'any', label: 'Все области' },
  { value: 'process', label: 'Процесс' },
  { value: 'svk', label: 'СВК' },
  { value: 'sur', label: 'СУР' },
  { value: 'svik', label: 'СВИК' },
];

export const EFFECTIVENESS_UNSET_LABEL = 'не указано';

export function getCheckEffectivenessValue(check: Check, area: Exclude<EffectivenessArea, 'any'>): string {
  const raw =
    area === 'process'
      ? check.process_effectiveness
      : area === 'svk'
        ? check.svk_effectiveness
        : area === 'sur'
          ? check.sur_effectiveness
          : check.svik_effectiveness;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : EFFECTIVENESS_UNSET_LABEL;
}

export function getCheckEffectivenessValues(check: Check, area: EffectivenessArea): string[] {
  if (area === 'any') {
    return (['process', 'svk', 'sur', 'svik'] as const).map((key) => getCheckEffectivenessValue(check, key));
  }
  return [getCheckEffectivenessValue(check, area)];
}

export type NamedCount = {
  name: string;
  value: number;
};

export type PeriodCount = PeriodBucket & {
  total: number;
  not_started: number;
  in_progress: number;
  completed: number;
};

export type AuditorPeriodRow = {
  auditor: string;
  total: number;
  byPeriod: Record<string, number>;
};

const STATUS_KEYS: CheckStatus[] = ['not_started', 'in_progress', 'completed'];

export function filterChecksForAnalytics(checks: Check[], filters: CheckAnalyticsFilters): Check[] {
  const auditorSet = new Set(filters.auditors.filter(Boolean));
  const ratingSet = new Set(filters.selectedEffectivenessRatings.filter(Boolean));
  const departmentSet = new Set((filters.departments ?? []).filter(Boolean));
  const recommendationsByCheck = new Map<string, Recommendation[]>();

  if (departmentSet.size > 0 || auditorSet.size > 0) {
    (filters.recommendations ?? []).forEach((recommendation) => {
      const serial = recommendation.serial_number.trim();
      if (!serial) {return;}
      const bucket = recommendationsByCheck.get(serial) ?? [];
      bucket.push(recommendation);
      recommendationsByCheck.set(serial, bucket);
    });
  }

  return checks.filter((check) => {
    const startMs = parseDateValue(check.start_date);
    if (startMs === null) {
      return false;
    }
    if (auditorSet.size > 0) {
      const linked = recommendationsByCheck.get(check.serial_number) ?? [];
      const matchesAuditor =
        auditorSet.has(check.check_leader)
        || linked.some((item) => auditorSet.has(item.auditor) || auditorSet.has(item.manager));
      if (!matchesAuditor) {
        return false;
      }
    }
    const hasMultiPeriodFilter =
      (filters.selectedYears?.length ?? 0) > 0
      || (filters.selectedQuarters?.length ?? 0) > 0
      || (filters.selectedMonths?.length ?? 0) > 0;
    const matchesPeriod = hasMultiPeriodFilter
      ? isDateInAnySelectedPeriods(startMs, {
          years: filters.selectedYears ?? [],
          quarters: filters.selectedQuarters ?? [],
          months: filters.selectedMonths ?? [],
        })
      : isDateInSelectedPeriods(startMs, filters.granularity, filters.selectedPeriods);
    if (!matchesPeriod) {
      return false;
    }
    if (departmentSet.size > 0) {
      const linked = recommendationsByCheck.get(check.serial_number) ?? [];
      if (!linked.some((item) => departmentSet.has(item.audit_object))) {
        return false;
      }
    }
    if (ratingSet.size > 0) {
      const values = getCheckEffectivenessValues(check, filters.effectivenessArea);
      if (!values.some((value) => ratingSet.has(value))) {
        return false;
      }
    }
    return true;
  });
}

export function summarizeChecks(checks: Check[]) {
  const byStatus: Record<CheckStatus, number> = {
    not_started: 0,
    in_progress: 0,
    completed: 0,
  };

  checks.forEach((check) => {
    byStatus[check.status] += 1;
  });

  return {
    total: checks.length,
    ...byStatus,
  };
}

export function buildPeriodSeries(checks: Check[], granularity: PeriodGranularity): PeriodCount[] {
  const map = new Map<string, PeriodCount>();

  checks.forEach((check) => {
    const startMs = parseDateValue(check.start_date);
    if (startMs === null) {
      return;
    }
    const bucket = getPeriodBucket(startMs, granularity);
    const current = map.get(bucket.key) ?? {
      ...bucket,
      total: 0,
      not_started: 0,
      in_progress: 0,
      completed: 0,
    };
    current.total += 1;
    current[check.status] += 1;
    map.set(bucket.key, current);
  });

  return [...map.values()].sort((a, b) => a.sortKey - b.sortKey);
}

export function buildStatusDistribution(checks: Check[]): NamedCount[] {
  const summary = summarizeChecks(checks);
  return STATUS_KEYS
    .map((status) => ({
      name: getCheckStatusLabel(status),
      value: summary[status],
    }))
    .filter((item) => item.value > 0);
}

export function buildTypeDistribution(checks: Check[]): NamedCount[] {
  const map = new Map<CheckType, number>();
  checks.forEach((check) => {
    map.set(check.check_type, (map.get(check.check_type) ?? 0) + 1);
  });
  return [...map.entries()]
    .map(([type, value]) => ({ name: getCheckTypeLabel(type), value }))
    .sort((a, b) => b.value - a.value);
}

export function buildViewDistribution(checks: Check[]): NamedCount[] {
  const map = new Map<CheckView, number>();
  checks.forEach((check) => {
    map.set(check.check_view, (map.get(check.check_view) ?? 0) + 1);
  });
  return [...map.entries()]
    .map(([view, value]) => ({ name: getCheckViewLabel(view), value }))
    .sort((a, b) => b.value - a.value);
}

export function buildAuditorDistribution(checks: Check[]): NamedCount[] {
  const map = new Map<string, number>();
  checks.forEach((check) => {
    const name = check.check_leader.trim() || 'Без руководителя';
    map.set(name, (map.get(name) ?? 0) + 1);
  });
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildAuditorPeriodMatrix(
  checks: Check[],
  granularity: PeriodGranularity,
): { periods: PeriodBucket[]; rows: AuditorPeriodRow[] } {
  const periodMap = new Map<string, PeriodBucket>();
  const rowMap = new Map<string, AuditorPeriodRow>();

  checks.forEach((check) => {
    const startMs = parseDateValue(check.start_date);
    if (startMs === null) {
      return;
    }
    const period = getPeriodBucket(startMs, granularity);
    periodMap.set(period.key, period);

    const auditor = check.check_leader.trim() || 'Без руководителя';
    const row = rowMap.get(auditor) ?? {
      auditor,
      total: 0,
      byPeriod: {},
    };
    row.total += 1;
    row.byPeriod[period.key] = (row.byPeriod[period.key] ?? 0) + 1;
    rowMap.set(auditor, row);
  });

  const periods = [...periodMap.values()].sort((a, b) => a.sortKey - b.sortKey);
  const rows = [...rowMap.values()].sort((a, b) => b.total - a.total);
  return { periods, rows };
}

export function collectCheckLeaders(checks: Check[]): string[] {
  return [...new Set(checks.map((check) => check.check_leader).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ru'));
}

export function collectAnalyticsAuditors(checks: Check[], recommendations: Recommendation[]): string[] {
  return [
    ...new Set(
      [
        ...checks.map((check) => check.check_leader),
        ...recommendations.map((item) => item.auditor),
        ...recommendations.map((item) => item.manager),
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, 'ru'));
}

export function collectAuditObjects(recommendations: Recommendation[]): string[] {
  return [
    ...new Set(recommendations.map((item) => item.audit_object.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, 'ru'));
}

export type CumulativePoint = PeriodBucket & {
  total: number;
  cumulative: number;
};

export function buildCumulativeSeries(
  checks: Check[],
  granularity: PeriodGranularity,
): CumulativePoint[] {
  const periodSeries = buildPeriodSeries(checks, granularity);
  let running = 0;
  return periodSeries.map((item) => {
    running += item.total;
    return {
      key: item.key,
      label: item.label,
      sortKey: item.sortKey,
      total: item.total,
      cumulative: running,
    };
  });
}

export type DurationBucket = {
  name: string;
  value: number;
};

const DURATION_BUCKETS = [
  { name: '≤ 30 дн.', maxDays: 30 },
  { name: '31–60 дн.', maxDays: 60 },
  { name: '61–90 дн.', maxDays: 90 },
  { name: '91–180 дн.', maxDays: 180 },
  { name: '> 180 дн.', maxDays: Number.POSITIVE_INFINITY },
] as const;

export function buildDurationDistribution(checks: Check[]): DurationBucket[] {
  const counts = DURATION_BUCKETS.map((bucket) => ({ name: bucket.name, value: 0 }));

  checks.forEach((check) => {
    const startMs = parseDateValue(check.start_date);
    const endMs = parseDateValue(check.end_date);
    if (startMs === null || endMs === null || endMs < startMs) {
      return;
    }
    const days = Math.round((endMs - startMs) / (24 * 60 * 60 * 1000));
    const index = DURATION_BUCKETS.findIndex((bucket) => days <= bucket.maxDays);
    if (index >= 0) {
      counts[index].value += 1;
    }
  });

  return counts.filter((item) => item.value > 0);
}

export type DocumentReadiness = {
  name: string;
  filled: number;
  empty: number;
};

export function buildDocumentReadiness(checks: Check[]): DocumentReadiness[] {
  const docs = [
    { name: 'Приказ', has: (check: Check) => Boolean(check.order_document_number || check.order_document_date) },
    { name: 'Программа', has: (check: Check) => Boolean(check.program_document_number || check.program_document_date) },
    { name: 'АЗ', has: (check: Check) => Boolean(check.az_document_number || check.az_document_date) },
    { name: 'ДЗ', has: (check: Check) => Boolean(check.dz_document_number || check.dz_document_date) },
  ] as const;

  return docs.map((doc) => {
    let filled = 0;
    checks.forEach((check) => {
      if (doc.has(check)) {
        filled += 1;
      }
    });
    return {
      name: doc.name,
      filled,
      empty: Math.max(checks.length - filled, 0),
    };
  });
}

export type TypeStatusRow = {
  name: string;
  not_started: number;
  in_progress: number;
  completed: number;
};

export function buildTypeStatusBreakdown(checks: Check[]): TypeStatusRow[] {
  const map = new Map<CheckType, TypeStatusRow>();

  checks.forEach((check) => {
    const current = map.get(check.check_type) ?? {
      name: getCheckTypeLabel(check.check_type),
      not_started: 0,
      in_progress: 0,
      completed: 0,
    };
    current[check.status] += 1;
    map.set(check.check_type, current);
  });

  return [...map.values()].sort((a, b) => {
    const totalA = a.not_started + a.in_progress + a.completed;
    const totalB = b.not_started + b.in_progress + b.completed;
    return totalB - totalA;
  });
}

export type RadarPoint = {
  metric: string;
  value: number;
  fullMark: number;
};

export function buildViewRadar(checks: Check[]): RadarPoint[] {
  const distribution = buildViewDistribution(checks);
  const fullMark = Math.max(...distribution.map((item) => item.value), 1);
  return distribution.map((item) => ({
    metric: item.name,
    value: item.value,
    fullMark,
  }));
}

export function buildCompletionShare(checks: Check[]) {
  if (checks.length === 0) {
    return 0;
  }
  const completed = checks.filter((check) => check.status === 'completed').length;
  return Math.round((completed / checks.length) * 100);
}

export function collectEffectivenessRatingOptions(
  checks: Check[],
  area: EffectivenessArea = 'any',
): string[] {
  const set = new Set<string>();
  checks.forEach((check) => {
    getCheckEffectivenessValues(check, area).forEach((value) => set.add(value));
  });
  return [...set].sort((a, b) => {
    if (a === EFFECTIVENESS_UNSET_LABEL) {
      return 1;
    }
    if (b === EFFECTIVENESS_UNSET_LABEL) {
      return -1;
    }
    return a.localeCompare(b, 'ru');
  });
}

export function buildEffectivenessDistribution(
  checks: Check[],
  area: EffectivenessArea = 'any',
): NamedCount[] {
  const map = new Map<string, number>();
  checks.forEach((check) => {
    if (area === 'any') {
      // Count each check once by primary filled rating, preferring process → svk → sur → svik.
      const values = (['process', 'svk', 'sur', 'svik'] as const)
        .map((key) => getCheckEffectivenessValue(check, key))
        .filter((value) => value !== EFFECTIVENESS_UNSET_LABEL);
      const label = values[0] ?? EFFECTIVENESS_UNSET_LABEL;
      map.set(label, (map.get(label) ?? 0) + 1);
      return;
    }
    const label = getCheckEffectivenessValue(check, area);
    map.set(label, (map.get(label) ?? 0) + 1);
  });
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export type EffectivenessAreaRow = {
  area: string;
  total: number;
  byRating: Record<string, number>;
};

export function buildEffectivenessByArea(checks: Check[]): {
  ratings: string[];
  rows: EffectivenessAreaRow[];
} {
  const ratingSet = new Set<string>();
  const rows = (['process', 'svk', 'sur', 'svik'] as const).map((area) => {
    const byRating: Record<string, number> = {};
    checks.forEach((check) => {
      const label = getCheckEffectivenessValue(check, area);
      ratingSet.add(label);
      byRating[label] = (byRating[label] ?? 0) + 1;
    });
    return {
      area: EFFECTIVENESS_AREA_OPTIONS.find((item) => item.value === area)?.label ?? area,
      total: checks.length,
      byRating,
    };
  });
  const ratings = [...ratingSet].sort((a, b) => {
    if (a === EFFECTIVENESS_UNSET_LABEL) {
      return 1;
    }
    if (b === EFFECTIVENESS_UNSET_LABEL) {
      return -1;
    }
    return a.localeCompare(b, 'ru');
  });
  return { ratings, rows };
}

export function buildEffectivenessPeriodSeries(
  checks: Check[],
  granularity: PeriodGranularity,
  area: EffectivenessArea = 'any',
): Array<PeriodBucket & { total: number; byRating: Record<string, number> }> {
  const map = new Map<string, PeriodBucket & { total: number; byRating: Record<string, number> }>();

  checks.forEach((check) => {
    const startMs = parseDateValue(check.start_date);
    if (startMs === null) {
      return;
    }
    const bucket = getPeriodBucket(startMs, granularity);
    const current = map.get(bucket.key) ?? {
      ...bucket,
      total: 0,
      byRating: {},
    };
    current.total += 1;
    const labels =
      area === 'any'
        ? [
            (['process', 'svk', 'sur', 'svik'] as const)
              .map((key) => getCheckEffectivenessValue(check, key))
              .find((value) => value !== EFFECTIVENESS_UNSET_LABEL) ?? EFFECTIVENESS_UNSET_LABEL,
          ]
        : [getCheckEffectivenessValue(check, area)];
    labels.forEach((label) => {
      current.byRating[label] = (current.byRating[label] ?? 0) + 1;
    });
    map.set(bucket.key, current);
  });

  return [...map.values()].sort((a, b) => a.sortKey - b.sortKey);
}

export function buildEffectivenessAuditorRows(
  checks: Check[],
  area: EffectivenessArea = 'any',
): Array<{ auditor: string; total: number; byRating: Record<string, number> }> {
  const map = new Map<string, { auditor: string; total: number; byRating: Record<string, number> }>();

  checks.forEach((check) => {
    const auditor = check.check_leader.trim() || 'Без руководителя';
    const current = map.get(auditor) ?? { auditor, total: 0, byRating: {} };
    current.total += 1;
    const label =
      area === 'any'
        ? (['process', 'svk', 'sur', 'svik'] as const)
            .map((key) => getCheckEffectivenessValue(check, key))
            .find((value) => value !== EFFECTIVENESS_UNSET_LABEL) ?? EFFECTIVENESS_UNSET_LABEL
        : getCheckEffectivenessValue(check, area);
    current.byRating[label] = (current.byRating[label] ?? 0) + 1;
    map.set(auditor, current);
  });

  return [...map.values()].sort((a, b) => b.total - a.total);
}
