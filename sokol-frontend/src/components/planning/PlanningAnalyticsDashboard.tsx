import { useMemo, useState } from 'react';
import type { Check } from '../../types/check';
import type { Recommendation } from '../../types/recommendation';
import { AnalyticsFilterSidebar } from '../analytics/AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from '../analytics/AnalyticsSelectionSummary';
import type { AnalyticsExportFormat } from '../../utils/analyticsExport';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { parseDateValue } from '../../utils/dates';
import {
  collectAuditObjects,
  filterChecksForAnalytics,
} from '../../utils/checkAnalytics';

type PlanningAnalyticsDashboardProps = {
  checks: Check[];
  recommendations: Recommendation[];
};

export function PlanningAnalyticsDashboard({
  checks,
  recommendations,
}: PlanningAnalyticsDashboardProps) {
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

  const {
    periodSlice,
    selectedYears,
    selectedQuarters,
    selectedMonths,
    setSelectedYears,
    setSelectedQuarters,
    setSelectedMonths,
    yearOptions,
    quarterOptions,
    monthOptions,
    selectedYearKeys,
    selectedQuarterKeys,
    selectedMonthKeys,
    periodSliceLabel,
    activePeriodValues,
    handlePeriodSliceChange,
    resetPeriodSelections,
    removeActivePeriodValue,
  } = useAnalyticsPeriodFilters(anchorDates);

  const departmentOptions = useMemo(
    () => toAnalyticsSelectOptions(collectAuditObjects(recommendations)),
    [recommendations],
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

  const resetFilters = () => {
    resetPeriodSelections();
    setSelectedDepartments([]);
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
                onRemove: removeActivePeriodValue,
              },
              {
                label: 'Департаменты',
                chips: selectedDepartments.map((value) => ({ value, label: value })),
                emptyLabel: 'Все департаменты',
                onRemove: (value) => setSelectedDepartments((prev) => prev.filter((item) => item !== value)),
              },
            ]}
          />
        )}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-full min-h-[24rem] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white px-6 text-center dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-base font-semibold text-sber-dark dark:text-sber-light">
            Дашборды планирования
          </p>
          <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-slate-400">
            Карточка «Метрики» готова. Здесь появятся охваты департаментов, аналитика по подразделениям
            и рейтинги по красным рекомендациям.
          </p>
        </div>
      </main>
    </div>
  );
}
