import { CHART_AXIS_TICK } from './AnalyticsChartPrimitives';
import { RECOMMENDATIONS_MATERIALITY_CHART_COLORS } from './analyticsPalette';
import type { PeriodGranularity } from '../../utils/checkAnalytics';

export const MATERIALITY_STACK_KEYS = ['low', 'medium', 'high'] as const;

export function getPeriodXAxisProps(granularity?: PeriodGranularity) {
  if (granularity === 'quarter') {
    return {
      interval: 0 as const,
      height: 40,
      tickMargin: 8,
      minTickGap: 0,
      tick: {
        ...CHART_AXIS_TICK,
        fontSize: 12,
      },
    };
  }

  return {};
}

export function getMaterialitySegmentColor(key: string) {
  if (key === 'low') {
    return RECOMMENDATIONS_MATERIALITY_CHART_COLORS.низкий;
  }
  if (key === 'medium') {
    return RECOMMENDATIONS_MATERIALITY_CHART_COLORS.средний;
  }
  if (key === 'high') {
    return RECOMMENDATIONS_MATERIALITY_CHART_COLORS.высокий;
  }
  return '#e5e7eb';
}
