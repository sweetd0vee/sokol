import { useMemo, useState } from 'react';
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
import type { Check } from '../../types/check';
import type { Recommendation } from '../../types/recommendation';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsFilterSidebar } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { ChartCard, CHART_AXIS_TICK, CHART_CATEGORY_AXIS_TICK, CHART_LEGEND_STYLE, CHART_VALUE_LABEL_SIZE, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import { AuditorPeriodHeatmap } from './AuditorPeriodHeatmap';
import { CHECKS_PALETTE, RECOMMENDATIONS_PALETTE } from './analyticsPalette';
import { exportGenericAnalyticsDashboard, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import { DVA_EXPORT_SECTIONS, type DvaExportSectionId } from '../../constants/analyticsExportSections';
import { useExportSections } from '../../hooks/useExportSections';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { parseDateValue } from '../../utils/dates';
import {
  buildAuditorDistribution as buildCheckAuditorDistribution,
  buildCompletionShare,
  buildDocumentReadiness,
  buildDvaAuditorPeriodMatrix,
  buildPeriodSeries as buildCheckPeriodSeries,
  collectAnalyticsAuditors,
  collectAuditObjects,
  filterChecksForAnalytics,
  summarizeChecks,
  type PeriodGranularity,
} from '../../utils/checkAnalytics';
import {
  buildAuditObjectDistribution,
  buildAuditorDistribution as buildRecommendationAuditorDistribution,
  buildPeriodSeries as buildRecommendationPeriodSeries,
  filterRecommendationsForAnalytics,
  summarizeRecommendations,
} from '../../utils/recommendationAnalytics';

type DvaAnalyticsDashboardProps = {
  checks: Check[];
  recommendations: Recommendation[];
};

export function DvaAnalyticsDashboard({ checks, recommendations }: DvaAnalyticsDashboardProps) {
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<AnalyticsExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  const exportSections = useExportSections(DVA_EXPORT_SECTIONS.map((section) => section.id) as DvaExportSectionId[]);
  const anchorDates = useMemo(
    () => [
      ...checks.map((check) => parseDateValue(check.start_date)),
      ...recommendations.map((item) => parseDateValue(item.deadline)),
      new Date(2025, 0, 1).getTime(),
      new Date(2026, 11, 1).getTime(),
    ],
    [checks, recommendations],
  );
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

  const auditorOptions = useMemo(
    () => toAnalyticsSelectOptions(collectAnalyticsAuditors(checks, recommendations)),
    [checks, recommendations],
  );
  const departmentOptions = useMemo(
    () => toAnalyticsSelectOptions(collectAuditObjects(recommendations)),
    [recommendations],
  );

  const filteredChecks = useMemo(
    () =>
      filterChecksForAnalytics(checks, {
        auditors: selectedAuditors,
        departments: selectedDepartments,
        recommendations,
        granularity: 'month',
        selectedPeriods: [],
        selectedYears: selectedYearKeys,
        selectedQuarters: selectedQuarterKeys,
        selectedMonths: selectedMonthKeys,
        effectivenessArea: 'any',
        selectedEffectivenessRatings: [],
      }),
    [checks, recommendations, selectedAuditors, selectedDepartments, selectedMonthKeys, selectedQuarterKeys, selectedYearKeys],
  );
  const filteredRecommendations = useMemo(
    () =>
      filterRecommendationsForAnalytics(recommendations, {
        dateFrom: null,
        dateTo: null,
        auditors: selectedAuditors,
        departments: selectedDepartments,
        materialityLevels: [],
        granularity: 'month',
        selectedPeriods: [],
        selectedYears: selectedYearKeys,
        selectedQuarters: selectedQuarterKeys,
        selectedMonths: selectedMonthKeys,
      }),
    [recommendations, selectedAuditors, selectedDepartments, selectedMonthKeys, selectedQuarterKeys, selectedYearKeys],
  );

  const granularity: PeriodGranularity = periodSlice;
  const checkSummary = useMemo(() => summarizeChecks(filteredChecks), [filteredChecks]);
  const recSummary = useMemo(() => summarizeRecommendations(filteredRecommendations), [filteredRecommendations]);
  const checkPeriods = useMemo(() => buildCheckPeriodSeries(filteredChecks, granularity), [filteredChecks, granularity]);
  const recPeriods = useMemo(() => buildRecommendationPeriodSeries(filteredRecommendations, granularity), [filteredRecommendations, granularity]);
  const portfolioSeries = useMemo(() => {
    const map = new Map<string, { key: string; label: string; sortKey: number; checks: number; recommendations: number }>();
    checkPeriods.forEach((item) => map.set(item.key, { key: item.key, label: item.label, sortKey: item.sortKey, checks: item.total, recommendations: 0 }));
    recPeriods.forEach((item) => {
      const current = map.get(item.key) ?? { key: item.key, label: item.label, sortKey: item.sortKey, checks: 0, recommendations: 0 };
      current.recommendations = item.total;
      map.set(item.key, current);
    });
    return [...map.values()].sort((a, b) => a.sortKey - b.sortKey);
  }, [checkPeriods, recPeriods]);
  const auditorLoad = useMemo(() => {
    const map = new Map<string, { checks: number; recommendations: number }>();

    buildCheckAuditorDistribution(filteredChecks).forEach((item) => {
      const current = map.get(item.name) ?? { checks: 0, recommendations: 0 };
      current.checks = item.value;
      map.set(item.name, current);
    });

    buildRecommendationAuditorDistribution(filteredRecommendations).forEach((item) => {
      const current = map.get(item.name) ?? { checks: 0, recommendations: 0 };
      current.recommendations = item.value;
      map.set(item.name, current);
    });

    return [...map.entries()]
      .map(([name, counts]) => ({
        name,
        checks: counts.checks,
        recommendations: counts.recommendations,
        value: counts.checks + counts.recommendations,
      }))
      .filter((item) => item.checks > 0 || item.recommendations > 0)
      .sort((a, b) => b.value - a.value);
  }, [filteredChecks, filteredRecommendations]);
  const auditorChecksTreemap = useMemo(
    () => buildCheckAuditorDistribution(filteredChecks).filter((item) => item.value > 0),
    [filteredChecks],
  );
  const auditorRecommendationsTreemap = useMemo(
    () => buildRecommendationAuditorDistribution(filteredRecommendations).filter((item) => item.value > 0),
    [filteredRecommendations],
  );
  const departmentMap = useMemo(() => buildAuditObjectDistribution(filteredRecommendations), [filteredRecommendations]);
  const documentReadiness = useMemo(() => buildDocumentReadiness(filteredChecks), [filteredChecks]);
  const auditorMatrix = useMemo(
    () => buildDvaAuditorPeriodMatrix(filteredChecks, filteredRecommendations, granularity),
    [filteredChecks, filteredRecommendations, granularity],
  );

  const resetFilters = () => {
    resetPeriodSelections();
    setSelectedAuditors([]);
    setSelectedDepartments([]);
  };

  const handleExport = async () => {
    if ((filteredChecks.length === 0 && filteredRecommendations.length === 0) || isExporting) {return;}
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
            ['Проверок в выборке', String(filteredChecks.length)],
            ['Рекомендаций в выборке', String(filteredRecommendations.length)],
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
          <ChartCard title="Сводка KPI" description="" dense exportSectionId="summary" exportSelected={exportSections.isSelected('summary')} onToggleExport={() => exportSections.toggleSection('summary')}>
            <div className="grid w-full grid-cols-2 gap-1 lg:grid-cols-6">
              <KpiCard label="Проверки" value={checkSummary.total} tone="blue" />
              <KpiCard label="Рекомендации" value={recSummary.total} tone="violet" />
              <KpiCard label="Аудиторы" value={auditorLoad.length} tone="slate" />
              <KpiCard label="Объекты аудита" value={departmentMap.length} tone="amber" />
              <KpiCard label="Завершённость" value={buildCompletionShare(filteredChecks)} suffix="%" tone="green" />
              <KpiCard label="Исполнение рек." value={recSummary.completionRate} suffix="%" tone="green" />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'portfolio',
        defaultLayout: { x: 0, y: 2, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard title="Портфель проверок и рекомендаций" description="Общий объём работ по срокам" exportSectionId="portfolio" exportSelected={exportSections.isSelected('portfolio')} onToggleExport={() => exportSections.toggleSection('portfolio')}>
            {portfolioSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={portfolioSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="label" tick={CHART_AXIS_TICK} /><YAxis allowDecimals={false} tick={CHART_AXIS_TICK} /><Tooltip /><Legend wrapperStyle={CHART_LEGEND_STYLE} /><Bar dataKey="recommendations" name="Рекомендации" fill="#A78BFA" radius={[4, 4, 0, 0]}><LabelList dataKey="recommendations" position="top" fontSize={CHART_VALUE_LABEL_SIZE} /></Bar><Line type="monotone" dataKey="checks" name="Проверки" stroke="#003366" strokeWidth={2.5} /></ComposedChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'auditorLoad',
        defaultLayout: { x: 6, y: 2, w: 6, h: 3, minW: 3, minH: 2 },
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
        id: 'auditorMatrix',
        defaultLayout: { x: 0, y: 5, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Матрица аудитор × срок"
            description="Число проверок (по дате начала) и рекомендаций (по сроку исполнения) на каждого аудитора в каждый период. Темнее ячейка — выше нагрузка."
            exportSectionId="auditorMatrix"
            exportSelected={exportSections.isSelected('auditorMatrix')}
            onToggleExport={() => exportSections.toggleSection('auditorMatrix')}
          >
            <AuditorPeriodHeatmap
              periods={auditorMatrix.periods}
              rows={auditorMatrix.rows.slice(0, 12)}
            />
          </ChartCard>
        ),
      },
      {
        id: 'documentsClosure',
        defaultLayout: { x: 6, y: 5, w: 6, h: 3, minW: 3, minH: 2 },
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
              <FocusableTreemapChart data={auditorChecksTreemap} palette={CHECKS_PALETTE} />
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
      auditorMatrix,
      portfolioSeries,
      recSummary,
      filteredChecks,
    ],
  );

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
        canExport={filteredChecks.length > 0 || filteredRecommendations.length > 0}
        onExport={handleExport}
        exportSelectedCount={exportSections.selectedCount}
        exportTotalCount={exportSections.totalCount}
        onSelectAllExport={exportSections.selectAll}
        onClearExport={exportSections.clearAll}
        selectionSummary={(
          <AnalyticsSelectionSummary
            metrics={[
            { label: 'Проверок', value: filteredChecks.length, hint: `из ${checks.length}` },
            { label: 'Рекомендаций', value: filteredRecommendations.length, hint: `из ${recommendations.length}` },
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
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AnalyticsDashboardGrid cards={cards} />
      </main>
    </div>
  );
}
