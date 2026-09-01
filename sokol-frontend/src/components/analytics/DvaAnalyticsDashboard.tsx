import { useMemo } from 'react';
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
import { fetchDvaAnalytics } from '../../api/analytics';
import { queryKeys } from '../../api/queryKeys';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsDashboardFrame } from './AnalyticsDashboardFrame';
import { AnalyticsFilterSidebar } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary, filterSelectionItem } from './AnalyticsSelectionSummary';
import { ChartCard, CHART_AXIS_TICK, CHART_LEGEND_STYLE, CHART_VALUE_LABEL_SIZE, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import { CHECKS_PALETTE, getValueBasedColors, VALUE_BLUE_SCALE, VALUE_GRAY_SCALE } from './analyticsPalette';
import { EMPTY_RECOMMENDATION_SUMMARY } from './analyticsEmpty';
import { useAnalyticsDashboardSession } from './useAnalyticsDashboardSession';
import { exportGenericAnalyticsDashboard } from '../../utils/analyticsExport';
import { DVA_EXPORT_SECTIONS, type DvaExportSectionId } from '../../constants/analyticsExportSections';
import { useExportSections } from '../../hooks/useExportSections';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { hasAnalyticsPeriodFilters, useAnalyticsAnchorDates } from '../../hooks/useAnalyticsAnchorDates';
import type { PeriodGranularity } from '../../utils/checkAnalytics';
import { ErrorState, LoadingState } from '../ui/StateMessage';

const AUDITOR_LOAD_BAR_LIMIT = 10;

function topAuditorBars(
  rows: Array<{ name: string; checks: number; recommendations: number }>,
  metric: 'checks' | 'recommendations',
  limit = AUDITOR_LOAD_BAR_LIMIT,
) {
  return [...rows]
    .filter((row) => row[metric] > 0)
    .sort((left, right) => right[metric] - left[metric] || left.name.localeCompare(right.name, 'ru'))
    .slice(0, limit)
    .map((row) => ({ name: row.name, value: row[metric] }));
}

const EMPTY_CHECK_SUMMARY = { total: 0, not_started: 0, in_progress: 0, completed: 0 };
const EMPTY_AUDITOR_LOAD: never[] = [];
const EMPTY_AUDITOR_CHECKS_TREEMAP: never[] = [];
const EMPTY_AUDITOR_RECOMMENDATIONS_TREEMAP: never[] = [];
const EMPTY_DEPARTMENT_MAP: never[] = [];
const EMPTY_DOCUMENT_READINESS: never[] = [];

export function DvaAnalyticsDashboard() {
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

  const exportSections = useExportSections(DVA_EXPORT_SECTIONS.map((section) => section.id) as DvaExportSectionId[]);

  const bootstrapQuery = useQuery({
    queryKey: queryKeys.analytics.dvaBootstrap,
    queryFn: () => fetchDvaAnalytics({ granularity: 'year' }),
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
      'dva',
      granularity,
      selectedYearKeys,
      selectedQuarterKeys,
      selectedAuditors,
      selectedDepartments,
    ],
    queryFn: () =>
      fetchDvaAnalytics({
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

  const checkSummary = data?.checkSummary ?? EMPTY_CHECK_SUMMARY;
  const recSummary = data?.recommendationSummary ?? EMPTY_RECOMMENDATION_SUMMARY;
  const completionShare = data?.completionShare ?? 0;
  const auditorLoad = data?.auditorLoad ?? EMPTY_AUDITOR_LOAD;
  const auditorChecksBars = useMemo(
    () => topAuditorBars(auditorLoad, 'checks'),
    [auditorLoad],
  );
  const auditorRecommendationsBars = useMemo(
    () => topAuditorBars(auditorLoad, 'recommendations'),
    [auditorLoad],
  );
  const auditorChecksBarColors = useMemo(
    () => getValueBasedColors(auditorChecksBars.map((item) => item.value), VALUE_BLUE_SCALE),
    [auditorChecksBars],
  );
  const auditorRecommendationsBarColors = useMemo(
    () => getValueBasedColors(auditorRecommendationsBars.map((item) => item.value), VALUE_GRAY_SCALE),
    [auditorRecommendationsBars],
  );
  const auditorChecksTreemap = data?.auditorChecksTreemap ?? EMPTY_AUDITOR_CHECKS_TREEMAP;
  const auditorRecommendationsTreemap = data?.auditorRecommendationsTreemap ?? EMPTY_AUDITOR_RECOMMENDATIONS_TREEMAP;
  const departmentMap = data?.departmentMap ?? EMPTY_DEPARTMENT_MAP;
  const documentReadiness = data?.documentReadiness ?? EMPTY_DOCUMENT_READINESS;
  const filteredChecksTotal = data?.filteredChecksTotal ?? 0;
  const filteredRecommendationsTotal = data?.filteredRecommendationsTotal ?? 0;
  const universeChecksTotal = data?.universeChecksTotal ?? 0;
  const universeRecommendationsTotal = data?.universeRecommendationsTotal ?? 0;

  const resetFilters = () => {
    resetPeriodSelections();
    resetEntityFilters();
  };

  const handleExport = async () => {
    if ((filteredChecksTotal === 0 && filteredRecommendationsTotal === 0) || isExporting) {return;}
    if (exportSections.selectedSections.length === 0) {
      window.alert('Выберите хотя бы один дашборд для экспорта');
      return;
    }
    setIsExporting(true);
    try {
      await exportGenericAnalyticsDashboard(
        {
          kind: 'dva',
          documentTitle: 'ДВА: управленческая аналитика',
          filenamePrefix: 'analytics-dva',
          selectedSections: exportSections.selectedSections,
          meta: [
            ['Аудиторы', selectedAuditors.length ? selectedAuditors.join(', ') : 'Все'],
            ['Департаменты', selectedDepartments.length ? selectedDepartments.join(', ') : 'Все'],
            ['Проверок в выборке', String(filteredChecksTotal)],
            ['Рекомендаций в выборке', String(filteredRecommendationsTotal)],
          ],
        },
        exportFormat,
      );
    } catch (error) {
      console.error('DVA export failed', error);
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
          <ChartCard title="Итого" description="" dense exportSectionId="summary" exportSelected={exportSections.isSelected('summary')} onToggleExport={() => exportSections.toggleSection('summary')}>
            <div className="grid w-full grid-cols-2 gap-1 lg:grid-cols-6">
              <KpiCard label="Проверки" value={checkSummary.total} tone="blue" />
              <KpiCard label="Рекомендации" value={recSummary.total} tone="slate" />
              <KpiCard label="Аудиторы" value={auditorLoad.length} tone="slate" />
              <KpiCard label="Объекты аудита" value={departmentMap.length} tone="amber" />
              <KpiCard label="Завершённость" value={completionShare} suffix="%" tone="green" />
              <KpiCard label="Исполнение рекомендаций" value={recSummary.completionRate} suffix="%" tone="green" />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'auditorLoadChecks',
        defaultLayout: { x: 0, y: 2, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Нагрузка аудиторов: проверки"
            description="Количество проверок за период по аудиторам"
            exportSectionId="auditorLoadChecks"
            exportSelected={exportSections.isSelected('auditorLoadChecks')}
            onToggleExport={() => exportSections.toggleSection('auditorLoadChecks')}
          >
            {auditorChecksBars.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={auditorChecksBars} layout="vertical" margin={{ top: 8, right: 40, left: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <YAxis dataKey="name" type="category" width={120} tick={CHART_AXIS_TICK} />
                    <Tooltip />
                    <Bar dataKey="value" name="Проверки" fill="#003366" radius={[0, 6, 6, 0]}>
                      {auditorChecksBars.map((item, index) => (
                        <Cell key={item.name} fill={auditorChecksBarColors[index]} />
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
        id: 'auditorLoadRecommendations',
        defaultLayout: { x: 6, y: 2, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Нагрузка аудиторов: рекомендации"
            description="Количество рекомендаций за период по аудиторам"
            exportSectionId="auditorLoadRecommendations"
            exportSelected={exportSections.isSelected('auditorLoadRecommendations')}
            onToggleExport={() => exportSections.toggleSection('auditorLoadRecommendations')}
          >
            {auditorRecommendationsBars.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={auditorRecommendationsBars} layout="vertical" margin={{ top: 8, right: 40, left: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <YAxis dataKey="name" type="category" width={120} tick={CHART_AXIS_TICK} />
                    <Tooltip />
                    <Bar dataKey="value" name="Рекомендации" fill="#4B5563" radius={[0, 6, 6, 0]}>
                      {auditorRecommendationsBars.map((item, index) => (
                        <Cell key={item.name} fill={auditorRecommendationsBarColors[index]} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="right"
                        fontSize={CHART_VALUE_LABEL_SIZE}
                        fill="#1F2937"
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
        id: 'documentsClosure',
        defaultLayout: { x: 0, y: 5, w: 12, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard title="Документы и закрытие" description="Готовность документов проверок и закрытие рекомендаций" exportSectionId="documentsClosure" exportSelected={exportSections.isSelected('documentsClosure')} onToggleExport={() => exportSections.toggleSection('documentsClosure')}>
            <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><BarChart data={[...documentReadiness, { name: 'Закрытие рек.', filled: recSummary.withCompletionDate, empty: Math.max(recSummary.total - recSummary.withCompletionDate, 0) }]} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="name" tick={CHART_AXIS_TICK} /><YAxis allowDecimals={false} tick={CHART_AXIS_TICK} /><Tooltip /><Legend wrapperStyle={CHART_LEGEND_STYLE} /><Bar dataKey="filled" name="Готово" stackId="docs" fill="#22C55E"><LabelList dataKey="filled" position="center" fontSize={CHART_VALUE_LABEL_SIZE} fill="#fff" /></Bar><Bar dataKey="empty" name="Не готово" stackId="docs" fill="#CBD5E1"><LabelList dataKey="empty" position="center" fontSize={CHART_VALUE_LABEL_SIZE} /></Bar></BarChart></ResponsiveContainer></div>
          </ChartCard>
        ),
      },
      {
        id: 'auditorChecksTreemap',
        defaultLayout: { x: 0, y: 8, w: 6, h: 3, minW: 4, minH: 2 },
        render: () => (
          <ChartCard
            title="Карта аудиторов по количеству проверок"
            description="Количество проверок за период по аудиторам"
            exportSectionId="auditorChecksTreemap"
            exportSelected={exportSections.isSelected('auditorChecksTreemap')}
            onToggleExport={() => exportSections.toggleSection('auditorChecksTreemap')}
          >
            {auditorChecksTreemap.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableTreemapChart
                data={auditorChecksTreemap}
                palette={VALUE_BLUE_SCALE}
                colorByValue
              />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'auditorRecommendationsTreemap',
        defaultLayout: { x: 6, y: 8, w: 6, h: 3, minW: 4, minH: 2 },
        render: () => (
          <ChartCard
            title="Карта аудиторов по количеству рекомендаций"
            description="Количество рекомендаций за период по аудиторам"
            exportSectionId="auditorRecommendationsTreemap"
            exportSelected={exportSections.isSelected('auditorRecommendationsTreemap')}
            onToggleExport={() => exportSections.toggleSection('auditorRecommendationsTreemap')}
          >
            {auditorRecommendationsTreemap.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableTreemapChart data={auditorRecommendationsTreemap} palette={VALUE_GRAY_SCALE} colorByValue />
            )}
          </ChartCard>
        ),
      },
    ],
    [
      auditorChecksBarColors,
      auditorChecksBars,
      auditorChecksTreemap,
      auditorRecommendationsBarColors,
      auditorRecommendationsBars,
      auditorRecommendationsTreemap,
      checkSummary.total,
      departmentMap,
      documentReadiness,
      exportSections,
      recSummary,
      completionShare,
    ],
  );

  if (bootstrapQuery.isLoading && !data) {
    return <LoadingState title="Загрузка аналитики ДВА…" />;
  }
  if ((bootstrapQuery.isError || analyticsQuery.isError) && !data) {
    const error = analyticsQuery.error ?? bootstrapQuery.error;
    return (
      <ErrorState
        title="Не удалось загрузить аналитику ДВА"
        description={error instanceof Error ? error.message : 'неизвестная ошибка'}
      />
    );
  }

  return (
    <AnalyticsDashboardFrame
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
        canExport={filteredChecksTotal > 0 || filteredRecommendationsTotal > 0}
        onExport={handleExport}
        selectionSummary={(
          <AnalyticsSelectionSummary
            metrics={[
            { label: 'Проверок', value: filteredChecksTotal, hint:`из ${universeChecksTotal}` },
            { label: 'Рекомендаций', value: filteredRecommendationsTotal, hint:`из ${universeRecommendationsTotal}` },
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
