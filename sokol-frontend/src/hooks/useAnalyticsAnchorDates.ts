import { useMemo } from 'react';
import { parseDateValue } from '../utils/dates';

const EMPTY_ANCHOR_DATES = [new Date(2025, 0, 1).getTime(), new Date(2026, 11, 1).getTime()];

export function useAnalyticsAnchorDates(isoDates: string[] | undefined) {
  return useMemo(() => {
    const fromApi = (isoDates ?? [])
      .map((value) => parseDateValue(value))
      .filter((value): value is number => value !== null);
    return fromApi.length > 0 ? [...fromApi, ...EMPTY_ANCHOR_DATES] : EMPTY_ANCHOR_DATES;
  }, [isoDates]);
}

export function hasAnalyticsPeriodFilters(input: {
  yearKeys: string[];
  quarterKeys: string[];
  monthKeys: string[];
  auditors?: string[];
  departments?: string[];
  statuses?: string[];
  additionalStatuses?: string[];
  materialityLevels?: string[];
  granularity: string;
  defaultGranularity?: string;
}) {
  return (
    input.yearKeys.length > 0
    || input.quarterKeys.length > 0
    || input.monthKeys.length > 0
    || (input.auditors?.length ?? 0) > 0
    || (input.departments?.length ?? 0) > 0
    || (input.statuses?.length ?? 0) > 0
    || (input.additionalStatuses?.length ?? 0) > 0
    || (input.materialityLevels?.length ?? 0) > 0
    || input.granularity !== (input.defaultGranularity ?? 'year')
  );
}
