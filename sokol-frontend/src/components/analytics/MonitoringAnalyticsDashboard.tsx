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
import { fetchMonitoringAnalytics } from '../../api/analytics';
import { queryKeys } from '../../api/queryKeys';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import {
  ANALYTICS_DASHBOARD_MAIN_CLASS,
  AnalyticsDashboardShell,
} from './AnalyticsDashboardShell';
import {
  ChartCard,
  CHART_AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  CHART_VALUE_LABEL_SIZE,
  CHART_VALUE_LABEL_WEIGHT,
  EmptyChart,
  KpiCard,
} from './AnalyticsChartPrimitives';
import {
  applyValueBasedColors,
  lastScaleColor,
  MONITORING_ADDITIONAL_STATUS_COLORS,
  MONITORING_BAR_BLUE_SCALE,
  MONITORING_STATUS_COLORS,
} from './analyticsPalette';
import { EMPTY_RECOMMENDATION_SUMMARY } from './analyticsEmpty';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableSquareCirclesChart } from './FocusableSquareCirclesChart';
import { StatusMatrixChart } from './StatusMatrixChart';
import { CheckKeyAxisTick } from './CheckKeyAxisTick';
import { toAnalyticsFilterSidebarProps } from './analyticsFilterSidebarProps';
import { checkBarTooltipLabel } from './checkBarTooltip';
import { useAnalyticsDashboardController } from './useAnalyticsDashboardController';
import { exportGenericAnalyticsDashboard } from '../../utils/analyticsExport';
import { MONITORING_EXPORT_SECTIONS, type MonitoringExportSectionId } from '../../constants/analyticsExportSections';
import { useExportSections } from '../../hooks/useExportSections';
import {
  DEFAULT_STATUS_MATRIX_COUNT_SORT,
  sortStatusMatrixRows,
  type StatusMatrixCountSortConfig,
} from '../../utils/statusMatrix';
import { useAddToConstructor } from './constructor/useAddToConstructor';
import { buildMonitoringConstructorDrafts } from './constructor/buildConstructorWidgets';
import { buildConstructorFilterCaption } from './constructor/constructorFilterCaption';
import { completeNamedDistribution, distributionHasValues } from '../../utils/analyticsDistribution';
import { runAnalyticsExport } from '../../utils/runAnalyticsExport';

const EMPTY_ADDITIONAL_STATUS_DISTRIBUTION: never[] = [];
const EMPTY_STATUS_DISTRIBUTION: never[] = [];
const EMPTY_STATUS_MATRIX: never[] = [];
const EMPTY_DEADLINE_EXTENSIONS: never[] = [];
const EMPTY_COMPLETED_DURING_AUDIT: never[] = [];

export function MonitoringAnalyticsDashboard() {
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
    periodSliceLabel,
    activePeriodValues,
    handlePeriodSliceChange,
    removeActivePeriodValue,
    bootstrapQuery,
    analyticsQuery,
    data,
    auditorOptions,
    departmentOptions,
    resetFilters,
  } = useAnalyticsDashboardController({
    resource: 'monitoring',
    bootstrapQueryKey: queryKeys.analytics.monitoringBootstrap,
    fetchBootstrap: () => fetchMonitoringAnalytics({ granularity: 'year' }),
    fetchFiltered: fetchMonitoringAnalytics,
  });

  const exportSections = useExportSections(
    MONITORING_EXPORT_SECTIONS.map((section) => section.id) as MonitoringExportSectionId[],
  );
  const { addToConstructor, justAdded } = useAddToConstructor();

  const summary = data?.summary ?? EMPTY_RECOMMENDATION_SUMMARY;
  const additionalStatusDistribution = data?.additionalStatusDistribution ?? EMPTY_ADDITIONAL_STATUS_DISTRIBUTION;
  const statusDistribution = data?.statusDistribution ?? EMPTY_STATUS_DISTRIBUTION;
  const statusMatrix = data?.statusMatrix ?? EMPTY_STATUS_MATRIX;
  const statusMatrixSortRef = useRef<StatusMatrixCountSortConfig>(DEFAULT_STATUS_MATRIX_COUNT_SORT);
  const handleStatusMatrixSortChange = useCallback((sortConfig: StatusMatrixCountSortConfig) => {
    statusMatrixSortRef.current = sortConfig;
  }, []);
  const deadlineExtensionsByCheck = data?.deadlineExtensionsByCheck ?? EMPTY_DEADLINE_EXTENSIONS;
  const completedDuringAuditByCheck = data?.completedDuringAuditByCheck ?? EMPTY_COMPLETED_DURING_AUDIT;
  const universeTotal = data?.universeTotal ?? 0;
  const filteredTotal = data?.filteredTotal ?? 0;

  const deadlineExtensionShortNames = useMemo(
    () => new Map(deadlineExtensionsByCheck.map((item) => [item.key, item.shortName || item.name || item.key])),
    [deadlineExtensionsByCheck],
  );
  const deadlineExtensionColors = useMemo(
    () => applyValueBasedColors(deadlineExtensionsByCheck, MONITORING_BAR_BLUE_SCALE).map((item) => item.color),
    [deadlineExtensionsByCheck],
  );
  const completedDuringAuditShortNames = useMemo(
    () => new Map(completedDuringAuditByCheck.map((item) => [item.key, item.shortName || item.name || item.key])),
    [completedDuringAuditByCheck],
  );
  const completedDuringAuditColors = useMemo(
    () => applyValueBasedColors(completedDuringAuditByCheck, MONITORING_BAR_BLUE_SCALE).map((item) => item.color),
    [completedDuringAuditByCheck],
  );

  const coloredAdditionalStatusDistribution = useMemo(
    () =>
      completeNamedDistribution(
        additionalStatusDistribution,
        [
          { value: 'on_control', label: 'На контроле' },
          { value: 'in_progress', label: 'В процессе' },
          { value: 'deadline_violated', label: 'Срок нарушен' },
          { value: 'on_time', label: 'В срок' },
        ],
        (status) => MONITORING_ADDITIONAL_STATUS_COLORS[status],
      ),
    [additionalStatusDistribution],
  );

  const coloredStatusDistribution = useMemo(
    () =>
      completeNamedDistribution(
        statusDistribution,
        [
          { value: 'completed', label: 'Исполнено' },
          { value: 'unresolved', label: 'Не решено' },
          { value: 'in_progress', label: 'В процессе' },
          { value: 'on_control', label: 'На контроле' },
        ],
        (status) => MONITORING_STATUS_COLORS[status],
      ),
    [statusDistribution],
  );

  const handleExport = async () => {
    if (filteredTotal === 0 || isExporting) {
      return;
    }
    await runAnalyticsExport(
      setIsExporting,
      () =>
        exportGenericAnalyticsDashboard(
          {
            kind: 'monitoring',
            documentTitle: 'Мониторинг',
            filenamePrefix: 'analytics-monitoring',
            selectedSections: [...exportSections.allIds],
            statusMatrixOverride: sortStatusMatrixRows(statusMatrix, statusMatrixSortRef.current),
            meta: [
              ['Аудиторы', selectedAuditors.length ? selectedAuditors.join(', ') : 'Все'],
              ['Департаменты', selectedDepartments.length ? selectedDepartments.join(', ') : 'Все'],
              ['Записей в выборке', String(filteredTotal)],
              ['Всего в системе', String(universeTotal)],
            ],
          },
          exportFormat,
        ),
      'Monitoring export failed',
    );
  };

  const handleAddToConstructor = () => {
    const added = addToConstructor(
      buildMonitoringConstructorDrafts({
        selectedSections: exportSections.selectedSections,
        filterCaption: buildConstructorFilterCaption({
          periodSliceLabel,
          periods: activePeriodValues,
          auditors: selectedAuditors,
          departments: selectedDepartments,
        }),
        summary,
        coloredStatusDistribution,
        coloredAdditionalStatusDistribution,
        deadlineExtensionsByCheck,
        deadlineExtensionColors,
        deadlineExtensionShortNames: Object.fromEntries(deadlineExtensionShortNames),
        completedDuringAuditByCheck,
        completedDuringAuditColors,
        completedDuringAuditShortNames: Object.fromEntries(completedDuringAuditShortNames),
        statusMatrix,
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
          <ChartCard title="Итого по мониторингу" description="" dense exportSectionId="summary" exportSelected={exportSections.isSelected('summary')} onToggleExport={() => exportSections.toggleSection('summary')}>
            <div className="grid w-full grid-cols-2 gap-1 lg:grid-cols-5">
              <KpiCard
                label="Исполнено"
                value={summary.byStatus.completed}
                accentColor={MONITORING_STATUS_COLORS.completed}
              />
              <KpiCard
                label="В работе"
                value={summary.byStatus.in_progress}
                accentColor={MONITORING_STATUS_COLORS.in_progress}
              />
              <KpiCard
                label="На контроле"
                value={summary.byStatus.on_control}
                tone="slate"
              />
              <KpiCard
                label="Срок нарушен"
                value={summary.byAdditional.deadline_violated}
                accentColor={MONITORING_ADDITIONAL_STATUS_COLORS.deadline_violated}
              />
              <KpiCard
                label="Доля просроченных"
                value={summary.violationRate}
                suffix="%"
                accentColor={MONITORING_ADDITIONAL_STATUS_COLORS.deadline_violated}
              />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'statuses',
        defaultLayout: { x: 4, y: 5, w: 8, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Статусы рекомендаций за период"
            description=""
            exportSectionId="statuses"
            exportSelected={exportSections.isSelected('statuses')}
            onToggleExport={() => exportSections.toggleSection('statuses')}
          >
            {distributionHasValues(coloredStatusDistribution) ? (
              <FocusableSquareCirclesChart
                data={coloredStatusDistribution}
                labelMode="both"
                legendLayout="row"
              />
            ) : (
              <EmptyChart message="Нет данных" />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'additionalStatuses',
        defaultLayout: { x: 9, y: 2, w: 3, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Дополнительные статусы за период"
            description=""
            exportSectionId="additionalStatuses"
            exportSelected={exportSections.isSelected('additionalStatuses')}
            onToggleExport={() => exportSections.toggleSection('additionalStatuses')}
          >
            {distributionHasValues(coloredAdditionalStatusDistribution) ? (
              <FocusableDonutChart
                data={coloredAdditionalStatusDistribution}
                variant="ring"
                labelMode="both"
                legendPercentFirst
              />
            ) : (
              <EmptyChart message="Нет данных" />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'deadlineExtensions',
        defaultLayout: { x: 0, y: 2, w: 9, h: 3, minW: 4, minH: 3 },
        render: () => (
          <ChartCard
            title="Переносы срока по проверкам"
            description=""
            exportSectionId="deadlineExtensions"
            exportSelected={exportSections.isSelected('deadlineExtensions')}
            onToggleExport={() => exportSections.toggleSection('deadlineExtensions')}
          >
            {deadlineExtensionsByCheck.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[14rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={deadlineExtensionsByCheck}
                    margin={{ top: 22, right: 16, left: -10, bottom: 28 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="key"
                      interval={0}
                      height={36}
                      tick={(props) => (
                        <CheckKeyAxisTick {...props} shortNameByKey={deadlineExtensionShortNames} />
                      )}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(value) => [value, 'Переносов']}
                      labelFormatter={(label) => checkBarTooltipLabel(label, deadlineExtensionShortNames)}
                    />
                    <Bar dataKey="value" name="Переносов" fill={lastScaleColor(MONITORING_BAR_BLUE_SCALE)} radius={[4, 4, 0, 0]}>
                      {deadlineExtensionsByCheck.map((item, index) => (
                        <Cell key={item.id} fill={deadlineExtensionColors[index]} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="top"
                        fontSize={CHART_VALUE_LABEL_SIZE}
                        fontWeight={CHART_VALUE_LABEL_WEIGHT}
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
        id: 'completedDuringAudit',
        defaultLayout: { x: 0, y: 5, w: 4, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Исполнено в ходе аудита по проверкам"
            description=""
            exportSectionId="completedDuringAudit"
            exportSelected={exportSections.isSelected('completedDuringAudit')}
            onToggleExport={() => exportSections.toggleSection('completedDuringAudit')}
          >
            {completedDuringAuditByCheck.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={completedDuringAuditByCheck}
                    layout="vertical"
                    margin={{ top: 8, right: 40, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <YAxis
                      dataKey="key"
                      type="category"
                      width={88}
                      interval={0}
                      tick={(props) => (
                        <CheckKeyAxisTick {...props} orientation="left" shortNameByKey={completedDuringAuditShortNames} />
                      )}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(value) => [value, 'Рекомендаций']}
                      labelFormatter={(label) => checkBarTooltipLabel(label, completedDuringAuditShortNames)}
                    />
                    <Bar dataKey="value" name="Рекомендаций" fill={lastScaleColor(MONITORING_BAR_BLUE_SCALE)} radius={[0, 6, 6, 0]}>
                      {completedDuringAuditByCheck.map((item, index) => (
                        <Cell key={item.id} fill={completedDuringAuditColors[index]} />
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
        id: 'statusMatrix',
        defaultLayout: { x: 0, y: 8, w: 12, h: 8, minW: 6, minH: 6 },
        expandToContent: true,
        render: () => (
          <ChartCard
            title="Матрица статусов по проверкам"
            description=""
            exportSectionId="statusMatrix"
            exportSelected={exportSections.isSelected('statusMatrix')}
            onToggleExport={() => exportSections.toggleSection('statusMatrix')}
            fitContent
          >
            {statusMatrix.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <StatusMatrixChart
                rows={statusMatrix}
                onSortConfigChange={handleStatusMatrixSortChange}
                scrollBody={false}
              />
            )}
          </ChartCard>
        ),
      },
    ],
    [
      coloredAdditionalStatusDistribution,
      coloredStatusDistribution,
      completedDuringAuditByCheck,
      completedDuringAuditColors,
      completedDuringAuditShortNames,
      deadlineExtensionColors,
      deadlineExtensionShortNames,
      deadlineExtensionsByCheck,
      exportSections,
      handleStatusMatrixSortChange,
      statusMatrix,
      summary,
    ],
  );

  return (
    <AnalyticsDashboardShell
      loadingTitle="Загрузка мониторинга…"
      errorTitle="Не удалось загрузить мониторинг"
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
      filterSidebar={toAnalyticsFilterSidebarProps(
        {
          periodSlice,
          handlePeriodSliceChange,
          yearOptions,
          quarterOptions,
          selectedYears,
          selectedQuarters,
          setSelectedYears,
          setSelectedQuarters,
          auditorOptions,
          selectedAuditors,
          setSelectedAuditors,
          departmentOptions,
          selectedDepartments,
          setSelectedDepartments,
          resetFilters,
          exportFormat,
          setExportFormat,
          isExporting,
        },
        {
          canExport: filteredTotal > 0,
          onExport: handleExport,
          selectedCount: exportSections.selectedCount,
          justAdded,
          onAddToConstructor: handleAddToConstructor,
        },
      )}
    >
      <AnalyticsDashboardGrid cards={cards} />
    </AnalyticsDashboardShell>
  );
}
