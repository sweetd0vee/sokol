import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Check } from '../../types/check';
import type { Recommendation } from '../../types/recommendation';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from '../analytics/AnalyticsDashboardGrid';
import { AnalyticsFilterSidebar } from '../analytics/AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from '../analytics/AnalyticsSelectionSummary';
import {
  ChartCard,
  CHART_AXIS_TICK,
  CHART_CATEGORY_AXIS_TICK,
  CHART_LEGEND_STYLE,
  CHART_VALUE_LABEL_SIZE,
  EmptyChart,
  KpiCard,
} from '../analytics/AnalyticsChartPrimitives';
import { FocusableDonutChart } from '../analytics/FocusableDonutChart';
import { CHECKS_PALETTE, RECOMMENDATIONS_PALETTE } from '../analytics/analyticsPalette';
import type { AnalyticsExportFormat } from '../../utils/analyticsExport';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { parseDateValue } from '../../utils/dates';
import {
  collectAuditObjects,
  filterChecksForAnalytics,
} from '../../utils/checkAnalytics';
import { filterRecommendationsForAnalytics } from '../../utils/recommendationAnalytics';
import {
  PLANNING_HIGH_MATERIALITY_COLOR,
  buildCoveredDepartments,
  buildDepartmentAnalytics,
  buildDepartmentCoverage,
  buildHighMaterialityByDepartment,
} from '../../utils/planningAnalytics';

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
      ...recommendations.map((item) => parseDateValue(item.deadline)),
      new Date(2025, 0, 1).getTime(),
      new Date(2026, 11, 1).getTime(),
    ],
    [checks, recommendations],
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

  const allDepartments = useMemo(() => collectAuditObjects(recommendations), [recommendations]);
  const departmentOptions = useMemo(
    () => toAnalyticsSelectOptions(allDepartments),
    [allDepartments],
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

  // Coverage must be calculated only by the selected period (not by the "selected departments" filter).
  const filteredChecksForCoverage = useMemo(
    () =>
      filterChecksForAnalytics(checks, {
        auditors: [],
        departments: [],
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
      selectedYearKeys,
      selectedQuarterKeys,
      selectedMonthKeys,
    ],
  );

  const filteredRecommendations = useMemo(
    () =>
      filterRecommendationsForAnalytics(recommendations, {
        dateFrom: null,
        dateTo: null,
        auditors: [],
        departments: selectedDepartments,
        materialityLevels: [],
        granularity: 'month',
        selectedPeriods: [],
        selectedYears: selectedYearKeys,
        selectedQuarters: selectedQuarterKeys,
        selectedMonths: selectedMonthKeys,
      }),
    [
      recommendations,
      selectedDepartments,
      selectedYearKeys,
      selectedQuarterKeys,
      selectedMonthKeys,
    ],
  );

  const coveredDepartments = useMemo(
    () => buildCoveredDepartments(filteredChecksForCoverage, recommendations),
    [filteredChecksForCoverage, recommendations],
  );
  const coverage = useMemo(
    () => buildDepartmentCoverage(allDepartments, coveredDepartments),
    [allDepartments, coveredDepartments],
  );
  const departmentAnalytics = useMemo(
    () => buildDepartmentAnalytics(filteredChecks, filteredRecommendations),
    [filteredChecks, filteredRecommendations],
  );
  const highMaterialityRanking = useMemo(
    () => buildHighMaterialityByDepartment(filteredRecommendations),
    [filteredRecommendations],
  );
  const highMaterialityTotal = useMemo(
    () => highMaterialityRanking.reduce((sum, item) => sum + item.value, 0),
    [highMaterialityRanking],
  );

  const resetFilters = () => {
    resetPeriodSelections();
    setSelectedDepartments([]);
  };

  const cards = useMemo<AnalyticsGridCard[]>(
    () => [
      {
        id: 'summary',
        defaultLayout: { x: 0, y: 0, w: 12, h: 2, minW: 8, minH: 2 },
        render: () => (
          <ChartCard title="Сводка планирования" description="" dense>
            <div className="grid w-full grid-cols-2 gap-1 sm:grid-cols-4">
              <KpiCard label="Охват департаментов" value={coverage.coverageRate} suffix="%" tone="blue" />
              <KpiCard label="С проверками" value={coverage.covered} hint={`из ${coverage.total}`} tone="green" />
              <KpiCard label="Не охвачено" value={coverage.uncoveredRate} suffix="%" tone="slate" />
              <KpiCard label="Красные рекомендации" value={highMaterialityTotal} tone="red" />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'coverage',
        defaultLayout: { x: 0, y: 2, w: 6, h: 4, minW: 3, minH: 3 },
        render: () => (
          <ChartCard
            title="Охват департаментов"
            description="Доля подразделений с проверками за выбранный период"
          >
            {coverage.total === 0 ? (
              <EmptyChart message="Нет департаментов в данных" />
            ) : (
              <div className="flex h-full min-h-[13rem] flex-col gap-3">
                <div className="min-h-0 flex-1">
                  {coverage.donut.length === 0 ? (
                    <EmptyChart message="Нет данных" />
                  ) : (
                    <FocusableDonutChart data={coverage.donut} />
                  )}
                </div>
                {coverage.uncoveredDepartments.length > 0 ? (
                  <div className="shrink-0 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      Не охвачено: {coverage.uncoveredRate}% ({coverage.uncovered} из {coverage.total})
                    </p>
                    <div className="mt-2 max-h-28 overflow-auto pr-1">
                      <div className="flex flex-wrap gap-1">
                        {coverage.uncoveredDepartments.map((name) => (
                          <span
                            key={name}
                            className="rounded-md bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                            title={name}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="shrink-0 text-xs text-emerald-700 dark:text-emerald-300">
                    Все известные департаменты охвачены проверками за период
                  </p>
                )}
              </div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'departmentAnalytics',
        defaultLayout: { x: 6, y: 2, w: 6, h: 4, minW: 3, minH: 3 },
        render: () => (
          <ChartCard
            title="Аналитика департаментов"
            description="Проверки и рекомендации по подразделениям"
          >
            {departmentAnalytics.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={departmentAnalytics}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={CHART_CATEGORY_AXIS_TICK}
                    />
                    <Tooltip />
                    <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                    <Bar dataKey="checks" name="Проверки" fill={CHECKS_PALETTE[8]} radius={[0, 4, 4, 0]} />
                    <Bar
                      dataKey="recommendations"
                      name="Рекомендации"
                      fill={RECOMMENDATIONS_PALETTE[2]}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'highMateriality',
        defaultLayout: { x: 0, y: 6, w: 12, h: 4, minW: 6, minH: 3 },
        render: () => (
          <ChartCard
            title="Красные рекомендации по департаментам"
            description="Подразделения с наибольшим числом рекомендаций высокой существенности"
          >
            {highMaterialityRanking.length === 0 ? (
              <EmptyChart message="Нет красных рекомендаций за период" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={highMaterialityRanking}
                    layout="vertical"
                    margin={{ top: 8, right: 36, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={CHART_CATEGORY_AXIS_TICK}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="value"
                      name="Высокая существенность"
                      fill={PLANNING_HIGH_MATERIALITY_COLOR}
                      radius={[0, 6, 6, 0]}
                    >
                      <LabelList dataKey="value" position="right" fontSize={CHART_VALUE_LABEL_SIZE} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ),
      },
    ],
    [coverage, departmentAnalytics, highMaterialityRanking, highMaterialityTotal],
  );

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
              {
                label: 'Рекомендаций',
                value: filteredRecommendations.length,
                hint: `из ${recommendations.length}`,
              },
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
                onRemove: (value) =>
                  setSelectedDepartments((prev) => prev.filter((item) => item !== value)),
              },
            ]}
          />
        )}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AnalyticsDashboardGrid cards={cards} />
      </main>
    </div>
  );
}
