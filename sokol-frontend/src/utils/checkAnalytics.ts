import type { Check, CheckStatus, CheckType, CheckView } from '../types/check';
import { getCheckStatusLabel, getCheckTypeLabel, getCheckViewLabel } from '../constants/checks';
import { parseDateValue } from './dates';

export type PeriodGranularity = 'month' | 'quarter' | 'year';

export type CheckAnalyticsFilters = {
  auditors: string[];
  granularity: PeriodGranularity;
};

export type PeriodBucket = {
  key: string;
  label: string;
  sortKey: number;
};

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

function getPeriodBucket(dateMs: number, granularity: PeriodGranularity): PeriodBucket {
  const date = new Date(dateMs);
  const year = date.getFullYear();
  const month = date.getMonth();

  if (granularity === 'year') {
    return {
      key: String(year),
      label: String(year),
      sortKey: year,
    };
  }

  if (granularity === 'quarter') {
    const quarter = Math.floor(month / 3) + 1;
    return {
      key: `${year}-Q${quarter}`,
      label: `Q${quarter} ${year}`,
      sortKey: year * 10 + quarter,
    };
  }

  const monthLabel = date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
  return {
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
    label: monthLabel.replace('.', ''),
    sortKey: year * 100 + month + 1,
  };
}

export function filterChecksForAnalytics(checks: Check[], filters: CheckAnalyticsFilters): Check[] {
  const auditorSet = new Set(filters.auditors.filter(Boolean));

  return checks.filter((check) => {
    const startMs = parseDateValue(check.start_date);
    if (startMs === null) {
      return false;
    }
    if (auditorSet.size > 0 && !auditorSet.has(check.check_leader)) {
      return false;
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
