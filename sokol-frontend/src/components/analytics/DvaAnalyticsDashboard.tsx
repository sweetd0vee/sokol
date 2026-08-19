import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { AnalyticsFilterSidebar } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { ChartCard, CHART_AXIS_TICK, CHART_CATEGORY_AXIS_TICK, CHART_LEGEND_STYLE, CHART_VALUE_LABEL_SIZE, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import { RECOMMENDATIONS_PALETTE, VALUE_BLUE_SCALE } from './analyticsPalette';
import { exportGenericAnalyticsDashboard, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import { DVA_EXPORT_SECTIONS, type DvaExportSectionId } from '../../constants/analyticsExportSections';
import { useExportSections } from '../../hooks/useExportSections';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { hasAnalyticsPeriodFilters, useAnalyticsAnchorDates } from '../../hooks/useAnalyticsAnchorDates';
import type { PeriodGranularity } from '../../utils/checkAnalytics';
import { ErrorState, LoadingState } from '../ui/StateMessage';

const EMPTY_CHECK_SUMMARY = { total: 0, not_started: 0, in_progress: 0, completed: 0 };
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
const EMPTY_AUDITOR_LOAD: never[] = [];
const EMPTY_AUDITOR_CHECKS_TREEMAP: never[] = [];
const EMPTY_AUDITOR_RECOMMENDATIONS_TREEMAP: never[] = [];
const EMPTY_DEPARTMENT_MAP: never[] = [];
const EMPTY_DOCUMENT_READINESS: never[] = [];

export function DvaAnalyticsDashboard() {
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<AnalyticsExportFormat>('html');
  const [isExporting, setIsExporting] = useState(false);

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
    setSelectedAuditors([]);
    setSelectedDepartments([]);
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
              <KpiCard label="Рекомендации" value={recSummary.total} tone="violet" />
              <KpiCard label="Аудиторы" value={auditorLoad.length} tone="slate" />
              <KpiCard label="Объекты аудита" value={departmentMap.length} tone="amber" />
              <KpiCard label="Завершённость" value={completionShare} suffix="%" tone="green" />
              <KpiCard label="Исполнение рек." value={recSummary.completionRate} suffix="%" tone="green" />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'auditorLoad',
        defaultLayout: { x: 0, y: 2, w: 12, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard title="Нагрузка аудиторов" description="Проверки и рекомендации по аудиторам за период" exportSectionId="auditorLoad" exportSelected={exportSections.isSelected('auditorLoad')} onToggleExport={() => exportSections.toggleSection('auditorLoad')}>
            {auditorLoad.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={auditorLoad.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 32, left: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <YAxis type="category" dataKey="name" width={120} tick={CHART_CATEGORY_AXIS_TICK} />
                    <Tooltip />
                    <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                    <Bar dataKey="checks" name="Проверки" fill="#003366" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="checks" position="right" fontSize={CHART_VALUE_LABEL_SIZE} />
                    </Bar>
                    <Bar dataKey="recommendations" name="Рекомендации" fill="#A78BFA" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="recommendations" position="right" fontSize={CHART_VALUE_LABEL_SIZE} />
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
            title="Tree Map аудиторов по количеству проверок"
            description="Площадь блока пропорциональна числу проверок аудитора за период"
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
            title="Tree Map аудиторов по количеству рекомендаций"
            description="Площадь блока пропорциональна числу рекомендаций аудитора за период"
            exportSectionId="auditorRecommendationsTreemap"
            exportSelected={exportSections.isSelected('auditorRecommendationsTreemap')}
            onToggleExport={() => exportSections.toggleSection('auditorRecommendationsTreemap')}
          >
            {auditorRecommendationsTreemap.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableTreemapChart data={auditorRecommendationsTreemap} palette={RECOMMENDATIONS_PALETTE} />
            )}
          </ChartCard>
        ),
      },
    ],
    [
      auditorChecksTreemap,
      auditorLoad,
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
        canExport={filteredChecksTotal > 0 || filteredRecommendationsTotal > 0}
        onExport={handleExport}
        exportSelectedCount={exportSections.selectedCount}
        exportTotalCount={exportSections.totalCount}
        onSelectAllExport={exportSections.selectAll}
        onClearExport={exportSections.clearAll}
        selectionSummary={(
          <AnalyticsSelectionSummary
            metrics={[
            { label: 'Проверок', value: filteredChecksTotal, hint:`из ${universeChecksTotal}` },
            { label: 'Рекомендаций', value: filteredRecommendationsTotal, hint:`из ${universeRecommendationsTotal}` },
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
      <main className="flex min-h-0 min-w-0 flex-1 flex-col lg:-mt-[84px]">
        <AnalyticsDashboardGrid cards={cards} />
      </main>
    </div>
  );
}
