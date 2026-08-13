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
import { fetchChecksAnalytics, type ChecksAnalyticsPeriodPoint } from '../../api/analytics';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsFilterSidebar } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { ChartCard, CHART_AXIS_TICK, CHART_LEGEND_STYLE, CHART_VALUE_LABEL_SIZE, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import { EffectivenessMatrixChart } from './EffectivenessMatrixChart';
import { CHECKS_PALETTE } from './analyticsPalette';
import { exportChecksDashboard, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import { CHECK_EXPORT_SECTIONS, type CheckExportSectionId } from '../../constants/analyticsExportSections';
import { useExportSections } from '../../hooks/useExportSections';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { hasAnalyticsPeriodFilters, useAnalyticsAnchorDates } from '../../hooks/useAnalyticsAnchorDates';
import { labelFromPeriodKey } from '../../utils/analyticsPeriod';
import type { PeriodGranularity } from '../../utils/checkAnalytics';
import { ErrorState, LoadingState } from '../ui/StateMessage';

const EMPTY_CHECKS_SUMMARY = { total: 0, not_started: 0, in_progress: 0, completed: 0 };
const EMPTY_FLOW_SERIES: never[] = [];
const EMPTY_VIEW_DISTRIBUTION: never[] = [];
const EMPTY_TYPE_DISTRIBUTION: never[] = [];
const EMPTY_DEPARTMENT_MAP: never[] = [];
const EMPTY_EFFECTIVENESS_MATRIX: never[] = [];

function sortKeyFromPeriodKey(key: string, granularity: PeriodGranularity) {
  if (granularity === 'year') {
    return Number(key);
  }
  if (granularity === 'quarter') {
    const [year, quarter] = key.split('-Q');
    return Number(year) * 10 + Number(quarter);
  }
  const [year, month] = key.split('-');
  return Number(year) * 100 + Number(month);
}

function completeSelectedPeriods(
  series: ChecksAnalyticsPeriodPoint[],
  granularity: PeriodGranularity,
  selectedKeys: string[],
) {
  if (selectedKeys.length === 0) {
    return series;
  }

  const byKey = new Map(series.map((item) => [item.key, item]));
  let cumulative = 0;

  return selectedKeys
    .map((key) => (
      byKey.get(key) ?? {
        key,
        label: labelFromPeriodKey(key, granularity),
        sortKey: sortKeyFromPeriodKey(key, granularity),
        total: 0,
        not_started: 0,
        in_progress: 0,
        completed: 0,
        cumulative: 0,
      }
    ))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((item) => {
      cumulative += item.total;
      return { ...item, cumulative };
    });
}

export function ChecksAnalyticsDashboard() {
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<AnalyticsExportFormat>('html');
  const [isExporting, setIsExporting] = useState(false);

  const exportSections = useExportSections(
    CHECK_EXPORT_SECTIONS.map((section) => section.id) as CheckExportSectionId[],
  );

  const bootstrapQuery = useQuery({
    queryKey: ['analytics', 'checks', 'bootstrap'],
    queryFn: () =>
      fetchChecksAnalytics({
        granularity: 'year',
        years: [],
        quarters: [],
        months: [],
        auditors: [],
        departments: [],
      }),
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
    granularity,
  });

  const analyticsQuery = useQuery({
    queryKey: [
      'analytics',
      'checks',
      granularity,
      selectedYearKeys,
      selectedQuarterKeys,
      selectedMonthKeys,
      selectedAuditors,
      selectedDepartments,
    ],
    queryFn: () =>
      fetchChecksAnalytics({
        granularity,
        years: selectedYearKeys,
        quarters: selectedQuarterKeys,
        months: selectedMonthKeys,
        auditors: selectedAuditors,
        departments: selectedDepartments,
      }),
    enabled: bootstrapQuery.isSuccess,
    initialData: !hasActiveFilters ? bootstrapQuery.data : undefined,
    initialDataUpdatedAt: !hasActiveFilters ? bootstrapQuery.dataUpdatedAt : undefined,
  });

  const data = hasActiveFilters ? analyticsQuery.data : (analyticsQuery.data ?? bootstrapQuery.data);
  const auditorOptions = useMemo(
    () => toAnalyticsSelectOptions(data?.filterOptions.auditors ?? []),
    [data?.filterOptions.auditors],
  );
  const departmentOptions = useMemo(
    () => toAnalyticsSelectOptions(data?.filterOptions.departments ?? []),
    [data?.filterOptions.departments],
  );

  const summary = data?.summary ?? EMPTY_CHECKS_SUMMARY;
  const completionShare = data?.completionShare ?? 0;
  const rawFlowSeries = data?.periodSeries ?? EMPTY_FLOW_SERIES;
  const selectedPeriodKeys =
    granularity === 'month' ? selectedMonthKeys : granularity === 'quarter' ? selectedQuarterKeys : selectedYearKeys;
  const flowSeries = useMemo(
    () => completeSelectedPeriods(rawFlowSeries, granularity, selectedPeriodKeys),
    [granularity, rawFlowSeries, selectedPeriodKeys],
  );
  const viewDistribution = data?.viewDistribution ?? EMPTY_VIEW_DISTRIBUTION;
  const typeDistribution = data?.typeDistribution ?? EMPTY_TYPE_DISTRIBUTION;
  const departmentMap = data?.departmentMap ?? EMPTY_DEPARTMENT_MAP;
  const departmentMapTop = useMemo(
    () => [...departmentMap].sort((left, right) => right.value - left.value).slice(0, 10),
    [departmentMap],
  );
  const effectivenessMatrix = data?.effectivenessMatrix ?? EMPTY_EFFECTIVENESS_MATRIX;
  const universeTotal = data?.universeTotal ?? 0;
  const filteredTotal = data?.filteredTotal ?? 0;

  const resetFilters = () => {
    resetPeriodSelections();
    setSelectedAuditors([]);
    setSelectedDepartments([]);
  };

  const handleExport = async () => {
    if (filteredTotal === 0 || isExporting || analyticsQuery.isFetching || !data) {
      return;
    }
    if (exportSections.selectedSections.length === 0) {
      window.alert('Выберите хотя бы один дашборд для экспорта');
      return;
    }
    setIsExporting(true);
    try {
      await exportChecksDashboard(
        {
          checks: [],
          filteredChecks: [],
          granularity,
          auditors: selectedAuditors,
          departments: selectedDepartments,
          selectedSections: exportSections.selectedSections,
          selectedPeriodLabels: activePeriodValues,
          universeTotal,
          filteredTotal,
          effectivenessMatrixOverride: effectivenessMatrix,
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
            <div className="grid w-full grid-cols-2 gap-1 lg:grid-cols-5">
              <KpiCard label="Всего" value={summary.total} hint={`из ${universeTotal}`} tone="blue" />
              <KpiCard label="Запланировано" value={summary.not_started} tone="slate" />
              <KpiCard label="В процессе" value={summary.in_progress} tone="amber" />
              <KpiCard label="Завершено" value={summary.completed} tone="green" />
              <KpiCard label="Доля завершённых" value={completionShare} suffix="%" tone="red" />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'dynamics',
        defaultLayout: { x: 0, y: 2, w: 6, h: 4, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Количество проверок"
            description="Динамика и накопительный итог"
            exportSectionId="dynamics"
            exportSelected={exportSections.isSelected('dynamics')}
            onToggleExport={() => exportSections.toggleSection('dynamics')}
          >
            {flowSeries.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={flowSeries} margin={{ top: 22, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
                    <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <Tooltip />
                    <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                    <Bar dataKey="total" name="За период" fill={CHECKS_PALETTE[11]} radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="cumulative" name="Всего" stroke={CHECKS_PALETTE[0]} strokeWidth={2.5} dot={{ r: 3, fill: CHECKS_PALETTE[0] }}>
                      <LabelList
                        dataKey="cumulative"
                        position="top"
                        fontSize={CHART_VALUE_LABEL_SIZE}
                        fill={CHECKS_PALETTE[0]}
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
        id: 'views',
        defaultLayout: { x: 6, y: 2, w: 6, h: 4, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Виды проверок"
            description="Количество проверок за период"
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
                    <Bar dataKey="value" name="Проверки" fill={CHECKS_PALETTE[8]} radius={[0, 6, 6, 0]}>
                      <LabelList
                        dataKey="value"
                        position="right"
                        fontSize={CHART_VALUE_LABEL_SIZE}
                        fill={CHECKS_PALETTE[0]}
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
        id: 'types',
        defaultLayout: { x: 0, y: 6, w: 5, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Типы проверок"
            description="Распределение плановых, внеплановых и контрольных процедур за период"
            exportSectionId="types"
            exportSelected={exportSections.isSelected('types')}
            onToggleExport={() => exportSections.toggleSection('types')}
          >
            {typeDistribution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableDonutChart data={typeDistribution} palette={CHECKS_PALETTE} labelMode="both" />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'departmentMap',
        defaultLayout: { x: 5, y: 6, w: 7, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Карта департаментов (ТОП-10)"
            description="Количество проверок за период по департаментам"
            exportSectionId="departmentMap"
            exportSelected={exportSections.isSelected('departmentMap')}
            onToggleExport={() => exportSections.toggleSection('departmentMap')}
          >
            {departmentMapTop.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableTreemapChart data={departmentMapTop} palette={CHECKS_PALETTE} />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'effectivenessMatrix',
        defaultLayout: { x: 0, y: 9, w: 12, h: 6, minW: 6, minH: 4 },
        render: () => (
          <ChartCard
            title="Оценка эффективности"
            description="Матрица оценок по проверкам за период"
            exportSectionId="effectivenessMatrix"
            exportSelected={exportSections.isSelected('effectivenessMatrix')}
            onToggleExport={() => exportSections.toggleSection('effectivenessMatrix')}
          >
            {effectivenessMatrix.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <EffectivenessMatrixChart rows={effectivenessMatrix} />
            )}
          </ChartCard>
        ),
      },
    ],
    [
      completionShare,
      departmentMapTop,
      effectivenessMatrix,
      exportSections,
      flowSeries,
      summary,
      typeDistribution,
      universeTotal,
      viewDistribution,
    ],
  );

  if ((bootstrapQuery.isLoading || analyticsQuery.isLoading) && !data) {
    return <LoadingState title="Загрузка аналитики проверок…" />;
  }

  if ((bootstrapQuery.isError || analyticsQuery.isError) && !data) {
    const error = analyticsQuery.error ?? bootstrapQuery.error;
    return (
      <ErrorState
        title="Не удалось загрузить аналитику проверок"
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
        canExport={filteredTotal > 0 && !analyticsQuery.isFetching}
        onExport={handleExport}
        exportSelectedCount={exportSections.selectedCount}
        exportTotalCount={exportSections.totalCount}
        onSelectAllExport={exportSections.selectAll}
        onClearExport={exportSections.clearAll}
        selectionSummary={(
          <AnalyticsSelectionSummary
            metrics={[
              { label: 'Проверок', value: filteredTotal, hint:`из ${universeTotal}` },
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
            ]}
          />
        )}
      />

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col lg:-mt-[84px]">
        {analyticsQuery.isFetching ? (
          <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-md bg-white/90 px-2 py-1 text-xs text-slate-500 shadow-sm">
            Обновление…
          </div>
        ) : null}
        <AnalyticsDashboardGrid cards={cards} />
      </main>
    </div>
  );
}
