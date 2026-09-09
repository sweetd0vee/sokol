import { useMemo } from 'react';
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
import { queryKeys } from '../../api/queryKeys';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from '../analytics/AnalyticsDashboardGrid';
import { AnalyticsDashboardShell } from '../analytics/AnalyticsDashboardShell';
import {
  ChartCard,
  CHART_AXIS_TICK,
  CHART_CATEGORY_AXIS_TICK,
  CHART_LEGEND_STYLE,
  CHART_VALUE_LABEL_SIZE,
  CHART_VALUE_LABEL_WEIGHT,
  EmptyChart,
  KpiCard,
} from '../analytics/AnalyticsChartPrimitives';
import { CHECKS_PALETTE, RECOMMENDATIONS_PALETTE } from '../analytics/analyticsPalette';
import { exportGenericAnalyticsDashboard } from '../../utils/analyticsExport';
import { useExportSections } from '../../hooks/useExportSections';
import { PLANNING_EXPORT_SECTIONS, type PlanningExportSectionId } from '../../constants/analyticsExportSections';
import { useAddToConstructor } from '../analytics/constructor/useAddToConstructor';
import { buildPlanningConstructorDrafts } from '../analytics/constructor/buildConstructorWidgets';
import { buildConstructorFilterCaption } from '../analytics/constructor/constructorFilterCaption';
import { useAnalyticsDashboardController } from '../analytics/useAnalyticsDashboardController';
import { toAnalyticsFilterSidebarProps } from '../analytics/analyticsFilterSidebarProps';
import { runAnalyticsExport } from '../../utils/runAnalyticsExport';

const PLANNING_HIGH_MATERIALITY_COLOR = '#FF4347';

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
const PLANNING_EXPORT_SECTION_IDS = PLANNING_EXPORT_SECTIONS.map(
  (section) => section.id,
) as PlanningExportSectionId[];

export function PlanningAnalyticsDashboard() {
  const {
    selectedAuditors,
    selectedDepartments,
    exportFormat,
    setExportFormat,
    isExporting,
    setIsExporting,
    setSelectedAuditors,
    setSelectedDepartments,
    removeAuditor,
    removeDepartment,
    periodSlice,
    selectedYears,
    selectedQuarters,
    setSelectedYears,
    setSelectedQuarters,
    yearOptions,
    quarterOptions,
    periodSliceLabel,
    activePeriodValues,
    handlePeriodSliceChange,
    removeActivePeriodValue,
    bootstrapQuery,
    analyticsQuery,
    data,
    departmentOptions,
    resetFilters,
  } = useAnalyticsDashboardController({
    resource: 'planning',
    bootstrapQueryKey: queryKeys.analytics.planningBootstrap,
    fetchBootstrap: () => fetchPlanningAnalytics({ granularity: 'year' }),
    fetchFiltered: fetchPlanningAnalytics,
    includeAuditors: false,
  });
  const exportSections = useExportSections(PLANNING_EXPORT_SECTION_IDS);
  const { addToConstructor, justAdded } = useAddToConstructor();

  const coverage = data?.coverage ?? EMPTY_COVERAGE;
  const departmentAnalytics = data?.departmentAnalytics ?? EMPTY_DEPARTMENT_ANALYTICS;
  const highMaterialityRanking = data?.highMaterialityByDepartment ?? EMPTY_HIGH_MATERIALITY_RANKING;
  const highMaterialityTotal = data?.highMaterialityTotal ?? 0;
  const filteredChecksTotal = data?.filteredChecksTotal ?? 0;
  const filteredRecommendationsTotal = data?.filteredRecommendationsTotal ?? 0;
  const universeChecksTotal = data?.universeChecksTotal ?? 0;
  const universeRecommendationsTotal = data?.universeRecommendationsTotal ?? 0;

  const handleExport = async () => {
    if (isExporting || !data) {
      return;
    }
    await runAnalyticsExport(
      setIsExporting,
      () =>
        exportGenericAnalyticsDashboard(
          {
            kind: 'planning',
            documentTitle: 'Планирование',
            filenamePrefix: 'analytics-planning',
            selectedSections: [...PLANNING_EXPORT_SECTION_IDS],
            meta: [
              ['Группировка', periodSlice === 'quarter' ? 'По кварталам' : 'По годам'],
              ...(activePeriodValues.map((label) => ['Период', label] as [string, string])),
              ['Департаменты', selectedDepartments.length ? selectedDepartments.join(', ') : 'Все'],
              ['Проверок в выборке', String(filteredChecksTotal)],
              ['Рекомендаций в выборке', String(filteredRecommendationsTotal)],
              ['Охват департаментов', `${coverage.coverageRate}% (${coverage.covered} из ${coverage.total})`],
            ],
          },
          exportFormat,
        ),
      'Planning export failed',
    );
  };

  const handleAddToConstructor = () => {
    const added = addToConstructor(
      buildPlanningConstructorDrafts({
        selectedSections: exportSections.selectedSections,
        filterCaption: buildConstructorFilterCaption({
          periodSliceLabel,
          periods: activePeriodValues,
          auditors: [],
          departments: selectedDepartments,
        }),
        coverage,
        departmentAnalytics,
        highMaterialityRanking,
        highMaterialityTotal,
        filteredChecksTotal,
        filteredRecommendationsTotal,
        universeChecksTotal,
        universeRecommendationsTotal,
      }),
    );
    if (added > 0) {
      exportSections.clearAll();
    }
  };

  const cards = useMemo<AnalyticsGridCard[]>(
    () => [
      {
        id: 'summary',
        defaultLayout: { x: 0, y: 0, w: 12, h: 2, minW: 8, minH: 2 },
        render: () => (
          <ChartCard
            title="Итого планирования"
            description=""
            dense
            exportSectionId="summary"
            exportSelected={exportSections.isSelected('summary')}
            onToggleExport={() => exportSections.toggleSection('summary')}
          >
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
        defaultLayout: { x: 0, y: 2, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => {
          const uncoveredDepartments = coverage.uncoveredDepartments;
          return (
            <ChartCard
              title="Неохваченные департаменты"
              description=""
              exportSectionId="coverage"
              exportSelected={exportSections.isSelected('coverage')}
              onToggleExport={() => exportSections.toggleSection('coverage')}
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
            title="Проверки и рекомендации по департаментам"
            description=""
            exportSectionId="departmentAnalytics"
            exportSelected={exportSections.isSelected('departmentAnalytics')}
            onToggleExport={() => exportSections.toggleSection('departmentAnalytics')}
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
            title="Рекомендации высокой существенности по департаментам"
            description=""
            exportSectionId="highMateriality"
            exportSelected={exportSections.isSelected('highMateriality')}
            onToggleExport={() => exportSections.toggleSection('highMateriality')}
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
                      <LabelList
                        dataKey="value"
                        position="right"
                        fontSize={CHART_VALUE_LABEL_SIZE}
                        fontWeight={CHART_VALUE_LABEL_WEIGHT}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ),
      },
    ],
    [coverage, departmentAnalytics, exportSections, highMaterialityRanking, highMaterialityTotal],
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
    <AnalyticsFilterCaptionProvider
      periodSliceLabel={periodSliceLabel}
      periods={activePeriodValues}
      auditors={[]}
      departments={selectedDepartments}
    >
      <AnalyticsDashboardFrame
        mainClassName="flex min-h-0 min-w-0 flex-1 flex-col"
        sidebar={(
        <AnalyticsFilterSidebar
          periodSlice={periodSlice}
          onPeriodSliceChange={handlePeriodSliceChange}
          yearOptions={yearOptions}
          quarterOptions={quarterOptions}
          selectedYears={selectedYears}
          selectedQuarters={selectedQuarters}
          onYearsChange={setSelectedYears}
          onQuartersChange={setSelectedQuarters}
          departmentOptions={departmentOptions}
          selectedDepartments={selectedDepartments}
          onDepartmentsChange={setSelectedDepartments}
          onResetFilters={resetFilters}
          exportFormat={exportFormat}
          onExportFormatChange={setExportFormat}
          isExporting={isExporting}
          canExport={Boolean(data)}
          onExport={() => void handleExport()}
          onAddToConstructor={handleAddToConstructor}
          canAddToConstructor={exportSections.selectedCount > 0}
          addToConstructorCount={exportSections.selectedCount}
          constructorAdded={justAdded}
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
                filterSelectionItem(periodSliceLabel, activePeriodValues, 'Все значения', removeActivePeriodValue),
                filterSelectionItem(
                  'Департаменты',
                  selectedDepartments,
                  'Все департаменты',
                  (value) => setSelectedDepartments((prev) => prev.filter((item) => item !== value)),
                ),
              ]}
            />
          )}
        />
        )}
      >
        <AnalyticsDashboardGrid cards={cards} />
      </AnalyticsDashboardFrame>
    </AnalyticsFilterCaptionProvider>
  );
}
