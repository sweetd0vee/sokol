import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchRecommendationsAnalytics } from '../../api/analytics';
import { MultiCheckboxSelect } from '../ui/MultiCheckboxSelect';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsFilterSidebar } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { ChartCard, CHART_AXIS_TICK, CHART_CATEGORY_AXIS_TICK, CHART_LEGEND_STYLE, CHART_VALUE_LABEL_SIZE, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import {
  RECOMMENDATIONS_CUMULATIVE_LINE_COLOR,
  RECOMMENDATIONS_PALETTE,
  RECOMMENDATIONS_PERIOD_BAR_COLOR,
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
} from '../../constants/recommendations';
import { useExportSections } from '../../hooks/useExportSections';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { hasAnalyticsPeriodFilters, useAnalyticsAnchorDates } from '../../hooks/useAnalyticsAnchorDates';
import {
  MATERIALITY_COLORS,
  STATUS_COLORS,
  type PeriodGranularity,
} from '../../utils/recommendationAnalytics';
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
const EMPTY_PERIOD_SERIES: never[] = [];
const EMPTY_CUMULATIVE_SERIES: never[] = [];
const EMPTY_MATERIALITY_DISTRIBUTION: never[] = [];
const EMPTY_INDICATOR_DISTRIBUTION: never[] = [];
const EMPTY_OBJECT_DISTRIBUTION: never[] = [];
const EMPTY_CHECK_LINKS: never[] = [];

export function RecommendationsAnalyticsDashboard() {
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedMateriality, setSelectedMateriality] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedAdditionalStatuses, setSelectedAdditionalStatuses] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<AnalyticsExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  const exportSections = useExportSections(
    RECOMMENDATION_EXPORT_SECTIONS.map((section) => section.id) as RecommendationExportSectionId[],
  );

  const bootstrapQuery = useQuery({
    queryKey: ['analytics', 'recommendations', 'bootstrap'],
    queryFn: () => fetchRecommendationsAnalytics({ granularity: 'year' }),
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
      selectedMonthKeys,
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
        months: selectedMonthKeys,
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
  const materialityDistribution = data?.materialityDistribution ?? EMPTY_MATERIALITY_DISTRIBUTION;
  const indicatorDistribution = data?.indicatorDistribution ?? EMPTY_INDICATOR_DISTRIBUTION;
  const objectDistribution = data?.objectDistribution ?? EMPTY_OBJECT_DISTRIBUTION;
  const checkLinks = data?.checkLinks ?? EMPTY_CHECK_LINKS;
  const universeTotal = data?.universeTotal ?? 0;
  const filteredTotal = data?.filteredTotal ?? 0;

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
            title="Сводка KPI"
            description=""
            dense
            hideTitle
            exportSectionId="summary"
            exportSelected={exportSections.isSelected('summary')}
            onToggleExport={() => exportSections.toggleSection('summary')}
          >
            <div className="grid w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard label="Всего" value={summary.total} hint={`из ${universeTotal}`} tone="violet" />
              <KpiCard label="Исполнено" value={summary.byStatus.completed} tone="green" />
              <KpiCard label="Не решено" value={summary.byStatus.unresolved} tone="slate" />
              <KpiCard label="Высокая существенность" value={summary.byMateriality.высокий} tone="amber" />
              <KpiCard label="Исполнение" value={summary.completionRate} suffix="%" tone="blue" />
              <KpiCard label="Нарушение срока" value={summary.violationRate} suffix="%" tone="red" />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'cumulative',
        defaultLayout: { x: 0, y: 2, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Количество рекомендаций"
            description="Динамика и накопительный итог"
            exportSectionId="cumulative"
            exportSelected={exportSections.isSelected('cumulative')}
            onToggleExport={() => exportSections.toggleSection('cumulative')}
          >
            {cumulativeSeries.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cumulativeSeries} margin={{ top: 22, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
                    <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <Tooltip />
                    <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                    <Bar dataKey="total" name="За период" fill={RECOMMENDATIONS_PERIOD_BAR_COLOR} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="total" position="top" fontSize={CHART_VALUE_LABEL_SIZE} />
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      name="Всего"
                      stroke={RECOMMENDATIONS_CUMULATIVE_LINE_COLOR}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: RECOMMENDATIONS_CUMULATIVE_LINE_COLOR }}
                    >
                      <LabelList
                        dataKey="cumulative"
                        position="top"
                        fontSize={CHART_VALUE_LABEL_SIZE}
                        fill={RECOMMENDATIONS_CUMULATIVE_LINE_COLOR}
                        offset={8}
                      />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'statusByPeriod',
        defaultLayout: { x: 6, y: 2, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Статусы по периодам"
            description="Распределение статусов внутри периода"
            exportSectionId="statusByPeriod"
            exportSelected={exportSections.isSelected('statusByPeriod')}
            onToggleExport={() => exportSections.toggleSection('statusByPeriod')}
          >
            {periodSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><BarChart data={periodSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="label" tick={CHART_AXIS_TICK} /><YAxis allowDecimals={false} tick={CHART_AXIS_TICK} /><Tooltip /><Legend wrapperStyle={CHART_LEGEND_STYLE} />{RECOMMENDATION_STATUS_OPTIONS.map((status) => <Bar key={status.value} dataKey={status.value} name={status.label} stackId="status" fill={STATUS_COLORS[status.value]} />)}</BarChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'materialityByPeriod',
        defaultLayout: { x: 0, y: 5, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Существенность по периодам"
            description="Распределение уровней существенности внутри периода"
            exportSectionId="materialityByPeriod"
            exportSelected={exportSections.isSelected('materialityByPeriod')}
            onToggleExport={() => exportSections.toggleSection('materialityByPeriod')}
          >
            {periodSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><BarChart data={periodSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="label" tick={CHART_AXIS_TICK} /><YAxis allowDecimals={false} tick={CHART_AXIS_TICK} /><Tooltip /><Legend wrapperStyle={CHART_LEGEND_STYLE} /><Bar dataKey="low" name="Низкий" stackId="mat" fill={MATERIALITY_COLORS.низкий} /><Bar dataKey="medium" name="Средний" stackId="mat" fill={MATERIALITY_COLORS.средний} /><Bar dataKey="high" name="Высокий" stackId="mat" fill={MATERIALITY_COLORS.высокий} /></BarChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'materiality',
        defaultLayout: { x: 6, y: 5, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Существенность"
            description="Распределение уровней существенности за период"
            exportSectionId="materiality"
            exportSelected={exportSections.isSelected('materiality')}
            onToggleExport={() => exportSections.toggleSection('materiality')}
          >
            {materialityDistribution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableDonutChart
                data={materialityDistribution}
                palette={RECOMMENDATIONS_PALETTE}
              />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'indicators',
        defaultLayout: { x: 0, y: 8, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Индикаторы"
            description="Распределение выбранной выборки"
            exportSectionId="indicators"
            exportSelected={exportSections.isSelected('indicators')}
            onToggleExport={() => exportSections.toggleSection('indicators')}
          >
            {indicatorDistribution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableDonutChart data={indicatorDistribution} palette={RECOMMENDATIONS_PALETTE} />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'checkLinks',
        defaultLayout: { x: 6, y: 8, w: 6, h: 3, minW: 4, minH: 2 },
        render: () => (
          <ChartCard title="По проверкам" description="Количество рекомендаций на ключ проверки" exportSectionId="checkLinks" exportSelected={exportSections.isSelected('checkLinks')} onToggleExport={() => exportSections.toggleSection('checkLinks')}>
            <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><BarChart data={checkLinks.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 24, left: 30, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} /><YAxis type="category" dataKey="name" width={120} tick={CHART_CATEGORY_AXIS_TICK} /><Tooltip /><Bar dataKey="value" name="Рекомендации" fill={RECOMMENDATIONS_PALETTE[6]} radius={[0, 6, 6, 0]}><LabelList dataKey="value" position="right" fontSize={CHART_VALUE_LABEL_SIZE} /></Bar></BarChart></ResponsiveContainer></div>
          </ChartCard>
        ),
      },
      {
        id: 'objects',
        defaultLayout: { x: 0, y: 11, w: 12, h: 4, minW: 6, minH: 3 },
        render: () => (
          <ChartCard title="Карта департаментов" description="Количество рекомендаций за период по департаментам" exportSectionId="objects" exportSelected={exportSections.isSelected('objects')} onToggleExport={() => exportSections.toggleSection('objects')}>
            {objectDistribution.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <FocusableTreemapChart data={objectDistribution} palette={RECOMMENDATIONS_PALETTE} />
            )}
          </ChartCard>
        ),
      },
    ],
    [
      checkLinks,
      cumulativeSeries,
      exportSections,
      indicatorDistribution,
      materialityDistribution,
      objectDistribution,
      periodSeries,
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
        monthOptions={monthOptions}
        selectedYears={selectedYears}
        selectedQuarters={selectedQuarters}
        selectedMonths={selectedMonths}
        onYearsChange={setSelectedYears}
        onQuartersChange={setSelectedQuarters}
        onMonthsChange={setSelectedMonths}
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

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AnalyticsDashboardGrid cards={cards} />
      </main>
    </div>
  );
}
