import { useCallback, useMemo, useState } from 'react';
import { fetchMonitoringAnalytics } from '../../api/analytics';
import { queryKeys } from '../../api/queryKeys';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import {
  ANALYTICS_DASHBOARD_MAIN_CLASS,
  AnalyticsDashboardShell,
} from './AnalyticsDashboardShell';
import { ChartCard, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import {
  applyValueBasedColors,
  MONITORING_ADDITIONAL_STATUS_COLORS,
  MONITORING_BAR_BLUE_SCALE,
  MONITORING_STATUS_COLORS,
} from './analyticsPalette';
import { EMPTY_RECOMMENDATION_SUMMARY } from './analyticsEmpty';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableSquareCirclesChart } from './FocusableSquareCirclesChart';
import { StatusMatrixChart } from './StatusMatrixChart';
import { MonitoringCheckKeyBarChart } from './MonitoringCheckKeyBarChart';
import { toAnalyticsFilterSidebarProps } from './analyticsFilterSidebarProps';
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
  const [statusMatrixSort, setStatusMatrixSort] = useState<StatusMatrixCountSortConfig>(
    DEFAULT_STATUS_MATRIX_COUNT_SORT,
  );
  const handleStatusMatrixSortChange = useCallback((sortConfig: StatusMatrixCountSortConfig) => {
    setStatusMatrixSort(sortConfig);
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
            statusMatrixOverride: sortStatusMatrixRows(statusMatrix, statusMatrixSort),
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
          <ChartCard title="Итого по мониторингу" description="" dense {...exportSections.sectionProps('summary')}>
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
            {...exportSections.sectionProps('statuses')}
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
            {...exportSections.sectionProps('additionalStatuses')}
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
            {...exportSections.sectionProps('deadlineExtensions')}
          >
            {deadlineExtensionsByCheck.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <MonitoringCheckKeyBarChart
                items={deadlineExtensionsByCheck}
                layout="horizontal"
                shortNameByKey={deadlineExtensionShortNames}
                colors={deadlineExtensionColors}
                seriesName="Переносов"
                minHeightClass="min-h-[14rem]"
                margin={{ top: 22, right: 16, left: -10, bottom: 28 }}
                barRadius={[4, 4, 0, 0]}
                labelPosition="top"
                labelOffset={8}
              />
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
            {...exportSections.sectionProps('completedDuringAudit')}
          >
            {completedDuringAuditByCheck.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <MonitoringCheckKeyBarChart
                items={completedDuringAuditByCheck}
                layout="vertical"
                shortNameByKey={completedDuringAuditShortNames}
                colors={completedDuringAuditColors}
                seriesName="Рекомендаций"
                minHeightClass="min-h-[13rem]"
                margin={{ top: 8, right: 40, left: 8, bottom: 0 }}
                barRadius={[0, 6, 6, 0]}
                labelPosition="right"
              />
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
            {...exportSections.sectionProps('statusMatrix')}
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
