import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { fetchPlanningAnalytics } from '../../api/analytics';
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
import { CHECKS_PALETTE, RECOMMENDATIONS_PALETTE } from '../analytics/analyticsPalette';
import type { AnalyticsExportFormat } from '../../utils/analyticsExport';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { hasAnalyticsPeriodFilters, useAnalyticsAnchorDates } from '../../hooks/useAnalyticsAnchorDates';
import { PLANNING_HIGH_MATERIALITY_COLOR } from '../../utils/planningAnalytics';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import type { PeriodGranularity } from '../../utils/checkAnalytics';

const EMPTY_COVERAGE = {
  covered: 0,
  uncovered: 0,
  total: 0,
  coverageRate: 0,
  uncoveredRate: 0,
  coveredDepartments: [],
  uncoveredDepartments: [],
  donut: [],
  checksByDepartment: [],
};
const EMPTY_DEPARTMENT_ANALYTICS: never[] = [];
const EMPTY_HIGH_MATERIALITY_RANKING: never[] = [];

export function PlanningAnalyticsDashboard() {
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<AnalyticsExportFormat>('html');

  const bootstrapQuery = useQuery({
    queryKey: ['analytics', 'planning', 'bootstrap'],
    queryFn: () => fetchPlanningAnalytics({ granularity: 'year' }),
    staleTime: 60_000,
  });

  const anchorDates = useAnalyticsAnchorDates(bootstrapQuery.data?.filterOptions.anchorDates);
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

  const granularity: PeriodGranularity = periodSlice;
  const hasActiveFilters = hasAnalyticsPeriodFilters({
    yearKeys: selectedYearKeys,
    quarterKeys: selectedQuarterKeys,
    monthKeys: selectedMonthKeys,
    departments: selectedDepartments,
    granularity,
  });

  const analyticsQuery = useQuery({
    queryKey: [
      'analytics',
      'planning',
      granularity,
      selectedYearKeys,
      selectedQuarterKeys,
      selectedMonthKeys,
      selectedDepartments,
    ],
    queryFn: () =>
      fetchPlanningAnalytics({
        granularity,
        years: selectedYearKeys,
        quarters: selectedQuarterKeys,
        months: selectedMonthKeys,
        departments: selectedDepartments,
      }),
    enabled: bootstrapQuery.isSuccess,
    initialData: !hasActiveFilters ? bootstrapQuery.data : undefined,
    initialDataUpdatedAt: !hasActiveFilters ? bootstrapQuery.dataUpdatedAt : undefined,
  });

  const data = analyticsQuery.data ?? bootstrapQuery.data;
  const departmentOptions = useMemo(
    () => toAnalyticsSelectOptions(data?.filterOptions.departments ?? []),
    [data?.filterOptions.departments],
  );

  const coverage = data?.coverage ?? EMPTY_COVERAGE;
  const departmentAnalytics = data?.departmentAnalytics ?? EMPTY_DEPARTMENT_ANALYTICS;
  const highMaterialityRanking = data?.highMaterialityByDepartment ?? EMPTY_HIGH_MATERIALITY_RANKING;
  const highMaterialityTotal = data?.highMaterialityTotal ?? 0;
  const filteredChecksTotal = data?.filteredChecksTotal ?? 0;
  const filteredRecommendationsTotal = data?.filteredRecommendationsTotal ?? 0;
  const universeChecksTotal = data?.universeChecksTotal ?? 0;
  const universeRecommendationsTotal = data?.universeRecommendationsTotal ?? 0;

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
        defaultLayout: { x: 0, y: 2, w: 6, h: 5, minW: 3, minH: 3 },
        render: () => {
          const uncoveredDepartments = coverage.uncoveredDepartments;
          return (
            <ChartCard
              title="Охват департаментов"
              description="Неохваченные департаменты за выбранный период"
            >
              {coverage.total === 0 ? (
                <EmptyChart message="Нет департаментов в данных" />
              ) : (
                <div className="flex h-full min-h-[13rem] flex-col gap-2">
                  {uncoveredDepartments.length === 0 ? (
                    <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 px-4 text-center text-sm font-semibold text-emerald-700">
                      Все департаменты охвачены проверками за выбранный период
                    </div>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white">
                      <ol className="divide-y divide-slate-100">
                        {uncoveredDepartments.map((department, index) => (
                          <li key={department} className="flex items-start gap-3 px-3 py-2 text-sm text-slate-700">
                            <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                              {index + 1}
                            </span>
                            <span className="leading-snug">{department}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <p className="shrink-0 text-sm font-semibold leading-snug text-sber-dark">
                    Не охвачено: {coverage.uncovered} из {coverage.total} ({coverage.uncoveredRate}%)
                  </p>
                </div>
              )}
            </ChartCard>
          );
        },
      },
      {
        id: 'departmentAnalytics',
        defaultLayout: { x: 6, y: 2, w: 6, h: 5, minW: 3, minH: 3 },
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
        defaultLayout: { x: 0, y: 7, w: 12, h: 4, minW: 6, minH: 3 },
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

  if (bootstrapQuery.isLoading && !data) {
    return <LoadingState title="Загрузка аналитики планирования…" />;
  }
  if ((bootstrapQuery.isError || analyticsQuery.isError) && !data) {
    const error = analyticsQuery.error ?? bootstrapQuery.error;
    return (
      <ErrorState
        title="Не удалось загрузить аналитику планирования"
        description={error instanceof Error ? error.message : 'неизвестная ошибка'}
      />
    );
  }

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
              { label: 'Проверок', value: filteredChecksTotal, hint: `из ${universeChecksTotal}` },
              {
                label: 'Рекомендаций',
                value: filteredRecommendationsTotal,
                hint: `из ${universeRecommendationsTotal}`,
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
