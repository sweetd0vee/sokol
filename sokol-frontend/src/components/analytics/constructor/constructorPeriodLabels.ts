import { displayPeriodLabel, type PeriodGranularity } from '../../../utils/analyticsPeriod';

export function withYearChartLabels<T extends { label: string }>(data: T[], granularity?: PeriodGranularity): T[] {
  if (granularity !== 'year') {
    return data;
  }
  return data.map((item) => ({ ...item, label: displayPeriodLabel(item.label, 'year') }));
}

export function withYearChartField(
  data: Array<Record<string, string | number>>,
  xKey: string,
  granularity?: PeriodGranularity,
): Array<Record<string, string | number>> {
  if (granularity !== 'year') {
    return data;
  }
  return data.map((row) => ({
    ...row,
    [xKey]: displayPeriodLabel(String(row[xKey] ?? ''), 'year'),
  }));
}
