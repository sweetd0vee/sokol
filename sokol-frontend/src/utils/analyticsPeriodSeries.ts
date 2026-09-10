import { labelFromPeriodKey, type PeriodGranularity } from './analyticsPeriod';

export function withPeriodChartLabels<T extends { key: string; label: string }>(
  series: T[],
  granularity: PeriodGranularity,
): T[] {
  return series.map((item) => ({
    ...item,
    label: labelFromPeriodKey(item.key, granularity),
  }));
}

export function sortKeyFromPeriodKey(key: string, granularity: PeriodGranularity) {
  if (granularity === 'year') {
    return Number(key);
  }
  if (granularity === 'quarter') {
    const [year, quarter] = key.split('-Q');
    return Number(year) * 10 + Number(quarter);
  }
  const [year, month] = key.split('-');
  return Number(year) * 100 + Number(month);
}

/** Fill gaps for selected period keys and sort chronologically. */
export function completeSelectedPeriodPoints<T extends { key: string; sortKey: number }>(
  series: T[],
  selectedKeys: string[],
  createEmpty: (key: string) => T,
): T[] {
  if (selectedKeys.length === 0) {
    return series;
  }

  const byKey = new Map(series.map((item) => [item.key, item]));
  return selectedKeys
    .map((key) => byKey.get(key) ?? createEmpty(key))
    .sort((a, b) => a.sortKey - b.sortKey);
}

export function withRunningTotal<T extends { total: number }>(
  series: T[],
): Array<T & { cumulative: number }> {
  let cumulative = 0;
  return series.map((item) => {
    cumulative += item.total;
    return { ...item, cumulative };
  });
}

export function emptyChecksPeriodPoint(key: string, granularity: PeriodGranularity) {
  return {
    key,
    label: labelFromPeriodKey(key, granularity),
    sortKey: sortKeyFromPeriodKey(key, granularity),
    total: 0,
    not_started: 0,
    in_progress: 0,
    completed: 0,
    cumulative: 0,
  };
}

export function emptyRecommendationPeriodPoint(key: string) {
  return {
    key,
    label: labelFromPeriodKey(key, 'quarter'),
    sortKey: sortKeyFromPeriodKey(key, 'quarter'),
    total: 0,
    completed: 0,
    unresolved: 0,
    on_control: 0,
    in_progress: 0,
    low: 0,
    medium: 0,
    high: 0,
    cumulative: 0,
    cumulativeCompleted: 0,
  };
}

export function withRecommendationRunningTotals<
  T extends { total: number; completed: number },
>(series: T[]): Array<T & { cumulative: number; cumulativeCompleted: number }> {
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
