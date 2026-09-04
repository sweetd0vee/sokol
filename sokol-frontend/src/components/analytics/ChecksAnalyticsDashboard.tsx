import { useMemo } from 'react';
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
import { fetchChecksAnalytics, type ChecksAnalyticsPeriodPoint } from '../../api/analytics';
import { queryKeys } from '../../api/queryKeys';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsDashboardFrame } from './AnalyticsDashboardFrame';
import { AnalyticsFilterSidebar } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { filterSelectionItem } from './filterSelectionItem';
import { ChartCard, CHART_AXIS_TICK, CHART_VALUE_LABEL_SIZE, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import { EffectivenessMatrixChart } from './EffectivenessMatrixChart';
import { CHECKS_PALETTE, getValueBasedColors, VALUE_BLUE_SCALE } from './analyticsPalette';
import { useAnalyticsDashboardSession } from './useAnalyticsDashboardSession';
import { exportChecksDashboard } from '../../utils/analyticsExport';
import { CHECK_EXPORT_SECTIONS, type CheckExportSectionId } from '../../constants/analyticsExportSections';
import { useExportSections } from '../../hooks/useExportSections';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { hasAnalyticsPeriodFilters, useAnalyticsAnchorDates } from '../../hooks/useAnalyticsAnchorDates';
import { labelFromPeriodKey } from '../../utils/analyticsPeriod';
import type { PeriodGranularity } from '../../utils/checkAnalytics';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import { useAddToConstructor } from './constructor/useAddToConstructor';
import { buildChecksConstructorDrafts } from './constructor/buildConstructorWidgets';
import { buildConstructorFilterCaption } from './constructor/constructorFilterCaption';

const EMPTY_CHECKS_SUMMARY = { total: 0, not_started: 0, in_progress: 0, completed: 0 };
const EMPTY_FLOW_SERIES: never[] = [];
const EMPTY_VIEW_DISTRIBUTION: never[] = [];
const EMPTY_TYPE_DISTRIBUTION: never[] = [];
const EMPTY_DEPARTMENT_MAP: never[] = [];
const EMPTY_EFFECTIVENESS_MATRIX: never[] = [];
const QUARTER_AXIS_TICK = { fontSize: 12 } as const;

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
    CHECK_EXPORT_SECTIONS.map((section) => section.id) as CheckExportSectionId[],
  );
  const { addToConstructor, justAdded } = useAddToConstructor();

  const bootstrapQuery = useQuery({
    queryKey: queryKeys.analytics.checksBootstrap,
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
      'checks',
      granularity,
      selectedYearKeys,
      selectedQuarterKeys,
      selectedAuditors,
      selectedDepartments,
    ],
    queryFn: () =>
      fetchChecksAnalytics({
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

  const data = hasActiveFilters ? analyticsQuery.data : (analyticsQuery.data ?? bootstrapQuery.data);
  const filterOptionsData = data ?? bootstrapQuery.data;
  const isWaitingForFilteredData = hasActiveFilters && analyticsQuery.isFetching && !analyticsQuery.data;
  const auditorOptions = useMemo(
    () => toAnalyticsSelectOptions(filterOptionsData?.filterOptions.auditors ?? []),
    [filterOptionsData?.filterOptions.auditors],
  );
  const departmentOptions = useMemo(
    () => toAnalyticsSelectOptions(filterOptionsData?.filterOptions.departments ?? []),
    [filterOptionsData?.filterOptions.departments],
  );

  const summary = data?.summary ?? EMPTY_CHECKS_SUMMARY;
  const completionShare = data?.completionShare ?? 0;
  const rawFlowSeries = data?.periodSeries ?? EMPTY_FLOW_SERIES;
  const selectedPeriodKeys = granularity === 'quarter' ? selectedQuarterKeys : selectedYearKeys;
  const flowSeries = useMemo(
    () => completeSelectedPeriods(rawFlowSeries, granularity, selectedPeriodKeys),
    [granularity, rawFlowSeries, selectedPeriodKeys],
  );
  const flowColors = useMemo(
    () => getValueBasedColors(flowSeries.map((item) => item.total)),
    [flowSeries],
  );
  const viewDistribution = data?.viewDistribution ?? EMPTY_VIEW_DISTRIBUTION;
  const viewColors = useMemo(
    () => getValueBasedColors(viewDistribution.map((item) => item.value)),
    [viewDistribution],
  );
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
    resetEntityFilters();
  };

  const handleExport = async () => {
    if (filteredTotal === 0 || isExporting || analyticsQuery.isFetching || !data) {
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
          selectedSections: [...exportSections.allIds],
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

  const handleAddToConstructor = () => {
    const added = addToConstructor(
      buildChecksConstructorDrafts({
        selectedSections: exportSections.selectedSections,
        filterCaption: buildConstructorFilterCaption({
          periodSliceLabel,
          periods: activePeriodValues,
          auditors: selectedAuditors,
          departments: selectedDepartments,
        }),
        summary,
        universeTotal,
        completionShare,
        flowSeries,
        flowColors,
        granularity,
        viewDistribution,
        viewColors,
        typeDistribution,
        departmentMapTop,
        effectivenessMatrix,
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
            <div className="grid w-full grid-cols-2 gap-1 lg:grid-cols-5">
              <KpiCard label="Всего" value={summary.total} hint={`из ${universeTotal}`} tone="blue" />
              <KpiCard label="Запланировано" value={summary.not_started} tone="slate" />
              <KpiCard label="В процессе" value={summary.in_progress} tone="amber" />
              <KpiCard label="Завершено" value={summary.completed} tone="green" />
              <KpiCard label="Доля завершённых" value={completionShare} suffix="%" tone="green" />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'dynamics',
        defaultLayout: { x: 0, y: 2, w: 9, h: 3, minW: 4, minH: 2 },
        render: () => (
          <ChartCard
            title="Количество проверок"
            description="Динамика количества проверок за период"
            exportSectionId="dynamics"
            exportSelected={exportSections.isSelected('dynamics')}
            onToggleExport={() => exportSections.toggleSection('dynamics')}
          >
            {flowSeries.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={flowSeries}
                    margin={{
                      top: 22,
                      right: granularity === 'quarter' ? 20 : 12,
                      left: granularity === 'quarter' ? 8 : -10,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="label"
                      tick={granularity === 'quarter' ? QUARTER_AXIS_TICK : CHART_AXIS_TICK}
                      interval={0}
                      minTickGap={0}
                      height={granularity === 'quarter' ? 36 : 30}
                      padding={granularity === 'quarter' ? { left: 10, right: 10 } : undefined}
                    />
                    <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <Tooltip itemStyle={{ color: '#003366' }} />
                    <Bar dataKey="total" name="За период" fill="#003366" radius={[4, 4, 0, 0]}>
                      {flowSeries.map((item, index) => (
                        <Cell key={item.key} fill={flowColors[index]} />
                      ))}
                      <LabelList
                        dataKey="total"
                        position="top"
                        fontSize={CHART_VALUE_LABEL_SIZE}
                        fill={CHECKS_PALETTE[0]}
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
        id: 'views',
        defaultLayout: { x: 0, y: 5, w: 4, h: 3, minW: 3, minH: 2 },
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
                      {viewDistribution.map((item, index) => (
                        <Cell key={item.name} fill={viewColors[index]} />
                      ))}
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
        defaultLayout: { x: 9, y: 2, w: 3, h: 3, minW: 3, minH: 2 },
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
              <FocusableDonutChart
                data={typeDistribution}
                palette={VALUE_BLUE_SCALE}
                colorByValue
                labelMode="both"
                legendPercentFirst
              />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'departmentMap',
        defaultLayout: { x: 4, y: 5, w: 8, h: 3, minW: 3, minH: 2 },
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
              <FocusableTreemapChart
                data={departmentMapTop}
                palette={VALUE_BLUE_SCALE}
                colorByValue
              />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'effectivenessMatrix',
        defaultLayout: { x: 0, y: 8, w: 12, h: 8, minW: 6, minH: 6 },
        expandToContent: true,
        render: () => (
          <ChartCard
            title="Оценка эффективности"
            description="Матрица оценок по проверкам за период"
            exportSectionId="effectivenessMatrix"
            exportSelected={exportSections.isSelected('effectivenessMatrix')}
            onToggleExport={() => exportSections.toggleSection('effectivenessMatrix')}
            fitContent
          >
            {effectivenessMatrix.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <EffectivenessMatrixChart rows={effectivenessMatrix} scrollBody={false} />
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
      flowColors,
      flowSeries,
      granularity,
      summary,
      typeDistribution,
      universeTotal,
      viewColors,
      viewDistribution,
    ],
  );

  if (bootstrapQuery.isLoading && !data) {
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
        canExport={filteredTotal > 0 && !analyticsQuery.isFetching}
        onExport={handleExport}
        onAddToConstructor={handleAddToConstructor}
        canAddToConstructor={exportSections.selectedCount > 0}
        addToConstructorCount={exportSections.selectedCount}
        constructorAdded={justAdded}
        selectionSummary={(
          <AnalyticsSelectionSummary
            metrics={[
              { label: 'Проверок', value: filteredTotal, hint:`из ${universeTotal}` },
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
      {analyticsQuery.isFetching ? (
        <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-md bg-white/90 px-2 py-1 text-xs text-slate-500 shadow-sm">
          Обновление…
        </div>
      ) : null}
      {isWaitingForFilteredData ? (
        <LoadingState title="Загрузка аналитики проверок…" />
      ) : (
        <AnalyticsDashboardGrid cards={cards} />
      )}
    </AnalyticsDashboardFrame>
  );
}
