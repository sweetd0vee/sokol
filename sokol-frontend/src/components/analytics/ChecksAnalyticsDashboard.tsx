import { useMemo } from 'react';
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
import { fetchChecksAnalytics } from '../../api/analytics';
import { queryKeys } from '../../api/queryKeys';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import {
  ANALYTICS_DASHBOARD_MAIN_CLASS,
  AnalyticsDashboardShell,
} from './AnalyticsDashboardShell';
import { ChartCard, CHART_AXIS_TICK, CHART_VALUE_LABEL_SIZE, CHART_VALUE_LABEL_WEIGHT, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import { EffectivenessMatrixChart } from './EffectivenessMatrixChart';
import { CHECKS_PALETTE, getValueBasedColors, MONITORING_STATUS_COLORS, VALUE_BLUE_SCALE } from './analyticsPalette';
import { useAnalyticsDashboardController } from './useAnalyticsDashboardController';
import { exportChecksDashboard } from '../../utils/analyticsExport';
import { CHECK_EXPORT_SECTIONS, type CheckExportSectionId } from '../../constants/analyticsExportSections';
import { useExportSections } from '../../hooks/useExportSections';
import {
  completeSelectedPeriodPoints,
  emptyChecksPeriodPoint,
  withRunningTotal,
} from '../../utils/analyticsPeriodSeries';
import { topByValue } from '../../utils/analyticsDistribution';
import { runAnalyticsExport } from '../../utils/runAnalyticsExport';
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

export function ChecksAnalyticsDashboard() {
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
    selectedYearKeys,
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
    isWaitingForFilteredData,
    resetFilters,
  } = useAnalyticsDashboardController({
    resource: 'checks',
    bootstrapQueryKey: queryKeys.analytics.checksBootstrap,
    fetchBootstrap: () =>
      fetchChecksAnalytics({
        granularity: 'year',
        years: [],
        quarters: [],
        months: [],
        auditors: [],
        departments: [],
      }),
    fetchFiltered: fetchChecksAnalytics,
    preferFilteredData: true,
  });

  const exportSections = useExportSections(
    CHECK_EXPORT_SECTIONS.map((section) => section.id) as CheckExportSectionId[],
  );
  const { addToConstructor, justAdded } = useAddToConstructor();

  const summary = data?.summary ?? EMPTY_CHECKS_SUMMARY;
  const completionShare = data?.completionShare ?? 0;
  const rawFlowSeries = data?.periodSeries ?? EMPTY_FLOW_SERIES;
  const selectedPeriodKeys = granularity === 'quarter' ? selectedQuarterKeys : selectedYearKeys;
  const flowSeries = useMemo(() => {
    if (selectedPeriodKeys.length === 0) {
      return rawFlowSeries;
    }
    return withRunningTotal(
      completeSelectedPeriodPoints(rawFlowSeries, selectedPeriodKeys, (key) =>
        emptyChecksPeriodPoint(key, granularity),
      ),
    );
  }, [granularity, rawFlowSeries, selectedPeriodKeys]);
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
  const departmentMapTop = useMemo(() => topByValue(departmentMap, 10), [departmentMap]);
  const effectivenessMatrix = data?.effectivenessMatrix ?? EMPTY_EFFECTIVENESS_MATRIX;
  const universeTotal = data?.universeTotal ?? 0;
  const filteredTotal = data?.filteredTotal ?? 0;

  const handleExport = async () => {
    if (filteredTotal === 0 || isExporting || analyticsQuery.isFetching || !data) {
      return;
    }
    await runAnalyticsExport(setIsExporting, () =>
      exportChecksDashboard(
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
      ),
    );
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
            title="Итого по проверкам"
            description=""
            dense
            exportSectionId="summary"
            exportSelected={exportSections.isSelected('summary')}
            onToggleExport={() => exportSections.toggleSection('summary')}
          >
            <div className="grid w-full grid-cols-2 gap-1 lg:grid-cols-5">
              <KpiCard label="Всего" value={summary.total} hint={`из ${universeTotal}`} tone="blue" />
              <KpiCard label="Запланировано" value={summary.not_started} tone="slate" />
              <KpiCard
                label="В процессе"
                value={summary.in_progress}
                accentColor={MONITORING_STATUS_COLORS.in_progress}
              />
              <KpiCard
                label="Завершено"
                value={summary.completed}
                accentColor={MONITORING_STATUS_COLORS.completed}
              />
              <KpiCard
                label="Доля завершённых"
                value={completionShare}
                suffix="%"
                accentColor={MONITORING_STATUS_COLORS.completed}
              />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'dynamics',
        defaultLayout: { x: 0, y: 2, w: 9, h: 3, minW: 4, minH: 2 },
        render: () => (
          <ChartCard
            title="Динамика количества проверок по периодам"
            description=""
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
                        fill="#000000"
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
            title="Виды проверок за период"
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
                    <Bar dataKey="value" name="Проверки" fill={CHECKS_PALETTE[8]} radius={[0, 6, 6, 0]}>
                      {viewDistribution.map((item, index) => (
                        <Cell key={item.name} fill={viewColors[index]} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="right"
                        fontSize={CHART_VALUE_LABEL_SIZE}
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
        id: 'types',
        defaultLayout: { x: 9, y: 2, w: 3, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Типы проверок за период"
            description=""
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
            title="Карта департаментов по количеству проверок (ТОП-10)"
            description=""
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
            title="Матрица оценок эффективности"
            description=""
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

  return (
    <AnalyticsDashboardShell
      loadingTitle="Загрузка аналитики проверок…"
      errorTitle="Не удалось загрузить аналитику проверок"
      bootstrapQuery={bootstrapQuery}
      analyticsQuery={analyticsQuery}
      data={data}
      isWaitingForFilteredData={isWaitingForFilteredData}
      showFetchingBadge
      mainClassName={ANALYTICS_DASHBOARD_MAIN_CLASS}
      selectionMetrics={[{ label: 'Проверок', value: filteredTotal, hint: `из ${universeTotal}` }]}
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
        canExport: filteredTotal > 0 && !analyticsQuery.isFetching,
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
