import { useMemo } from 'react';
import { fetchDvaAnalytics } from '../../api/analytics';
import { queryKeys } from '../../api/queryKeys';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsDashboardShell } from './AnalyticsDashboardShell';
import { ChartCard, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { AuditorStackedBarChart } from './AuditorStackedBarChart';
import { AuditorUnresolvedBarChart } from './AuditorUnresolvedBarChart';
import { CheckLifecycleChart } from './CheckLifecycleChart';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import {
  DVA_AUDITOR_CHECKS_SCALE,
  MONITORING_ADDITIONAL_STATUS_COLORS,
  MONITORING_STATUS_COLORS,
  RECOMMENDATIONS_MATERIALITY_CHART_COLORS,
} from './analyticsPalette';
import { EMPTY_RECOMMENDATION_SUMMARY } from './analyticsEmpty';
import { useAnalyticsDashboardController } from './useAnalyticsDashboardController';
import { exportGenericAnalyticsDashboard } from '../../utils/analyticsExport';
import { DVA_EXPORT_SECTIONS, type DvaExportSectionId } from '../../constants/analyticsExportSections';
import { useExportSections } from '../../hooks/useExportSections';
import { rankAuditorRows } from '../../utils/dvaAnalytics';
import { runAnalyticsExport } from '../../utils/runAnalyticsExport';
import { useAddToConstructor } from './constructor/useAddToConstructor';
import { buildDvaConstructorDrafts } from './constructor/buildConstructorWidgets';
import { buildConstructorFilterCaption } from './constructor/constructorFilterCaption';

const EMPTY_CHECK_SUMMARY = { total: 0, not_started: 0, in_progress: 0, completed: 0 };
const EMPTY_AUDITOR_CHECKS_MAP: never[] = [];
const EMPTY_AUDITOR_IMPACT: never[] = [];
const EMPTY_AUDITOR_EXECUTION: never[] = [];
const EMPTY_AUDITOR_TIMELINESS: never[] = [];
const EMPTY_AUDITOR_DOCUMENTS: never[] = [];
const EMPTY_CHECK_LIFECYCLE: never[] = [];

const IMPACT_SERIES = [
  { key: 'high', name: 'Высокий', color: RECOMMENDATIONS_MATERIALITY_CHART_COLORS.высокий },
  { key: 'medium', name: 'Средний', color: RECOMMENDATIONS_MATERIALITY_CHART_COLORS.средний },
  { key: 'low', name: 'Низкий', color: RECOMMENDATIONS_MATERIALITY_CHART_COLORS.низкий },
] as const;

const TIMELINESS_SERIES = [
  { key: 'on_time', name: 'В срок', color: MONITORING_ADDITIONAL_STATUS_COLORS.on_time },
  { key: 'on_control', name: 'На контроле', color: MONITORING_ADDITIONAL_STATUS_COLORS.on_control },
  { key: 'deadline_violated', name: 'Срок нарушен', color: MONITORING_ADDITIONAL_STATUS_COLORS.deadline_violated },
] as const;

export function DvaAnalyticsDashboard() {
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
    resource: 'dva',
    bootstrapQueryKey: queryKeys.analytics.dvaBootstrap,
    fetchBootstrap: () => fetchDvaAnalytics({ granularity: 'year' }),
    fetchFiltered: fetchDvaAnalytics,
  });

  const exportSections = useExportSections(DVA_EXPORT_SECTIONS.map((section) => section.id) as DvaExportSectionId[]);
  const { addToConstructor, justAdded } = useAddToConstructor();

  const checkSummary = data?.checkSummary ?? EMPTY_CHECK_SUMMARY;
  const recSummary = data?.recommendationSummary ?? EMPTY_RECOMMENDATION_SUMMARY;
  const auditorChecksMap = data?.auditorChecksTreemap ?? EMPTY_AUDITOR_CHECKS_MAP;
  const auditorImpact = useMemo(
    () =>
      rankAuditorRows(data?.auditorImpact ?? EMPTY_AUDITOR_IMPACT, (row) => row.high, {
        includeZeros: true,
      }),
    [data?.auditorImpact],
  );
  const auditorExecution = useMemo(
    () =>
      rankAuditorRows(data?.auditorExecution ?? EMPTY_AUDITOR_EXECUTION, (row) => row.unresolved),
    [data?.auditorExecution],
  );
  const auditorTimeliness = useMemo(
    () =>
      rankAuditorRows(data?.auditorTimeliness ?? EMPTY_AUDITOR_TIMELINESS, (row) => row.deadline_violated, {
        includeZeros: true,
      }),
    [data?.auditorTimeliness],
  );
  const auditorDocuments = data?.auditorDocuments ?? EMPTY_AUDITOR_DOCUMENTS;
  const checkLifecycle = data?.checkLifecycle ?? EMPTY_CHECK_LIFECYCLE;
  const filteredChecksTotal = data?.filteredChecksTotal ?? 0;
  const filteredRecommendationsTotal = data?.filteredRecommendationsTotal ?? 0;
  const universeChecksTotal = data?.universeChecksTotal ?? 0;
  const universeRecommendationsTotal = data?.universeRecommendationsTotal ?? 0;
  const highMateriality = recSummary.byMateriality.высокий;
  const employeeCount = new Set([
    ...(data?.auditorLoad ?? []).map((row) => row.name),
    ...auditorDocuments.map((row) => row.name),
  ]).size;

  const handleExport = async () => {
    if ((filteredChecksTotal === 0 && filteredRecommendationsTotal === 0) || isExporting) {
      return;
    }
    await runAnalyticsExport(
      setIsExporting,
      () =>
        exportGenericAnalyticsDashboard(
          {
            kind: 'dva',
            documentTitle: 'ДВА: управленческая аналитика',
            filenamePrefix: 'analytics-dva',
            selectedSections: [...exportSections.allIds],
            checkLifecycleOverride: checkLifecycle,
            meta: [
              ['Аудиторы', selectedAuditors.length ? selectedAuditors.join(', ') : 'Все'],
              ['Департаменты', selectedDepartments.length ? selectedDepartments.join(', ') : 'Все'],
              ['Проверок в выборке', String(filteredChecksTotal)],
              ['Рекомендаций в выборке', String(filteredRecommendationsTotal)],
            ],
          },
          exportFormat,
        ),
      'DVA export failed',
    );
  };

  const handleAddToConstructor = () => {
    const added = addToConstructor(
      buildDvaConstructorDrafts({
        selectedSections: exportSections.selectedSections,
        filterCaption: buildConstructorFilterCaption({
          periodSliceLabel,
          periods: activePeriodValues,
          auditors: selectedAuditors,
          departments: selectedDepartments,
        }),
        checkTotal: checkSummary.total,
        recTotal: recSummary.total,
        employeeCount,
        highMateriality,
        averageCheckDurationDays: data?.averageCheckDurationDays ?? 0,
        auditorChecksMap,
        auditorImpact,
        auditorExecution,
        auditorTimeliness,
        auditorDocuments,
        checkLifecycle,
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
          <ChartCard title="Итого по ДВА" description="" dense exportSectionId="summary" exportSelected={exportSections.isSelected('summary')} onToggleExport={() => exportSections.toggleSection('summary')}>
            <div className="grid w-full grid-cols-2 gap-1 lg:grid-cols-5">
              <KpiCard label="Проверки" value={checkSummary.total} tone="blue" />
              <KpiCard label="Рекомендации" value={recSummary.total} tone="slate" />
              <KpiCard
                label="Аудиторы"
                value={employeeCount}
                accentColor={MONITORING_STATUS_COLORS.completed}
              />
              <KpiCard
                label="Высокая существенность"
                value={highMateriality}
                accentColor={RECOMMENDATIONS_MATERIALITY_CHART_COLORS.высокий}
              />
              <KpiCard
                label={
                  <>
                    Средняя продолжительность
                    <br />
                    проверки
                  </>
                }
                value={data?.averageCheckDurationDays ?? 0}
                suffix=" дн."
                accentColor={MONITORING_STATUS_COLORS.in_progress}
              />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'auditorImpact',
        defaultLayout: { x: 0, y: 2, w: 6, h: 3, minW: 3, minH: 3 },
        render: () => (
          <ChartCard
            title="Количество рекомендаций по сотрудникам (существенность)"
            description=""
            exportSectionId="auditorImpact"
            exportSelected={exportSections.isSelected('auditorImpact')}
            onToggleExport={() => exportSections.toggleSection('auditorImpact')}
          >
            {auditorImpact.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <AuditorStackedBarChart data={auditorImpact} series={[...IMPACT_SERIES]} totalKey="total" />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'auditorTimeliness',
        defaultLayout: { x: 6, y: 2, w: 6, h: 3, minW: 3, minH: 3 },
        render: () => (
          <ChartCard
            title="Количество рекомендаций по сотрудникам (дополнительный статус)"
            description=""
            exportSectionId="auditorTimeliness"
            exportSelected={exportSections.isSelected('auditorTimeliness')}
            onToggleExport={() => exportSections.toggleSection('auditorTimeliness')}
          >
            {auditorTimeliness.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <AuditorStackedBarChart data={auditorTimeliness} series={[...TIMELINESS_SERIES]} totalKey="total" />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'auditorExecution',
        defaultLayout: { x: 0, y: 5, w: 4, h: 3, minW: 3, minH: 3 },
        render: () => (
          <ChartCard
            title='Количество и доля рекомендаций со статусом "Не решено"'
            description=""
            exportSectionId="auditorExecution"
            exportSelected={exportSections.isSelected('auditorExecution')}
            onToggleExport={() => exportSections.toggleSection('auditorExecution')}
          >
            {auditorExecution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <AuditorUnresolvedBarChart data={auditorExecution} />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'auditorChecksMap',
        defaultLayout: { x: 4, y: 5, w: 8, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Карта сотрудников по проверкам"
            description=""
            exportSectionId="auditorChecksMap"
            exportSelected={exportSections.isSelected('auditorChecksMap')}
            onToggleExport={() => exportSections.toggleSection('auditorChecksMap')}
          >
            {auditorChecksMap.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableTreemapChart
                data={auditorChecksMap}
                palette={DVA_AUDITOR_CHECKS_SCALE}
                colorByUniqueValue
              />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'checkLifecycle',
        defaultLayout: { x: 0, y: 8, w: 12, h: 8, minW: 6, minH: 6 },
        expandToContent: true,
        render: () => (
          <ChartCard
            title="Жизненный цикл проверки: от приказа до ДЗ"
            description=""
            exportSectionId="checkLifecycle"
            exportSelected={exportSections.isSelected('checkLifecycle')}
            onToggleExport={() => exportSections.toggleSection('checkLifecycle')}
            fitContent
          >
            {checkLifecycle.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <CheckLifecycleChart rows={checkLifecycle} />
            )}
          </ChartCard>
        ),
      },
    ],
    [
      auditorChecksMap,
      auditorExecution,
      auditorImpact,
      auditorTimeliness,
      checkLifecycle,
      checkSummary.total,
      data?.averageCheckDurationDays,
      employeeCount,
      exportSections,
      highMateriality,
      recSummary,
    ],
  );

  return (
    <AnalyticsDashboardShell
      loadingTitle="Загрузка аналитики ДВА…"
      errorTitle="Не удалось загрузить аналитику ДВА"
      bootstrapQuery={bootstrapQuery}
      analyticsQuery={analyticsQuery}
      data={data}
      selectionMetrics={[
        { label: 'Проверок', value: filteredChecksTotal, hint: `из ${universeChecksTotal}` },
        { label: 'Рекомендаций', value: filteredRecommendationsTotal, hint: `из ${universeRecommendationsTotal}` },
      ]}
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
        canExport: filteredChecksTotal > 0 || filteredRecommendationsTotal > 0,
        onExport: handleExport,
        onAddToConstructor: handleAddToConstructor,
        canAddToConstructor: exportSections.selectedCount > 0,
        addToConstructorCount: exportSections.selectedCount,
        constructorAdded: justAdded,
      }}
    >
      <AnalyticsDashboardGrid cards={cards} maxChartArea={440} />
    </AnalyticsDashboardShell>
  );
}
