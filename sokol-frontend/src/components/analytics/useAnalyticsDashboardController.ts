import { useMemo } from 'react';
import { useQuery, type QueryKey } from '@tanstack/react-query';
import type { AnalyticsQueryParams } from '../../api/analytics';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { hasAnalyticsPeriodFilters, useAnalyticsAnchorDates } from '../../hooks/useAnalyticsAnchorDates';
import type { PeriodGranularity } from '../../utils/analyticsPeriod';
import { useAnalyticsDashboardSession } from './useAnalyticsDashboardSession';

type AnalyticsFilterOptionsShape = {
  auditors?: string[];
  departments: string[];
  anchorDates: string[];
};

type UseAnalyticsDashboardControllerOptions<TData extends { filterOptions: AnalyticsFilterOptionsShape }> = {
  resource: string;
  bootstrapQueryKey: QueryKey;
  fetchBootstrap: () => Promise<TData>;
  fetchFiltered: (params: AnalyticsQueryParams) => Promise<TData>;
  /**
   * When filters are active, do not fall back to bootstrap chart data until the filtered
   * query returns (checks dashboard behaviour).
   */
  preferFilteredData?: boolean;
};

export function useAnalyticsDashboardController<TData extends { filterOptions: AnalyticsFilterOptionsShape }>({
  resource,
  bootstrapQueryKey,
  fetchBootstrap,
  fetchFiltered,
  preferFilteredData = false,
}: UseAnalyticsDashboardControllerOptions<TData>) {
  const session = useAnalyticsDashboardSession();
  const {
    selectedAuditors,
    setSelectedAuditors,
    selectedDepartments,
    setSelectedDepartments,
    exportFormat,
    setExportFormat,
    isExporting,
    setIsExporting,
    removeAuditor,
    removeDepartment,
    resetEntityFilters,
  } = session;

  const bootstrapQuery = useQuery({
    queryKey: bootstrapQueryKey,
    queryFn: fetchBootstrap,
    staleTime: 60_000,
  });

  const anchorDates = useAnalyticsAnchorDates(bootstrapQuery.data?.filterOptions.anchorDates);
  const periodFilters = useAnalyticsPeriodFilters(anchorDates);
  const {
    periodSlice,
    selectedYearKeys,
    selectedQuarterKeys,
    resetPeriodSelections,
  } = periodFilters;

  const granularity: PeriodGranularity = periodSlice;
  const hasActiveFilters = hasAnalyticsPeriodFilters({
    yearKeys: selectedYearKeys,
    quarterKeys: selectedQuarterKeys,
    monthKeys: [],
    auditors: selectedAuditors,
    departments: selectedDepartments,
    granularity,
  });

  const analyticsQuery = useQuery({
    queryKey: [
      'analytics',
      resource,
      granularity,
      selectedYearKeys,
      selectedQuarterKeys,
      selectedAuditors,
      selectedDepartments,
    ],
    queryFn: () =>
      fetchFiltered({
        granularity,
        years: selectedYearKeys,
        quarters: selectedQuarterKeys,
        months: [],
        auditors: selectedAuditors,
        departments: selectedDepartments,
      }),
    enabled: bootstrapQuery.isSuccess,
    initialData: !hasActiveFilters ? bootstrapQuery.data : undefined,
    initialDataUpdatedAt: !hasActiveFilters ? bootstrapQuery.dataUpdatedAt : undefined,
  });

  const data = preferFilteredData
    ? (hasActiveFilters ? analyticsQuery.data : (analyticsQuery.data ?? bootstrapQuery.data))
    : (analyticsQuery.data ?? bootstrapQuery.data);
  const filterOptionsData = data ?? bootstrapQuery.data;
  const isWaitingForFilteredData =
    preferFilteredData && hasActiveFilters && analyticsQuery.isFetching && !analyticsQuery.data;

  const auditorOptions = useMemo(
    () => toAnalyticsSelectOptions(filterOptionsData?.filterOptions.auditors ?? []),
    [filterOptionsData?.filterOptions.auditors],
  );
  const departmentOptions = useMemo(
    () => toAnalyticsSelectOptions(filterOptionsData?.filterOptions.departments ?? []),
    [filterOptionsData?.filterOptions.departments],
  );

  const resetFilters = () => {
    resetPeriodSelections();
    resetEntityFilters();
  };

  return {
    selectedAuditors,
    setSelectedAuditors,
    selectedDepartments,
    setSelectedDepartments,
    exportFormat,
    setExportFormat,
    isExporting,
    setIsExporting,
    removeAuditor,
    removeDepartment,
    ...periodFilters,
    granularity,
    hasActiveFilters,
    bootstrapQuery,
    analyticsQuery,
    data,
    auditorOptions,
    departmentOptions,
    isWaitingForFilteredData,
    resetFilters,
  };
}
