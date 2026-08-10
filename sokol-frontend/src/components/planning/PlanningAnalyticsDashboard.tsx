import { useMemo, useState } from 'react';
import type { Check } from '../../types/check';
import type { Recommendation } from '../../types/recommendation';
import { AnalyticsFilterSidebar, type AnalyticsPeriodSlice } from '../analytics/AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from '../analytics/AnalyticsSelectionSummary';
import type { AnalyticsExportFormat } from '../../utils/analyticsExport';
import { collectCalendarPeriodOptions, periodKeysFromLabels } from '../../utils/analyticsPeriod';
import { parseDateValue } from '../../utils/dates';
import {
  collectAuditObjects,
  filterChecksForAnalytics,
} from '../../utils/checkAnalytics';

type PlanningAnalyticsDashboardProps = {
  checks: Check[];
  recommendations: Recommendation[];
};

function toOptions(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

export function PlanningAnalyticsDashboard({
  checks,
  recommendations,
}: PlanningAnalyticsDashboardProps) {
  const [periodSlice, setPeriodSlice] = useState<AnalyticsPeriodSlice>('year');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedQuarters, setSelectedQuarters] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<AnalyticsExportFormat>('xlsx');

  const anchorDates = useMemo(
    () => [
      ...checks.map((check) => parseDateValue(check.start_date)),
      new Date(2025, 0, 1).getTime(),
      new Date(2026, 11, 1).getTime(),
    ],
    [checks],
  );

  const yearPeriodOptions = useMemo(
    () => collectCalendarPeriodOptions(anchorDates, 'year'),
    [anchorDates],
  );
  const quarterPeriodOptions = useMemo(
    () => collectCalendarPeriodOptions(anchorDates, 'quarter'),
    [anchorDates],
  );
  const monthPeriodOptions = useMemo(
    () => collectCalendarPeriodOptions(anchorDates, 'month'),
    [anchorDates],
  );

  const yearOptions = useMemo(
    () => toOptions(yearPeriodOptions.map((item) => item.label)),
    [yearPeriodOptions],
  );
  const quarterOptions = useMemo(
    () => toOptions(quarterPeriodOptions.map((item) => item.label)),
    [quarterPeriodOptions],
  );
  const monthOptions = useMemo(
    () => toOptions(monthPeriodOptions.map((item) => item.label)),
    [monthPeriodOptions],
  );
  const departmentOptions = useMemo(
    () => toOptions(collectAuditObjects(recommendations)),
    [recommendations],
  );

  const selectedYearKeys = useMemo(
    () => periodKeysFromLabels(anchorDates, 'year', selectedYears),
    [anchorDates, selectedYears],
  );
  const selectedQuarterKeys = useMemo(
    () => periodKeysFromLabels(anchorDates, 'quarter', selectedQuarters),
    [anchorDates, selectedQuarters],
  );
  const selectedMonthKeys = useMemo(
    () => periodKeysFromLabels(anchorDates, 'month', selectedMonths),
    [anchorDates, selectedMonths],
  );

  const filteredChecks = useMemo(
    () =>
      filterChecksForAnalytics(checks, {
        auditors: [],
        departments: selectedDepartments,
        recommendations,
        granularity: 'month',
        selectedPeriods: [],
        selectedYears: selectedYearKeys,
        selectedQuarters: selectedQuarterKeys,
        selectedMonths: selectedMonthKeys,
        effectivenessArea: 'any',
        selectedEffectivenessRatings: [],
      }),
    [
      checks,
      recommendations,
      selectedDepartments,
      selectedYearKeys,
      selectedQuarterKeys,
      selectedMonthKeys,
    ],
  );

  const periodSliceLabel =
    periodSlice === 'month' ? 'Месяц' : periodSlice === 'quarter' ? 'Квартал' : 'Год';
  const activePeriodValues =
    periodSlice === 'month'
      ? selectedMonths
      : periodSlice === 'quarter'
        ? selectedQuarters
        : selectedYears;

  const resetFilters = () => {
    setPeriodSlice('year');
    setSelectedYears([]);
    setSelectedQuarters([]);
    setSelectedMonths([]);
    setSelectedDepartments([]);
  };

  const handlePeriodSliceChange = (next: AnalyticsPeriodSlice) => {
    setPeriodSlice(next);
    setSelectedYears([]);
    setSelectedQuarters([]);
    setSelectedMonths([]);
  };

  return (
    <div className="flex flex-col gap-4 text-left lg:flex-row lg:items-stretch">
      <AnalyticsFilterSidebar
        periodSlice={periodSlice}
        onPeriodSliceChange={handlePeriodSliceChange}
        yearOptions={yearOptions}
        quarterOptions={quarterOptions}
        monthOptions={monthOptions}
        selectedYears={selectedYears}
        selectedQuarters={selectedQuarters}
        selectedMonths={selectedMonths}
        onYearsChange={setSelectedYears}
        onQuartersChange={setSelectedQuarters}
        onMonthsChange={setSelectedMonths}
        departmentOptions={departmentOptions}
        selectedDepartments={selectedDepartments}
        onDepartmentsChange={setSelectedDepartments}
        onResetFilters={resetFilters}
        exportFormat={exportFormat}
        onExportFormatChange={setExportFormat}
        isExporting={false}
        canExport={false}
        onExport={() => undefined}
        exportSelectedCount={0}
        exportTotalCount={0}
        onSelectAllExport={() => undefined}
        onClearExport={() => undefined}
        selectionSummary={(
          <AnalyticsSelectionSummary
            metrics={[
              { label: 'Проверок', value: filteredChecks.length, hint: `из ${checks.length}` },
            ]}
            items={[
              {
                label: periodSliceLabel,
                chips: activePeriodValues.map((value) => ({ value, label: value })),
                emptyLabel: 'Все значения',
                onRemove: (value) => {
                  if (periodSlice === 'month') {
                    setSelectedMonths((prev) => prev.filter((item) => item !== value));
                  } else if (periodSlice === 'quarter') {
                    setSelectedQuarters((prev) => prev.filter((item) => item !== value));
                  } else {
                    setSelectedYears((prev) => prev.filter((item) => item !== value));
                  }
                },
              },
              {
                label: 'Департаменты',
                chips: selectedDepartments.map((value) => ({ value, label: value })),
                emptyLabel: 'Все департаменты',
                onRemove: (value) =>
                  setSelectedDepartments((prev) => prev.filter((item) => item !== value)),
              },
            ]}
          />
        )}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 dark:border-slate-600 dark:bg-slate-800/60">
          <p className="max-w-md text-center text-sm text-gray-500 dark:text-slate-400">
            Здесь появятся дашборды планирования: охваты департаментов, аналитика по
            департаментам, департаменты с наибольшим числом красных рекомендаций и другие.
          </p>
        </div>
      </main>
    </div>
  );
}
