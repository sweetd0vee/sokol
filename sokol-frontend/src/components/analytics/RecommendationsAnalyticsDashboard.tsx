import { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { fetchRecommendationsAnalytics, type RecommendationPeriodPoint } from '../../api/analytics';
import { queryKeys } from '../../api/queryKeys';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsDashboardFrame } from './AnalyticsDashboardFrame';
import { AnalyticsFilterSidebar } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { filterSelectionItem } from './filterSelectionItem';
import { ChartCard, CHART_AXIS_TICK, ChartRechartsSquareLegend, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import { MaterialityMatrixChart } from './MaterialityMatrixChart';
import {
  getMaterialityChartColor,
  MONITORING_STATUS_COLORS,
  RECOMMENDATIONS_MATERIALITY_CHART_COLORS,
  VALUE_EMERALD_SCALE,
} from './analyticsPalette';
import { EMPTY_RECOMMENDATION_SUMMARY } from './analyticsEmpty';
import { useAnalyticsDashboardSession } from './useAnalyticsDashboardSession';
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
import {
  MATERIALITY_LEVEL_OPTIONS,
  RECOMMENDATION_STATUS_OPTIONS,
} from '../../constants/recommendations';
import { useExportSections } from '../../hooks/useExportSections';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { hasAnalyticsPeriodFilters, useAnalyticsAnchorDates } from '../../hooks/useAnalyticsAnchorDates';
import { labelFromPeriodKey } from '../../utils/analyticsPeriod';
import {
  type PeriodGranularity,
} from '../../utils/recommendationAnalytics';
import { completeNamedDistribution, distributionHasValues } from '../../utils/analyticsDistribution';
import { registerDashboardChart } from '../../utils/dashboardChartRegistry';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import { useAddToConstructor } from './constructor/useAddToConstructor';
import { buildRecommendationsConstructorDrafts } from './constructor/buildConstructorWidgets';
import { buildConstructorFilterCaption } from './constructor/constructorFilterCaption';
import {
  DEFAULT_MATERIALITY_MATRIX_COUNT_SORT,
  sortMaterialityMatrixRows,
  type MaterialityMatrixCountSortConfig,
} from '../../utils/materialityMatrix';

const EMPTY_PERIOD_SERIES: RecommendationPeriodPoint[] = [];
const EMPTY_MATERIALITY_DISTRIBUTION: never[] = [];
const EMPTY_OBJECT_DISTRIBUTION: never[] = [];
const EMPTY_MATERIALITY_MATRIX: never[] = [];

function sortKeyFromQuarterKey(key: string) {
  const [year, quarter] = key.split('-Q');
  return Number(year) * 10 + Number(quarter);
}

function completeSelectedQuarterPeriods(
  series: RecommendationPeriodPoint[],
  selectedQuarterKeys: string[],
): RecommendationPeriodPoint[] {
  if (selectedQuarterKeys.length === 0) {
    return series;
  }

  const byKey = new Map(series.map((item) => [item.key, item]));

  const ordered = selectedQuarterKeys
    .map((key) => {
      return (
        byKey.get(key) ?? {
          key,
          label: labelFromPeriodKey(key, 'quarter'),
          sortKey: sortKeyFromQuarterKey(key),
          total: 0,
          completed: 0,
          unresolved: 0,
          on_control: 0,
          in_progress: 0,
          low: 0,
          medium: 0,
          high: 0,
          cumulative: 0,
          cumulativeCompleted: 0,
        }
      );
    })
    .sort((a, b) => a.sortKey - b.sortKey);

  let running = 0;
  let completedRunning = 0;
  return ordered.map((item) => {
    running += item.total;
    completedRunning += item.completed;
    return {
      ...item,
      cumulative: running,
      cumulativeCompleted: completedRunning,
    };
  });
}

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

const STATUS_STACK_KEYS = RECOMMENDATION_STATUS_OPTIONS.map((status) => status.value);
const MATERIALITY_STACK_KEYS = ['low', 'medium', 'high'] as const;

function getStatusSegmentColor(key: string) {
  return MONITORING_STATUS_COLORS[key as keyof typeof MONITORING_STATUS_COLORS] ?? '#e5e7eb';
}

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
  } = useAnalyticsDashboardSession();

  const exportSections = useExportSections(
    RECOMMENDATION_EXPORT_SECTIONS.map((section) => section.id) as RecommendationExportSectionId[],
  );
  const { addToConstructor, justAdded } = useAddToConstructor();

  const bootstrapQuery = useQuery({
    queryKey: queryKeys.analytics.recommendationsBootstrap,
    queryFn: () => fetchRecommendationsAnalytics({ granularity: 'year' }),
    staleTime: 60_000,
  });

  const anchorDates = useAnalyticsAnchorDates(bootstrapQuery.data?.filterOptions.anchorDates);
  const {
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
  } = useAnalyticsPeriodFilters(anchorDates);

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
      'recommendations',
      granularity,
      selectedYearKeys,
      selectedQuarterKeys,
      selectedAuditors,
      selectedDepartments,
    ],
    queryFn: () =>
      fetchRecommendationsAnalytics({
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

  const data = analyticsQuery.data ?? bootstrapQuery.data;
  const auditorOptions = useMemo(
    () => toAnalyticsSelectOptions(data?.filterOptions.auditors ?? []),
    [data?.filterOptions.auditors],
  );
  const departmentOptions = useMemo(
    () => toAnalyticsSelectOptions(data?.filterOptions.departments ?? []),
    [data?.filterOptions.departments],
  );

  const summary = data?.summary ?? EMPTY_RECOMMENDATION_SUMMARY;
  const periodSeries = data?.periodSeries ?? EMPTY_PERIOD_SERIES;
  const completedPeriodSeries = useMemo(
    () =>
      granularity === 'quarter'
        ? completeSelectedQuarterPeriods(periodSeries, selectedQuarterKeys)
        : periodSeries,
    [granularity, periodSeries, selectedQuarterKeys],
  );
  const materialityDistribution = data?.materialityDistribution ?? EMPTY_MATERIALITY_DISTRIBUTION;

  // Colorize chart segments by the same tones as the stacked materiality bars.
  const coloredMaterialityDistribution = useMemo(
    () =>
      completeNamedDistribution(
        materialityDistribution,
        MATERIALITY_LEVEL_OPTIONS,
        getMaterialityChartColor,
      ),
    [materialityDistribution],
  );

  const objectDistribution = data?.objectDistribution ?? EMPTY_OBJECT_DISTRIBUTION;
  const objectDistributionTop = useMemo(
    () => [...objectDistribution].sort((left, right) => right.value - left.value).slice(0, 10),
    [objectDistribution],
  );
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

  // Export needs two separate capture nodes, even though UI now renders them as one card.
  const materialityByPeriodCaptureRef = useRef<HTMLDivElement>(null);
  const materialityCaptureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanupByPeriod = registerDashboardChart({
      id: 'materialityByPeriod',
      title: 'Существенность по периодам',
      description: 'Распределение уровней существенности внутри периода',
      getNode: () => materialityByPeriodCaptureRef.current,
    });
    const cleanupMateriality = registerDashboardChart({
      id: 'materiality',
      title: 'Существенность',
      description: 'Распределение уровней существенности за период',
      getNode: () => materialityCaptureRef.current,
    });

    return () => {
      cleanupByPeriod();
      cleanupMateriality();
    };
  }, []);

  const isMaterialityExportSelected =
    exportSections.isSelected('materialityByPeriod') && exportSections.isSelected('materiality');

  const toggleMaterialityExport = useCallback(() => {
    const shouldEnable = !isMaterialityExportSelected;

    if (shouldEnable) {
      if (!exportSections.isSelected('materialityByPeriod')) {
        exportSections.toggleSection('materialityByPeriod');
      }
      if (!exportSections.isSelected('materiality')) {
        exportSections.toggleSection('materiality');
      }
      return;
    }

    if (exportSections.isSelected('materialityByPeriod')) {
      exportSections.toggleSection('materialityByPeriod');
    }
    if (exportSections.isSelected('materiality')) {
      exportSections.toggleSection('materiality');
    }
  }, [exportSections, isMaterialityExportSelected]);

  const resetFilters = () => {
    resetPeriodSelections();
    resetEntityFilters();
  };

  const handleExport = async () => {
    if (filteredTotal === 0 || isExporting) {return;}
    setIsExporting(true);
    try {
      await exportRecommendationsDashboard(
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
      );
    } catch (error) {
      console.error('Analytics export failed', error);
      window.alert(`Не удалось экспортировать отчёт: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAddToConstructor = () => {
    addToConstructor(
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
        objectDistributionTop,
        materialityMatrix,
        granularity,
      }),
    );
  };

  const cards = useMemo<AnalyticsGridCard[]>(
    () => [
      {
        id: 'summary',
        defaultLayout: { x: 0, y: 0, w: 12, h: 2, minW: 8, minH: 2 },
        render: () => (
          <ChartCard
            title="Итого"
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
                accentColor={MONITORING_STATUS_COLORS.on_control}
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
        id: 'statusByPeriod',
        defaultLayout: { x: 0, y: 13, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Статусы по периодам"
            description="Распределение статусов по периодам"
            exportSectionId="statusByPeriod"
            exportSelected={exportSections.isSelected('statusByPeriod')}
            onToggleExport={() => exportSections.toggleSection('statusByPeriod')}
          >
            {completedPeriodSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={completedPeriodSeries} margin={{ top: STACKED_PERIOD_CHART_TOP_MARGIN, right: STACKED_PERIOD_CHART_SIDE_MARGIN, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={CHART_AXIS_TICK} {...periodXAxisProps} />
                    <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <Tooltip />
                    <Legend content={<ChartRechartsSquareLegend />} />
                    {RECOMMENDATION_STATUS_OPTIONS.map((status) => (
                      <Bar
                        key={status.value}
                        dataKey={status.value}
                        name={status.label}
                        stackId="status"
                        fill={MONITORING_STATUS_COLORS[status.value]}
                      >
                        <LabelList
                          dataKey={status.value}
                          content={(props) => (
                            <StackedBarSegmentValueLabel
                              {...props}
                              dataKey={status.value}
                              stackKeys={STATUS_STACK_KEYS}
                              getColor={getStatusSegmentColor}
                              showStackTotal
                              stackRow={completedPeriodSeries[Number(props.index)]}
                            />
                          )}
                        />
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'materialityCombined',
        defaultLayout: { x: 0, y: 2, w: 12, h: 3, minW: 6, minH: 2 },
        render: () => (
          <ChartCard
            title="Существенность"
            description="Распределение уровней существенности рекомендаций: за период и по периодам"
            exportSelected={isMaterialityExportSelected}
            onToggleExport={toggleMaterialityExport}
          >
            <div className="relative flex h-full min-h-0 flex-row gap-2">
              <div
                ref={materialityCaptureRef}
                style={{ flex: 1 }}
                data-analytics-export-capture-id="materiality"
                data-analytics-export-title="Существенность"
                data-analytics-export-description="Распределение уровней существенности за период"
                className="flex-1 min-h-0 min-w-0"
              >
                {distributionHasValues(coloredMaterialityDistribution) ? (
                  <FocusableDonutChart
                    data={coloredMaterialityDistribution}
                    labelMode="both"
                    legendLabelMode="name"
                    showLegend={false}
                    containerClassName="h-full min-h-0"
                    valueLabelColor="#111827"
                  />
                ) : (
                  <EmptyChart message="Нет данных" heightClass="h-full" />
                )}
              </div>

              <div
                ref={materialityByPeriodCaptureRef}
                style={{ flex: 3 }}
                data-analytics-export-capture-id="materialityByPeriod"
                data-analytics-export-title="Существенность по периодам"
                data-analytics-export-description="Распределение уровней существенности внутри периода"
                className="flex-1 min-h-0 min-w-0"
              >
                {completedPeriodSeries.length === 0 ? (
                  <EmptyChart message="Нет данных" heightClass="h-full" />
                ) : (
                  <div className="h-full min-h-0 pb-6">
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

                    {/* Custom legend centered across the whole card */}
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
              </div>
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'materialityMatrix',
        defaultLayout: { x: 0, y: 5, w: 12, h: 8, minW: 6, minH: 6 },
        expandToContent: true,
        render: () => (
          <ChartCard
            title="Матрица существенности"
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
        id: 'objects',
        defaultLayout: { x: 6, y: 13, w: 6, h: 3, minW: 6, minH: 3 },
        render: () => (
          <ChartCard
            title="Карта департаментов (ТОП-10)"
            description="Количество рекомендаций за период по департаментам"
            exportSectionId="objects"
            exportSelected={exportSections.isSelected('objects')}
            onToggleExport={() => exportSections.toggleSection('objects')}
          >
            {objectDistributionTop.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableTreemapChart
                data={objectDistributionTop}
                palette={VALUE_EMERALD_SCALE}
                colorByValue
              />
            )}
          </ChartCard>
        ),
      },
    ],
    [
      exportSections,
      isMaterialityExportSelected,
      coloredMaterialityDistribution,
      materialityMatrix,
      handleMaterialityMatrixSortChange,
      objectDistributionTop,
      periodXAxisProps,
      completedPeriodSeries,
      toggleMaterialityExport,
      universeTotal,
      summary,
    ],
  );

  if (bootstrapQuery.isLoading && !data) {
    return <LoadingState title="Загрузка аналитики рекомендаций…" />;
  }
  if ((bootstrapQuery.isError || analyticsQuery.isError) && !data) {
    const error = analyticsQuery.error ?? bootstrapQuery.error;
    return (
      <ErrorState
        title="Не удалось загрузить аналитику рекомендаций"
        description={error instanceof Error ? error.message : 'неизвестная ошибка'}
      />
    );
  }

  return (
    <AnalyticsDashboardFrame
      mainClassName="relative flex min-w-0 flex-1 flex-col lg:-mt-[84px] lg:self-start"
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
        auditorOptions={auditorOptions}
        selectedAuditors={selectedAuditors}
        onAuditorsChange={setSelectedAuditors}
        departmentOptions={departmentOptions}
        selectedDepartments={selectedDepartments}
        onDepartmentsChange={setSelectedDepartments}
        onResetFilters={resetFilters}
        exportFormat={exportFormat}
        onExportFormatChange={setExportFormat}
        isExporting={isExporting}
        canExport={filteredTotal > 0}
        onExport={handleExport}
        onAddToConstructor={handleAddToConstructor}
        canAddToConstructor={exportSections.selectedCount > 0}
        addToConstructorCount={exportSections.selectedCount}
        constructorAdded={justAdded}
        selectionSummary={(
          <AnalyticsSelectionSummary
            metrics={[
            { label: 'Рекомендаций', value: filteredTotal, hint:`из ${universeTotal}` },
            ]}
            items={[
              filterSelectionItem(periodSliceLabel, activePeriodValues, 'Все значения', removeActivePeriodValue),
              filterSelectionItem('Аудиторы', selectedAuditors, 'Все аудиторы', removeAuditor),
              filterSelectionItem('Департаменты', selectedDepartments, 'Все департаменты', removeDepartment),
            ]}
          />
        )}
      />
      )}
    >
      <AnalyticsDashboardGrid cards={cards} />
    </AnalyticsDashboardFrame>
  );
}
