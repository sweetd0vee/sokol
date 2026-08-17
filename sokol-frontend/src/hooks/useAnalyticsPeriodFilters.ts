import { useCallback, useMemo, useState } from 'react';
import type { AnalyticsPeriodSlice } from '../components/analytics/AnalyticsFilterSidebar';
import { collectCalendarPeriodOptions, periodKeysFromLabels } from '../utils/analyticsPeriod';

export type AnalyticsSelectOption = {
  value: string;
  label: string;
};

export function toAnalyticsSelectOptions(values: string[]): AnalyticsSelectOption[] {
  return values.map((value) => ({ value, label: value }));
}

export function useAnalyticsPeriodFilters(anchorDates: number[]) {
  const [periodSlice, setPeriodSlice] = useState<AnalyticsPeriodSlice>('year');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedQuarters, setSelectedQuarters] = useState<string[]>([]);

  const yearOptions = useMemo(
    () => toAnalyticsSelectOptions(collectCalendarPeriodOptions(anchorDates, 'year').map((item) => item.label)),
    [anchorDates],
  );
  const quarterOptions = useMemo(
    () => toAnalyticsSelectOptions(collectCalendarPeriodOptions(anchorDates, 'quarter').map((item) => item.label)),
    [anchorDates],
  );

  const selectedYearKeys = useMemo(
    () => periodKeysFromLabels(anchorDates, 'year', selectedYears),
    [anchorDates, selectedYears],
  );
  const selectedQuarterKeys = useMemo(
    () => periodKeysFromLabels(anchorDates, 'quarter', selectedQuarters),
    [anchorDates, selectedQuarters],
  );

  const periodSliceLabel = periodSlice === 'quarter' ? 'Квартал' : 'Год';
  const activePeriodValues = periodSlice === 'quarter' ? selectedQuarters : selectedYears;

  const handlePeriodSliceChange = useCallback((next: AnalyticsPeriodSlice) => {
    setPeriodSlice(next);
    setSelectedYears([]);
    setSelectedQuarters([]);
  }, []);

  const resetPeriodSelections = useCallback(() => {
    setPeriodSlice('year');
    setSelectedYears([]);
    setSelectedQuarters([]);
  }, []);

  const removeActivePeriodValue = useCallback(
    (value: string) => {
      if (periodSlice === 'quarter') {
        setSelectedQuarters((prev) => prev.filter((item) => item !== value));
      } else {
        setSelectedYears((prev) => prev.filter((item) => item !== value));
      }
    },
    [periodSlice],
  );

  return {
    periodSlice,
    selectedYears,
    selectedQuarters,
    setSelectedYears,
    setSelectedQuarters,
    yearOptions,
    quarterOptions,
    selectedYearKeys,
    selectedQuarterKeys,
    periodSliceLabel,
    activePeriodValues,
    handlePeriodSliceChange,
    resetPeriodSelections,
    removeActivePeriodValue,
  };
}
