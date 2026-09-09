import { useCallback, useMemo, useRef } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchRecommendationsAnalytics, type RecommendationPeriodPoint } from '../../api/analytics';
import { queryKeys } from '../../api/queryKeys';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import {
  ANALYTICS_DASHBOARD_MAIN_CLASS,
  AnalyticsDashboardShell,
} from './AnalyticsDashboardShell';
import { ChartCard, CHART_AXIS_TICK, CHART_VALUE_LABEL_SIZE, CHART_VALUE_LABEL_WEIGHT, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import { MaterialityMatrixChart } from './MaterialityMatrixChart';
import {
  getMaterialityChartColor,
  getUniqueValueColors,
  lastScaleColor,
  MONITORING_STATUS_COLORS,
  RECOMMENDATIONS_DEPARTMENT_MAP_SCALE,
  RECOMMENDATIONS_MATERIALITY_CHART_COLORS,
} from './analyticsPalette';
import { EMPTY_RECOMMENDATION_SUMMARY } from './analyticsEmpty';
import {
  STACKED_PERIOD_CHART_SIDE_MARGIN,
  STACKED_PERIOD_CHART_TOP_MARGIN,
  StackedBarSegmentValueLabel,
} from './StackedBarSegmentValueLabel';
import { exportRecommendationsDashboard } from '../../utils/analyticsExport';
import {
  RECOMMENDATION_EXPORT_SECTIONS,
  type RecommendationExportSectionId,
} from '../../constants/analyticsExportSections';
import { MATERIALITY_LEVEL_OPTIONS } from '../../constants/recommendations';
import { useExportSections } from '../../hooks/useExportSections';
import { completeNamedDistribution, distributionHasValues, topByValue } from '../../utils/analyticsDistribution';
import {
  completeSelectedPeriodPoints,
  emptyRecommendationPeriodPoint,
  withRecommendationRunningTotals,
} from '../../utils/analyticsPeriodSeries';
import { runAnalyticsExport } from '../../utils/runAnalyticsExport';
import { useAnalyticsDashboardController } from './useAnalyticsDashboardController';
import { useAddToConstructor } from './constructor/useAddToConstructor';
import { buildRecommendationsConstructorDrafts } from './constructor/buildConstructorWidgets';
import { buildConstructorFilterCaption } from './constructor/constructorFilterCaption';
import {
  DEFAULT_MATERIALITY_MATRIX_COUNT_SORT,
  sortMaterialityMatrixRows,
  type MaterialityMatrixCountSortConfig,
} from '../../utils/materialityMatrix';
import type { PeriodGranularity } from '../../utils/recommendationAnalytics';

const EMPTY_PERIOD_SERIES: RecommendationPeriodPoint[] = [];
const EMPTY_MATERIALITY_DISTRIBUTION: never[] = [];
const EMPTY_VIEW_DISTRIBUTION: never[] = [];
const EMPTY_OBJECT_DISTRIBUTION: never[] = [];
const EMPTY_MATERIALITY_MATRIX: never[] = [];

function getPeriodXAxisProps(granularity: PeriodGranularity) {
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

const MATERIALITY_STACK_KEYS = ['low', 'medium', 'high'] as const;

function getMaterialitySegmentColor(key: string) {
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

export function RecommendationsAnalyticsDashboard() {
  const {
    selectedAuditors,
    selectedDepartments,
    exportFormat,
    setExportFormat,
    isExporting,
    setIsExporting,
    removeAuditor,
    removeDepartment,
    setSelectedAuditors,
    setSelectedDepartments,
    periodSlice,
    selectedYears,
    selectedQuarters,
    setSelectedYears,
    setSelectedQuarters,
    yearOptions,
    quarterOptions,
    selectedQuarterKeys,
    periodSliceLabel,
    activePeriodValues,
    handlePeriodSliceChange,
    removeActivePeriodValue,
    granularity,
    bootstrapQuery,
    analyticsQuery,
    data,
    auditorOptions,
    departmentOptions,
    resetFilters,
  } = useAnalyticsDashboardController({
    resource: 'recommendations',
    bootstrapQueryKey: queryKeys.analytics.recommendationsBootstrap,
    fetchBootstrap: () => fetchRecommendationsAnalytics({ granularity: 'year' }),
    fetchFiltered: fetchRecommendationsAnalytics,
  });

  const exportSections = useExportSections(
    RECOMMENDATION_EXPORT_SECTIONS.map((section) => section.id) as RecommendationExportSectionId[],
  );
  const { addToConstructor, justAdded } = useAddToConstructor();

  const summary = data?.summary ?? EMPTY_RECOMMENDATION_SUMMARY;
  const periodSeries = data?.periodSeries ?? EMPTY_PERIOD_SERIES;
  const completedPeriodSeries = useMemo(() => {
    if (granularity !== 'quarter' || selectedQuarterKeys.length === 0) {
      return periodSeries;
    }
    return withRecommendationRunningTotals(
      completeSelectedPeriodPoints(periodSeries, selectedQuarterKeys, emptyRecommendationPeriodPoint),
    );
  }, [granularity, periodSeries, selectedQuarterKeys]);
  const materialityDistribution = data?.materialityDistribution ?? EMPTY_MATERIALITY_DISTRIBUTION;

  const coloredMaterialityDistribution = useMemo(
    () =>
      completeNamedDistribution(
        materialityDistribution,
        MATERIALITY_LEVEL_OPTIONS,
        getMaterialityChartColor,
      ),
    [materialityDistribution],
  );

  const viewDistribution = data?.viewDistribution ?? EMPTY_VIEW_DISTRIBUTION;
  const viewColors = useMemo(
    () => getUniqueValueColors(viewDistribution.map((item) => item.value), RECOMMENDATIONS_DEPARTMENT_MAP_SCALE),
    [viewDistribution],
  );
  const objectDistribution = data?.objectDistribution ?? EMPTY_OBJECT_DISTRIBUTION;
  const objectDistributionTop = useMemo(() => topByValue(objectDistribution, 10), [objectDistribution]);
  const universeTotal = data?.universeTotal ?? 0;
  const filteredTotal = data?.filteredTotal ?? 0;
  const materialityMatrix = data?.materialityMatrix ?? EMPTY_MATERIALITY_MATRIX;
  const materialityMatrixSortRef = useRef<MaterialityMatrixCountSortConfig>(
    DEFAULT_MATERIALITY_MATRIX_COUNT_SORT,
  );
  const handleMaterialityMatrixSortChange = useCallback((sortConfig: MaterialityMatrixCountSortConfig) => {
    materialityMatrixSortRef.current = sortConfig;
  }, []);
  const periodXAxisProps = useMemo(() => getPeriodXAxisProps(granularity), [granularity]);

  const handleExport = async () => {
    if (filteredTotal === 0 || isExporting) {
      return;
    }
    await runAnalyticsExport(setIsExporting, () =>
      exportRecommendationsDashboard(
        {
          recommendations: [],
          filteredRecommendations: [],
          granularity,
          dateFrom: null,
          dateTo: null,
          auditors: selectedAuditors,
          departments: selectedDepartments,
          materialityLevels: [],
          selectedSections: [...exportSections.allIds],
          materialityMatrixOverride: sortMaterialityMatrixRows(
            materialityMatrix,
            materialityMatrixSortRef.current,
          ),
        },
        exportFormat,
      ),
    );
  };

  const handleAddToConstructor = () => {
    const added = addToConstructor(
      buildRecommendationsConstructorDrafts({
        selectedSections: exportSections.selectedSections,
        filterCaption: buildConstructorFilterCaption({
          periodSliceLabel,
          periods: activePeriodValues,
          auditors: selectedAuditors,
          departments: selectedDepartments,
        }),
        summary,
        universeTotal,
        completedPeriodSeries,
        coloredMaterialityDistribution,
        viewDistribution,
        viewColors,
        objectDistributionTop,
        materialityMatrix,
        granularity,
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
            title="Итого по рекомендациям"
            description=""
            dense
            exportSectionId="summary"
            exportSelected={exportSections.isSelected('summary')}
            onToggleExport={() => exportSections.toggleSection('summary')}
          >
            <div className="grid w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
              <KpiCard
                label="Всего"
                value={summary.total}
                hint={`из ${universeTotal}`}
                tone="slate"
              />
              <KpiCard
                label="В процессе"
                value={summary.byStatus.in_progress}
                accentColor={MONITORING_STATUS_COLORS.in_progress}
              />
              <KpiCard
                label="Не решено"
                value={summary.byStatus.unresolved}
                accentColor={MONITORING_STATUS_COLORS.unresolved}
              />
              <KpiCard
                label="Исполнено"
                value={summary.byStatus.completed}
                accentColor={MONITORING_STATUS_COLORS.completed}
              />
              <KpiCard
                label="Доля исполненных"
                value={summary.completionRate}
                suffix="%"
                accentColor={MONITORING_STATUS_COLORS.completed}
              />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'materialityByPeriod',
        defaultLayout: { x: 0, y: 2, w: 9, h: 3, minW: 4, minH: 2 },
        render: () => (
          <ChartCard
            title="Динамика количества рекомендаций по периодам (существенность)"
            description=""
            exportSectionId="materialityByPeriod"
            exportSelected={exportSections.isSelected('materialityByPeriod')}
            onToggleExport={() => exportSections.toggleSection('materialityByPeriod')}
          >
            {completedPeriodSeries.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="relative h-full min-h-0 pb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={completedPeriodSeries}
                    margin={{ top: STACKED_PERIOD_CHART_TOP_MARGIN, right: STACKED_PERIOD_CHART_SIDE_MARGIN, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={CHART_AXIS_TICK} {...periodXAxisProps} />
                    <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <Tooltip />
                    <Bar dataKey="low" name="Низкий" stackId="mat" fill={RECOMMENDATIONS_MATERIALITY_CHART_COLORS.низкий}>
                      <LabelList
                        dataKey="low"
                        content={(props) => (
                          <StackedBarSegmentValueLabel
                            {...props}
                            dataKey="low"
                            stackKeys={MATERIALITY_STACK_KEYS}
                            getColor={getMaterialitySegmentColor}
                            showStackTotal
                            stackRow={completedPeriodSeries[Number(props.index)]}
                          />
                        )}
                      />
                    </Bar>
                    <Bar
                      dataKey="medium"
                      name="Средний"
                      stackId="mat"
                      fill={RECOMMENDATIONS_MATERIALITY_CHART_COLORS.средний}
                    >
                      <LabelList
                        dataKey="medium"
                        content={(props) => (
                          <StackedBarSegmentValueLabel
                            {...props}
                            dataKey="medium"
                            stackKeys={MATERIALITY_STACK_KEYS}
                            getColor={getMaterialitySegmentColor}
                            showStackTotal
                            stackRow={completedPeriodSeries[Number(props.index)]}
                          />
                        )}
                      />
                    </Bar>
                    <Bar
                      dataKey="high"
                      name="Высокий"
                      stackId="mat"
                      fill={RECOMMENDATIONS_MATERIALITY_CHART_COLORS.высокий}
                    >
                      <LabelList
                        dataKey="high"
                        content={(props) => (
                          <StackedBarSegmentValueLabel
                            {...props}
                            dataKey="high"
                            stackKeys={MATERIALITY_STACK_KEYS}
                            getColor={getMaterialitySegmentColor}
                            showStackTotal
                            stackRow={completedPeriodSeries[Number(props.index)]}
                          />
                        )}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute bottom-1 left-1/2 flex -translate-x-1/2 flex-row items-center justify-center gap-6">
                  <div className="flex items-center gap-2 text-sm text-black">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-sm"
                      style={{ backgroundColor: RECOMMENDATIONS_MATERIALITY_CHART_COLORS.высокий }}
                    />
                    Высокий
                  </div>
                  <div className="flex items-center gap-2 text-sm text-black">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-sm"
                      style={{ backgroundColor: RECOMMENDATIONS_MATERIALITY_CHART_COLORS.средний }}
                    />
                    Средний
                  </div>
                  <div className="flex items-center gap-2 text-sm text-black">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-sm"
                      style={{ backgroundColor: RECOMMENDATIONS_MATERIALITY_CHART_COLORS.низкий }}
                    />
                    Низкий
                  </div>
                </div>
              </div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'materiality',
        defaultLayout: { x: 9, y: 2, w: 3, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Существенность рекомендаций за период"
            description=""
            exportSectionId="materiality"
            exportSelected={exportSections.isSelected('materiality')}
            onToggleExport={() => exportSections.toggleSection('materiality')}
          >
            {distributionHasValues(coloredMaterialityDistribution) ? (
              <FocusableDonutChart
                data={coloredMaterialityDistribution}
                labelMode="both"
                legendLabelMode="name"
                valueLabelColor="#111827"
              />
            ) : (
              <EmptyChart message="Нет данных" />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'materialityMatrix',
        defaultLayout: { x: 0, y: 5, w: 12, h: 8, minW: 6, minH: 6 },
        expandToContent: true,
        render: () => (
          <ChartCard
            title="Матрица существенности рекомендаций"
            description=""
            exportSectionId="materialityMatrix"
            exportSelected={exportSections.isSelected('materialityMatrix')}
            onToggleExport={() => exportSections.toggleSection('materialityMatrix')}
            fitContent
          >
            {materialityMatrix.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <MaterialityMatrixChart
                rows={materialityMatrix}
                onSortConfigChange={handleMaterialityMatrixSortChange}
                scrollBody={false}
              />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'views',
        defaultLayout: { x: 0, y: 13, w: 4, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Количество рекомендаций по видам проверок"
            description=""
            exportSectionId="views"
            exportSelected={exportSections.isSelected('views')}
            onToggleExport={() => exportSections.toggleSection('views')}
          >
            {viewDistribution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={viewDistribution} layout="vertical" margin={{ top: 8, right: 40, left: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <YAxis dataKey="name" type="category" width={92} tick={CHART_AXIS_TICK} />
                    <Tooltip />
                    <Bar dataKey="value" name="Рекомендации" fill={lastScaleColor(RECOMMENDATIONS_DEPARTMENT_MAP_SCALE)} radius={[0, 6, 6, 0]}>
                      {viewDistribution.map((item, index) => (
                        <Cell key={item.name} fill={viewColors[index]} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="right"
                        fontSize={CHART_VALUE_LABEL_SIZE}
                        fontWeight={CHART_VALUE_LABEL_WEIGHT}
                        fill="#000000"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'objects',
        defaultLayout: { x: 4, y: 13, w: 8, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Карта департаментов по количеству рекомендаций (ТОП-10)"
            description=""
            exportSectionId="objects"
            exportSelected={exportSections.isSelected('objects')}
            onToggleExport={() => exportSections.toggleSection('objects')}
          >
            {objectDistributionTop.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableTreemapChart
                data={objectDistributionTop}
                palette={RECOMMENDATIONS_DEPARTMENT_MAP_SCALE}
                colorByUniqueValue
              />
            )}
          </ChartCard>
        ),
      },
    ],
    [
      exportSections,
      coloredMaterialityDistribution,
      materialityMatrix,
      handleMaterialityMatrixSortChange,
      objectDistributionTop,
      periodXAxisProps,
      completedPeriodSeries,
      universeTotal,
      summary,
      viewColors,
      viewDistribution,
    ],
  );

  return (
    <AnalyticsDashboardShell
      loadingTitle="Загрузка аналитики рекомендаций…"
      errorTitle="Не удалось загрузить аналитику рекомендаций"
      bootstrapQuery={bootstrapQuery}
      analyticsQuery={analyticsQuery}
      data={data}
      mainClassName={ANALYTICS_DASHBOARD_MAIN_CLASS}
      selectionMetrics={[{ label: 'Рекомендаций', value: filteredTotal, hint: `из ${universeTotal}` }]}
      periodSliceLabel={periodSliceLabel}
      activePeriodValues={activePeriodValues}
      removeActivePeriodValue={removeActivePeriodValue}
      selectedAuditors={selectedAuditors}
      removeAuditor={removeAuditor}
      selectedDepartments={selectedDepartments}
      removeDepartment={removeDepartment}
      filterSidebar={{
        periodSlice,
        onPeriodSliceChange: handlePeriodSliceChange,
        yearOptions,
        quarterOptions,
        selectedYears,
        selectedQuarters,
        onYearsChange: setSelectedYears,
        onQuartersChange: setSelectedQuarters,
        auditorOptions,
        selectedAuditors,
        onAuditorsChange: setSelectedAuditors,
        departmentOptions,
        selectedDepartments,
        onDepartmentsChange: setSelectedDepartments,
        onResetFilters: resetFilters,
        exportFormat,
        onExportFormatChange: setExportFormat,
        isExporting,
        canExport: filteredTotal > 0,
        onExport: handleExport,
        onAddToConstructor: handleAddToConstructor,
        canAddToConstructor: exportSections.selectedCount > 0,
        addToConstructorCount: exportSections.selectedCount,
        constructorAdded: justAdded,
      }}
    >
      <AnalyticsDashboardGrid cards={cards} />
    </AnalyticsDashboardShell>
  );
}
