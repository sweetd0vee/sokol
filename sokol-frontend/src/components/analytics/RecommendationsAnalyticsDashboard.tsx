import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchRecommendationsAnalytics, type RecommendationPeriodPoint } from '../../api/analytics';
import { queryKeys } from '../../api/queryKeys';
import { MultiCheckboxSelect } from '../ui/MultiCheckboxSelect';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsFilterSidebar } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { ChartCard, CHART_AXIS_TICK, CHART_LEGEND_STYLE, CHART_VALUE_LABEL_SIZE, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableSquareCirclesChart } from './FocusableSquareCirclesChart';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import {
  getValueBasedColors,
  RECOMMENDATIONS_PALETTE,
  VALUE_GRAY_SCALE,
} from './analyticsPalette';
import { exportRecommendationsDashboard, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import {
  RECOMMENDATION_EXPORT_SECTIONS,
  type RecommendationExportSectionId,
} from '../../constants/analyticsExportSections';
import {
  MATERIALITY_LEVEL_OPTIONS,
  RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS,
  RECOMMENDATION_STATUS_OPTIONS,
  normalizeMaterialityLevel,
  normalizeRecommendationIndicator,
} from '../../constants/recommendations';
import { useExportSections } from '../../hooks/useExportSections';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { hasAnalyticsPeriodFilters, useAnalyticsAnchorDates } from '../../hooks/useAnalyticsAnchorDates';
import { labelFromPeriodKey } from '../../utils/analyticsPeriod';
import {
  MATERIALITY_COLORS,
  STATUS_COLORS,
  getIndicatorColor,
  getMaterialityLevelColor,
  type PeriodGranularity,
} from '../../utils/recommendationAnalytics';
import { registerDashboardChart } from '../../utils/dashboardChartRegistry';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import type { MaterialityLevel } from '../../types/recommendation';

const EMPTY_RECOMMENDATION_SUMMARY = {
  total: 0,
  byStatus: { completed: 0, unresolved: 0, on_control: 0, in_progress: 0 },
  byMateriality: { низкий: 0, средний: 0, высокий: 0 },
  byAdditional: { on_time: 0, deadline_violated: 0, on_control: 0 },
  withExtensions: 0,
  withCompletionDate: 0,
  completionRate: 0,
  violationRate: 0,
};
const EMPTY_PERIOD_SERIES: RecommendationPeriodPoint[] = [];
const EMPTY_CUMULATIVE_SERIES: RecommendationPeriodPoint[] = [];
const EMPTY_MATERIALITY_DISTRIBUTION: never[] = [];
const EMPTY_INDICATOR_DISTRIBUTION: never[] = [];
const EMPTY_OBJECT_DISTRIBUTION: never[] = [];

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

export function RecommendationsAnalyticsDashboard() {
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedMateriality, setSelectedMateriality] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedAdditionalStatuses, setSelectedAdditionalStatuses] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<AnalyticsExportFormat>('html');
  const [isExporting, setIsExporting] = useState(false);

  const exportSections = useExportSections(
    RECOMMENDATION_EXPORT_SECTIONS.map((section) => section.id) as RecommendationExportSectionId[],
  );

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
    statuses: selectedStatuses,
    additionalStatuses: selectedAdditionalStatuses,
    materialityLevels: selectedMateriality,
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
      selectedStatuses,
      selectedAdditionalStatuses,
      selectedMateriality,
    ],
    queryFn: () =>
      fetchRecommendationsAnalytics({
        granularity,
        years: selectedYearKeys,
        quarters: selectedQuarterKeys,
        months: [],
        auditors: selectedAuditors,
        departments: selectedDepartments,
        statuses: selectedStatuses,
        additionalStatuses: selectedAdditionalStatuses,
        materialityLevels: selectedMateriality,
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
  const cumulativeSeries = data?.cumulativeSeries ?? EMPTY_CUMULATIVE_SERIES;
  const completedPeriodSeries = useMemo(
    () =>
      granularity === 'quarter'
        ? completeSelectedQuarterPeriods(periodSeries, selectedQuarterKeys)
        : periodSeries,
    [granularity, periodSeries, selectedQuarterKeys],
  );
  const completedCumulativeSeries = useMemo(
    () =>
      granularity === 'quarter'
        ? completeSelectedQuarterPeriods(cumulativeSeries, selectedQuarterKeys)
        : cumulativeSeries,
    [granularity, cumulativeSeries, selectedQuarterKeys],
  );
  const cumulativeColors = useMemo(
    () => getValueBasedColors(completedCumulativeSeries.map((item) => item.total), VALUE_GRAY_SCALE),
    [completedCumulativeSeries],
  );
  const materialityDistribution = data?.materialityDistribution ?? EMPTY_MATERIALITY_DISTRIBUTION;
  const indicatorDistribution = data?.indicatorDistribution ?? EMPTY_INDICATOR_DISTRIBUTION;

  // Colorize chart segments by the same tones used in the recommendations table.
  const coloredMaterialityDistribution = useMemo(
    () =>
      materialityDistribution.map((item) => ({
        ...item,
        color: getMaterialityLevelColor(normalizeMaterialityLevel(item.name)),
      })),
    [materialityDistribution],
  );

  const coloredIndicatorDistribution = useMemo(
    () =>
      indicatorDistribution.map((item) => ({
        ...item,
        color: getIndicatorColor(normalizeRecommendationIndicator(item.name)),
      })),
    [indicatorDistribution],
  );

  const objectDistribution = data?.objectDistribution ?? EMPTY_OBJECT_DISTRIBUTION;
  const objectDistributionTop = useMemo(
    () => [...objectDistribution].sort((left, right) => right.value - left.value).slice(0, 10),
    [objectDistribution],
  );
  const universeTotal = data?.universeTotal ?? 0;
  const filteredTotal = data?.filteredTotal ?? 0;
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
    setSelectedAuditors([]);
    setSelectedDepartments([]);
    setSelectedMateriality([]);
    setSelectedStatuses([]);
    setSelectedAdditionalStatuses([]);
  };

  const handleExport = async () => {
    if (filteredTotal === 0 || isExporting) {return;}
    if (exportSections.selectedSections.length === 0) {
      window.alert('Выберите хотя бы один дашборд для экспорта');
      return;
    }
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
          materialityLevels: selectedMateriality as MaterialityLevel[],
          selectedSections: exportSections.selectedSections,
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
              <KpiCard label="Всего" value={summary.total} hint={`из ${universeTotal}`} tone="slate" />
              <KpiCard label="В процессе" value={summary.byStatus.in_progress} tone="amber" />
              <KpiCard label="Не решено" value={summary.byStatus.unresolved} tone="slate" />
              <KpiCard label="Исполнено" value={summary.byStatus.completed} tone="green" />
              <KpiCard label="Доля исполненных" value={summary.completionRate} suffix="%" tone="green" />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'cumulative',
        defaultLayout: { x: 0, y: 2, w: 9, h: 3, minW: 4, minH: 2 },
        render: () => (
          <ChartCard
            title="Количество рекомендаций"
            description="Динамика количества рекомендаций за период"
            exportSectionId="cumulative"
            exportSelected={exportSections.isSelected('cumulative')}
            onToggleExport={() => exportSections.toggleSection('cumulative')}
          >
            {completedCumulativeSeries.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={completedCumulativeSeries}
                    margin={{ top: 22, right: 12, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={CHART_AXIS_TICK} {...periodXAxisProps} />
                    <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <Tooltip />
                    <Bar dataKey="total" name="За период" fill={RECOMMENDATIONS_PALETTE[0]} radius={[4, 4, 0, 0]}>
                      {completedCumulativeSeries.map((item, index) => (
                        <Cell key={item.key} fill={cumulativeColors[index]} />
                      ))}
                      <LabelList
                        dataKey="total"
                        position="top"
                        fontSize={CHART_VALUE_LABEL_SIZE}
                        fill="#111827"
                        offset={8}
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
        id: 'statusByPeriod',
        defaultLayout: { x: 0, y: 8, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Статусы по периодам"
            description="Распределение статусов внутри периода"
            exportSectionId="statusByPeriod"
            exportSelected={exportSections.isSelected('statusByPeriod')}
            onToggleExport={() => exportSections.toggleSection('statusByPeriod')}
          >
            {completedPeriodSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><BarChart data={completedPeriodSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="label" tick={CHART_AXIS_TICK} {...periodXAxisProps} /><YAxis allowDecimals={false} tick={CHART_AXIS_TICK} /><Tooltip /><Legend wrapperStyle={CHART_LEGEND_STYLE} />{RECOMMENDATION_STATUS_OPTIONS.map((status) => <Bar key={status.value} dataKey={status.value} name={status.label} stackId="status" fill={STATUS_COLORS[status.value]} />)}</BarChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'materialityCombined',
        defaultLayout: { x: 0, y: 5, w: 12, h: 3, minW: 6, minH: 2 },
        render: () => (
          <ChartCard
            title="Существенность"
            description="Распределение уровней существенности: за период и по период"
            exportSelected={isMaterialityExportSelected}
            onToggleExport={toggleMaterialityExport}
          >
            <div className="flex h-full min-h-0 flex-row gap-2">
              <div
                ref={materialityCaptureRef}
                style={{ flex: 1 }}
                data-analytics-export-capture-id="materiality"
                data-analytics-export-title="Существенность"
                data-analytics-export-description="Распределение уровней существенности за период"
                className="flex-1 min-h-0 min-w-0"
              >
                {materialityDistribution.length === 0 ? (
                  <EmptyChart message="Нет данных" heightClass="h-full" />
                ) : (
                  <FocusableDonutChart
                    data={coloredMaterialityDistribution}
                    labelMode="both"
                    legendLabelMode="name"
                    showLegend={false}
                    containerClassName="h-full min-h-0"
                  />
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
                  <div className="h-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={completedPeriodSeries}
                        margin={{ top: 18, right: 12, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="label" tick={CHART_AXIS_TICK} {...periodXAxisProps} />
                        <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
                        <Tooltip />
                        <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                        <Bar dataKey="low" name="Низкий" stackId="mat" fill={MATERIALITY_COLORS.низкий} />
                        <Bar
                          dataKey="medium"
                          name="Средний"
                          stackId="mat"
                          fill={MATERIALITY_COLORS.средний}
                        />
                        <Bar
                          dataKey="high"
                          name="Высокий"
                          stackId="mat"
                          fill={MATERIALITY_COLORS.высокий}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'indicators',
        defaultLayout: { x: 9, y: 2, w: 3, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Индикаторы"
            description="Распределение индикаторов за период"
            exportSectionId="indicators"
            exportSelected={exportSections.isSelected('indicators')}
            onToggleExport={() => exportSections.toggleSection('indicators')}
          >
            {indicatorDistribution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableSquareCirclesChart
                data={coloredIndicatorDistribution}
                labelMode="both"
              />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'objects',
        defaultLayout: { x: 6, y: 8, w: 6, h: 3, minW: 6, minH: 3 },
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
                palette={VALUE_GRAY_SCALE}
                colorByValue
              />
            )}
          </ChartCard>
        ),
      },
    ],
    [
      cumulativeColors,
      completedCumulativeSeries,
      exportSections,
      isMaterialityExportSelected,
      coloredIndicatorDistribution,
      coloredMaterialityDistribution,
      indicatorDistribution,
      materialityDistribution,
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
    <div className="flex flex-col gap-4 text-left lg:flex-row lg:items-stretch">
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
        exportSelectedCount={exportSections.selectedCount}
        exportTotalCount={exportSections.totalCount}
        onSelectAllExport={exportSections.selectAll}
        onClearExport={exportSections.clearAll}
        selectionSummary={(
          <AnalyticsSelectionSummary
            metrics={[
            { label: 'Рекомендаций', value: filteredTotal, hint:`из ${universeTotal}` },
            ]}
            items={[
              {
                label: periodSliceLabel,
                chips: activePeriodValues.map((value) => ({ value, label: value })),
                emptyLabel: 'Все значения',
                onRemove: removeActivePeriodValue,
              },
              {
                label: 'Аудиторы',
                chips: selectedAuditors.map((value) => ({ value, label: value })),
                emptyLabel: 'Все аудиторы',
                onRemove: (value) => setSelectedAuditors((prev) => prev.filter((item) => item !== value)),
              },
              {
                label: 'Департаменты',
                chips: selectedDepartments.map((value) => ({ value, label: value })),
                emptyLabel: 'Все департаменты',
                onRemove: (value) => setSelectedDepartments((prev) => prev.filter((item) => item !== value)),
              },
              {
                label: 'Существенность',
                chips: selectedMateriality.map((value) => ({
                  value,
                  label: MATERIALITY_LEVEL_OPTIONS.find((option) => option.value === value)?.label ?? value,
                })),
                emptyLabel: 'Все уровни',
                onRemove: (value) => setSelectedMateriality((prev) => prev.filter((item) => item !== value)),
              },
              {
                label: 'Статусы',
                chips: selectedStatuses.map((value) => ({
                  value,
                  label: RECOMMENDATION_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value,
                })),
                emptyLabel: 'Все статусы',
                onRemove: (value) => setSelectedStatuses((prev) => prev.filter((item) => item !== value)),
              },
              {
                label: 'Дополнительные статусы',
                chips: selectedAdditionalStatuses.map((value) => ({
                  value,
                  label:
                    RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value,
                })),
                emptyLabel: 'Все доп. статусы',
                onRemove: (value) => setSelectedAdditionalStatuses((prev) => prev.filter((item) => item !== value)),
              },
            ]}
          />
        )}
      >
        <div>
          <p className="mb-2 text-sm font-medium leading-relaxed text-gray-900">Контроль</p>
          <div className="space-y-2.5">
            <MultiCheckboxSelect options={MATERIALITY_LEVEL_OPTIONS} value={selectedMateriality} onChange={setSelectedMateriality} placeholder="Выберите уровень существенности" />
            <MultiCheckboxSelect options={RECOMMENDATION_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))} value={selectedStatuses} onChange={setSelectedStatuses} placeholder="Выберите статус" />
            <MultiCheckboxSelect options={RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))} value={selectedAdditionalStatuses} onChange={setSelectedAdditionalStatuses} placeholder="Выберите дополнительный статус" />
          </div>
        </div>
      </AnalyticsFilterSidebar>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col lg:-mt-[84px]">
        <AnalyticsDashboardGrid cards={cards} />
      </main>
    </div>
  );
}
