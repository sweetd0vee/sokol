import type {
  MaterialityLevel,
  Recommendation,
  RecommendationAdditionalStatus,
  RecommendationIndicator,
  RecommendationStatus,
} from '../types/recommendation';
import {
  getIndicatorLabel,
  getMaterialityLevelLabel,
  getRecommendationAdditionalStatusLabel,
  getRecommendationStatusLabel,
} from '../constants/recommendations';
import { parseDateValue, toEndOfDayMs, toStartOfDayMs } from './dates';
import {
  getPeriodBucket,
  isDateInSelectedPeriods,
  type PeriodBucket,
  type PeriodGranularity,
} from './analyticsPeriod';

export type { PeriodGranularity, PeriodBucket };

export type RecommendationAnalyticsFilters = {
  dateFrom: Date | null;
  dateTo: Date | null;
  auditors: string[];
  materialityLevels: MaterialityLevel[];
  granularity: PeriodGranularity;
  selectedPeriods: string[];
};

export type NamedCount = {
  name: string;
  value: number;
  color?: string;
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

export type AuditorMaterialityRow = {
  auditor: string;
  total: number;
  низкий: number;
  средний: number;
  высокий: number;
  completed: number;
  violated: number;
};

export type AuditorPeriodRow = {
  auditor: string;
  total: number;
  byPeriod: Record<string, number>;
};

export const MATERIALITY_COLORS: Record<MaterialityLevel, string> = {
  низкий: '#6B9F7C',
  средний: '#B89750',
  высокий: '#B56E6E',
};

export const STATUS_COLORS: Record<RecommendationStatus, string> = {
  completed: '#6B9F7C',
  unresolved: '#B56E6E',
  on_control: '#7A8B9E',
  in_progress: '#B89050',
};

export const ADDITIONAL_STATUS_COLORS: Record<RecommendationAdditionalStatus, string> = {
  on_time: '#5F9788',
  deadline_violated: '#B56E7A',
  on_control: '#7B7AA4',
};

export const INDICATOR_COLORS: Record<RecommendationIndicator, string> = {
  'не указан': '#9AA3B0',
  'в процессе': '#B89750',
  ожидает: '#9A96B4',
  'не решено': '#B88888',
  исполнено: '#6B9F8A',
};

const STATUS_KEYS: RecommendationStatus[] = ['completed', 'unresolved', 'on_control', 'in_progress'];
const MATERIALITY_KEYS: MaterialityLevel[] = ['низкий', 'средний', 'высокий'];

export function filterRecommendationsForAnalytics(
  recommendations: Recommendation[],
  filters: RecommendationAnalyticsFilters,
): Recommendation[] {
  const fromMs = filters.dateFrom ? toStartOfDayMs(filters.dateFrom) : null;
  const toMs = filters.dateTo ? toEndOfDayMs(filters.dateTo) : null;
  const auditorSet = new Set(filters.auditors.filter(Boolean));
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
    if (materialitySet.size > 0 && !materialitySet.has(item.materiality_level)) {
      return false;
    }
    if (!isDateInSelectedPeriods(deadlineMs, filters.granularity, filters.selectedPeriods)) {
      return false;
    }
    return true;
  });
}

export function summarizeRecommendations(recommendations: Recommendation[]) {
  const byStatus: Record<RecommendationStatus, number> = {
    completed: 0,
    unresolved: 0,
    on_control: 0,
    in_progress: 0,
  };
  const byMateriality: Record<MaterialityLevel, number> = {
    низкий: 0,
    средний: 0,
    высокий: 0,
  };
  const byAdditional: Record<RecommendationAdditionalStatus, number> = {
    on_time: 0,
    deadline_violated: 0,
    on_control: 0,
  };

  recommendations.forEach((item) => {
    byStatus[item.status] += 1;
    byMateriality[item.materiality_level] += 1;
    byAdditional[item.additional_status] += 1;
  });

  const withExtensions = recommendations.filter(
    (item) =>
      (item.deadline_extensions?.some((row) => row.date || row.comment) ?? false)
      || Boolean(item.extension_1_date || item.extension_1_comment || item.extension_2_comment),
  ).length;

  const withCompletionDate = recommendations.filter((item) => Boolean(item.actual_completion_date)).length;
  const completionRate = recommendations.length
    ? Math.round((byStatus.completed / recommendations.length) * 100)
    : 0;
  const violationRate = recommendations.length
    ? Math.round((byAdditional.deadline_violated / recommendations.length) * 100)
    : 0;

  return {
    total: recommendations.length,
    byStatus,
    byMateriality,
    byAdditional,
    withExtensions,
    withCompletionDate,
    completionRate,
    violationRate,
  };
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

export function buildStatusDistribution(recommendations: Recommendation[]): NamedCount[] {
  const summary = summarizeRecommendations(recommendations);
  return STATUS_KEYS
    .map((status) => ({
      name: getRecommendationStatusLabel(status),
      value: summary.byStatus[status],
      color: STATUS_COLORS[status],
    }))
    .filter((item) => item.value > 0);
}

export function buildMaterialityDistribution(recommendations: Recommendation[]): NamedCount[] {
  const summary = summarizeRecommendations(recommendations);
  return MATERIALITY_KEYS
    .map((level) => ({
      name: getMaterialityLevelLabel(level),
      value: summary.byMateriality[level],
      color: MATERIALITY_COLORS[level],
    }))
    .filter((item) => item.value > 0);
}

export function buildAdditionalStatusDistribution(recommendations: Recommendation[]): NamedCount[] {
  const summary = summarizeRecommendations(recommendations);
  return (Object.keys(summary.byAdditional) as RecommendationAdditionalStatus[])
    .map((status) => ({
      name: getRecommendationAdditionalStatusLabel(status),
      value: summary.byAdditional[status],
      color: ADDITIONAL_STATUS_COLORS[status],
    }))
    .filter((item) => item.value > 0);
}

export function buildIndicatorDistribution(recommendations: Recommendation[]): NamedCount[] {
  const map = new Map<RecommendationIndicator, number>();
  recommendations.forEach((item) => {
    map.set(item.indicator, (map.get(item.indicator) ?? 0) + 1);
  });
  return [...map.entries()]
    .map(([indicator, value]) => ({
      name: getIndicatorLabel(indicator),
      value,
      color: INDICATOR_COLORS[indicator],
    }))
    .sort((a, b) => b.value - a.value);
}

export function buildAuditorDistribution(recommendations: Recommendation[]): NamedCount[] {
  const map = new Map<string, number>();
  recommendations.forEach((item) => {
    const name = item.auditor.trim() || 'Без аудитора';
    map.set(name, (map.get(name) ?? 0) + 1);
  });
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildManagerDistribution(recommendations: Recommendation[]): NamedCount[] {
  const map = new Map<string, number>();
  recommendations.forEach((item) => {
    const name = item.manager.trim() || 'Без менеджера';
    map.set(name, (map.get(name) ?? 0) + 1);
  });
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildAuditObjectDistribution(recommendations: Recommendation[]): NamedCount[] {
  const map = new Map<string, number>();
  recommendations.forEach((item) => {
    const name = item.audit_object.trim() || 'Без объекта';
    map.set(name, (map.get(name) ?? 0) + 1);
  });
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildAuditorMaterialityRows(recommendations: Recommendation[]): AuditorMaterialityRow[] {
  const map = new Map<string, AuditorMaterialityRow>();

  recommendations.forEach((item) => {
    const auditor = item.auditor.trim() || 'Без аудитора';
    const row = map.get(auditor) ?? {
      auditor,
      total: 0,
      низкий: 0,
      средний: 0,
      высокий: 0,
      completed: 0,
      violated: 0,
    };
    row.total += 1;
    row[item.materiality_level] += 1;
    if (item.status === 'completed') {
      row.completed += 1;
    }
    if (item.additional_status === 'deadline_violated') {
      row.violated += 1;
    }
    map.set(auditor, row);
  });

  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function buildAuditorPeriodMatrix(
  recommendations: Recommendation[],
  granularity: PeriodGranularity,
): { periods: PeriodBucket[]; rows: AuditorPeriodRow[] } {
  const periodMap = new Map<string, PeriodBucket>();
  const rowMap = new Map<string, AuditorPeriodRow>();

  recommendations.forEach((item) => {
    const deadlineMs = parseDateValue(item.deadline);
    if (deadlineMs === null) {
      return;
    }
    const period = getPeriodBucket(deadlineMs, granularity);
    periodMap.set(period.key, period);

    const auditor = item.auditor.trim() || 'Без аудитора';
    const row = rowMap.get(auditor) ?? {
      auditor,
      total: 0,
      byPeriod: {},
    };
    row.total += 1;
    row.byPeriod[period.key] = (row.byPeriod[period.key] ?? 0) + 1;
    rowMap.set(auditor, row);
  });

  return {
    periods: [...periodMap.values()].sort((a, b) => a.sortKey - b.sortKey),
    rows: [...rowMap.values()].sort((a, b) => b.total - a.total),
  };
}

export function buildMaterialityPeriodMatrix(
  recommendations: Recommendation[],
  granularity: PeriodGranularity,
) {
  const periodMap = new Map<string, PeriodBucket>();
  const counts: Record<MaterialityLevel, Record<string, number>> = {
    низкий: {},
    средний: {},
    высокий: {},
  };

  recommendations.forEach((item) => {
    const deadlineMs = parseDateValue(item.deadline);
    if (deadlineMs === null) {
      return;
    }
    const period = getPeriodBucket(deadlineMs, granularity);
    periodMap.set(period.key, period);
    counts[item.materiality_level][period.key] =
      (counts[item.materiality_level][period.key] ?? 0) + 1;
  });

  const periods = [...periodMap.values()].sort((a, b) => a.sortKey - b.sortKey);
  return {
    periods,
    rows: MATERIALITY_KEYS.map((level) => ({
      level,
      label: getMaterialityLevelLabel(level),
      color: MATERIALITY_COLORS[level],
      byPeriod: counts[level],
      total: Object.values(counts[level]).reduce((sum, value) => sum + value, 0),
    })),
  };
}

export function buildDeadlineBuckets(recommendations: Recommendation[]): NamedCount[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const buckets = [
    { name: 'Просрочено', color: '#B56E6E', test: (ms: number) => ms < now },
    { name: '≤ 7 дней', color: '#B8875E', test: (ms: number) => ms >= now && ms - now <= 7 * day },
    { name: '8–30 дней', color: '#B89750', test: (ms: number) => ms - now > 7 * day && ms - now <= 30 * day },
    { name: '31–90 дней', color: '#4F7FA8', test: (ms: number) => ms - now > 30 * day && ms - now <= 90 * day },
    { name: '> 90 дней', color: '#6B9F7C', test: (ms: number) => ms - now > 90 * day },
  ];

  return buckets
    .map((bucket) => ({
      name: bucket.name,
      color: bucket.color,
      value: recommendations.reduce((sum, item) => {
        const ms = parseDateValue(item.deadline);
        if (ms === null) {
          return sum;
        }
        return bucket.test(ms) ? sum + 1 : sum;
      }, 0),
    }))
    .filter((item) => item.value > 0);
}

export function buildFunnel(recommendations: Recommendation[]): NamedCount[] {
  const summary = summarizeRecommendations(recommendations);
  return [
    { name: 'Всего', value: summary.total, color: '#4F7FA8' },
    {
      name: 'На контроле / в работе',
      value: summary.byStatus.on_control + summary.byStatus.in_progress,
      color: '#B89050',
    },
    { name: 'В процессе', value: summary.byStatus.in_progress, color: '#B8875E' },
    { name: 'Исполнено', value: summary.byStatus.completed, color: '#6B9F7C' },
  ].filter((item) => item.value > 0);
}

export function buildScatterPoints(recommendations: Recommendation[]) {
  const byAuditor = buildAuditorMaterialityRows(recommendations);
  return byAuditor.map((row) => ({
    auditor: row.auditor,
    total: row.total,
    high: row.высокий,
    completed: row.completed,
    violated: row.violated,
    completionRate: row.total ? Math.round((row.completed / row.total) * 100) : 0,
  }));
}

export function buildTreemapData(recommendations: Recommendation[]) {
  const byAuditor = buildAuditorMaterialityRows(recommendations).slice(0, 12);
  return byAuditor.flatMap((row) =>
    MATERIALITY_KEYS
      .filter((level) => row[level] > 0)
      .map((level) => ({
        name: `${row.auditor} · ${getMaterialityLevelLabel(level)}`,
        size: row[level],
        fill: MATERIALITY_COLORS[level],
      })),
  );
}

export function buildRadialStatus(recommendations: Recommendation[]): NamedCount[] {
  return buildStatusDistribution(recommendations);
}

export function collectRecommendationAuditors(recommendations: Recommendation[]): string[] {
  return [...new Set(recommendations.map((item) => item.auditor).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ru'),
  );
}

export function buildCheckLinkDistribution(recommendations: Recommendation[]): NamedCount[] {
  const map = new Map<string, number>();
  recommendations.forEach((item) => {
    const key = item.serial_number.trim() || 'Без проверки';
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

export function buildMaterialityToStatusSankey(recommendations: Recommendation[]) {
  const materialityNodes = MATERIALITY_KEYS.map((level) => getMaterialityLevelLabel(level));
  const statusNodes = STATUS_KEYS.map((status) => getRecommendationStatusLabel(status));
  const nodes = [...materialityNodes, ...statusNodes].map((name) => ({ name }));
  const linkMap = new Map<string, number>();

  recommendations.forEach((item) => {
    const source = materialityNodes.indexOf(getMaterialityLevelLabel(item.materiality_level));
    const target = materialityNodes.length + statusNodes.indexOf(getRecommendationStatusLabel(item.status));
    const key = `${source}->${target}`;
    linkMap.set(key, (linkMap.get(key) ?? 0) + 1);
  });

  const links = [...linkMap.entries()].map(([key, value]) => {
    const [source, target] = key.split('->').map(Number);
    return { source, target, value };
  });

  return { nodes, links };
}

export function buildStatusFunnelNative(recommendations: Recommendation[]) {
  const summary = summarizeRecommendations(recommendations);
  return [
    { name: 'Всего', value: summary.total, fill: '#4F7FA8' },
    {
      name: 'Активные',
      value: summary.byStatus.on_control + summary.byStatus.in_progress + summary.byStatus.unresolved,
      fill: '#B89050',
    },
    { name: 'В процессе', value: summary.byStatus.in_progress, fill: '#B8875E' },
    { name: 'Исполнено', value: summary.byStatus.completed, fill: '#6B9F7C' },
  ];
}
