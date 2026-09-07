import { useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { AnalyticsDashboardFrame } from './AnalyticsDashboardFrame';
import { AnalyticsFilterSidebar } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { filterSelectionItem } from './filterSelectionItem';
import { ChartCard, CHART_AXIS_TICK, CHART_VALUE_LABEL_SIZE, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import { MaterialityMatrixChart } from './MaterialityMatrixChart';
import {
  getMaterialityChartColor,
  getUniqueValueColors,
  lastScaleColor,
  MONITORING_STATUS_COLORS,
  RECOMMENDATIONS_MATERIALITY_CHART_COLORS,
  VALUE_BLUE_SCALE,
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
import { MATERIALITY_LEVEL_OPTIONS } from '../../constants/recommendations';
import { useExportSections } from '../../hooks/useExportSections';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { hasAnalyticsPeriodFilters, useAnalyticsAnchorDates } from '../../hooks/useAnalyticsAnchorDates';
import { labelFromPeriodKey } from '../../utils/analyticsPeriod';
import {
  type PeriodGranularity,
} from '../../utils/recommendationAnalytics';
import { completeNamedDistribution, distributionHasValues } from '../../utils/analyticsDistribution';
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
const EMPTY_VIEW_DISTRIBUTION: never[] = [];
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

  const viewDistribution = data?.viewDistribution ?? EMPTY_VIEW_DISTRIBUTION;
  const viewColors = useMemo(
    () => getUniqueValueColors(viewDistribution.map((item) => item.value), VALUE_BLUE_SCALE),
    [viewDistribution],
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
        id: 'materialityByPeriod',
        defaultLayout: { x: 0, y: 2, w: 9, h: 3, minW: 4, minH: 2 },
        render: () => (
          <ChartCard
            title="Существенность по периодам"
            description="Распределение уровней существенности внутри периода"
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
            title="Существенность"
            description="Распределение уровней существенности за период"
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
        id: 'views',
        defaultLayout: { x: 0, y: 13, w: 4, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Виды проверок"
            description="Количество рекомендаций за период"
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
                    <Bar dataKey="value" name="Рекомендации" fill={lastScaleColor(VALUE_BLUE_SCALE)} radius={[0, 6, 6, 0]}>
                      {viewDistribution.map((item, index) => (
                        <Cell key={item.name} fill={viewColors[index]} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="right"
                        fontSize={CHART_VALUE_LABEL_SIZE}
                        fill={lastScaleColor(VALUE_BLUE_SCALE)}
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
                palette={VALUE_BLUE_SCALE}
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
