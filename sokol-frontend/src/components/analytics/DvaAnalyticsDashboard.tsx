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
  Treemap,
  XAxis,
  YAxis,
} from 'recharts';
import type { Check } from '../../types/check';
import type { Recommendation } from '../../types/recommendation';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsFilterSidebar, type AnalyticsPeriodSlice } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { ChartCard, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import { PALETTE } from './analyticsPalette';
import { exportGenericAnalyticsDashboard, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import { DVA_EXPORT_SECTIONS, type DvaExportSectionId } from '../../constants/analyticsExportSections';
import { useExportSections } from '../../hooks/useExportSections';
import { collectCalendarPeriodOptions, getPeriodBucket } from '../../utils/analyticsPeriod';
import { parseDateValue } from '../../utils/dates';
import {
  buildAuditorDistribution as buildCheckAuditorDistribution,
  buildCompletionShare,
  buildDocumentReadiness,
  buildPeriodSeries as buildCheckPeriodSeries,
  collectAnalyticsAuditors,
  collectAuditObjects,
  filterChecksForAnalytics,
  summarizeChecks,
  type PeriodGranularity,
} from '../../utils/checkAnalytics';
import {
  buildAuditObjectDistribution,
  buildMaterialityDistribution,
  buildPeriodSeries as buildRecommendationPeriodSeries,
  filterRecommendationsForAnalytics,
  summarizeRecommendations,
} from '../../utils/recommendationAnalytics';

type DvaAnalyticsDashboardProps = {
  checks: Check[];
  recommendations: Recommendation[];
};

function toOptions(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

function periodKeys(anchorDates: Array<number | null>, granularity: PeriodGranularity, labels: string[]) {
  return collectCalendarPeriodOptions(anchorDates, granularity)
    .filter((item) => labels.includes(item.label))
    .map((item) => item.key);
}

function TreemapContent(props: { x?: number; y?: number; width?: number; height?: number; name?: string; value?: number; fill?: string }) {
  const { x = 0, y = 0, width = 0, height = 0, name = '', value = 0, fill = '#0E7490' } = props;
  if (width < 42 || height < 32) {return <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} />;}
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={8} />
      <text x={x + 8} y={y + 18} fill="#fff" fontSize={11} fontWeight={700}>{name.length > 20 ? `${name.slice(0, 18)}...` : name}</text>
      <text x={x + 8} y={y + 34} fill="#fff" fontSize={12}>{value}</text>
    </g>
  );
}

export function DvaAnalyticsDashboard({ checks, recommendations }: DvaAnalyticsDashboardProps) {
  const [periodSlice, setPeriodSlice] = useState<AnalyticsPeriodSlice>('year');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedQuarters, setSelectedQuarters] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
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
  const yearOptions = useMemo(() => toOptions(collectCalendarPeriodOptions(anchorDates, 'year').map((item) => item.label)), [anchorDates]);
  const quarterOptions = useMemo(() => toOptions(collectCalendarPeriodOptions(anchorDates, 'quarter').map((item) => item.label)), [anchorDates]);
  const monthOptions = useMemo(() => toOptions(collectCalendarPeriodOptions(anchorDates, 'month').map((item) => item.label)), [anchorDates]);
  const selectedYearKeys = useMemo(() => periodKeys(anchorDates, 'year', selectedYears), [anchorDates, selectedYears]);
  const selectedQuarterKeys = useMemo(() => periodKeys(anchorDates, 'quarter', selectedQuarters), [anchorDates, selectedQuarters]);
  const selectedMonthKeys = useMemo(() => periodKeys(anchorDates, 'month', selectedMonths), [anchorDates, selectedMonths]);
  const auditorOptions = useMemo(() => toOptions(collectAnalyticsAuditors(checks, recommendations)), [checks, recommendations]);
  const departmentOptions = useMemo(() => toOptions(collectAuditObjects(recommendations)), [recommendations]);

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
  const periodSliceLabel = periodSlice === 'month' ? 'Месяц' : periodSlice === 'quarter' ? 'Квартал' : 'Год';
  const activePeriodValues =
    periodSlice === 'month' ? selectedMonths : periodSlice === 'quarter' ? selectedQuarters : selectedYears;
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
    const map = new Map<string, number>();
    buildCheckAuditorDistribution(filteredChecks).forEach((item) => map.set(item.name, (map.get(item.name) ?? 0) + item.value));
    filteredRecommendations.forEach((item) => {
      const name = item.auditor.trim() || 'Без аудитора';
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredChecks, filteredRecommendations]);
  const departmentMap = useMemo(() => buildAuditObjectDistribution(filteredRecommendations), [filteredRecommendations]);
  const riskProfile = useMemo(() => buildMaterialityDistribution(filteredRecommendations), [filteredRecommendations]);
  const documentReadiness = useMemo(() => buildDocumentReadiness(filteredChecks), [filteredChecks]);
  const matrix = useMemo(() => {
    const periodLabels = collectCalendarPeriodOptions(anchorDates, granularity).slice(0, 8);
    return auditorLoad.slice(0, 8).map((auditor) => {
      const byPeriod: Record<string, number> = {};
      filteredChecks.forEach((check) => {
        if (check.check_leader !== auditor.name) {return;}
        const ms = parseDateValue(check.start_date);
        if (ms === null) {return;}
        const period = getPeriodBucket(ms, granularity);
        byPeriod[period.label] = (byPeriod[period.label] ?? 0) + 1;
      });
      return { auditor: auditor.name, total: auditor.value, byPeriod, periods: periodLabels };
    });
  }, [anchorDates, auditorLoad, filteredChecks, granularity]);

  const resetFilters = () => {
    setPeriodSlice('year');
    setSelectedYears([]);
    setSelectedQuarters([]);
    setSelectedMonths([]);
    setSelectedAuditors([]);
    setSelectedDepartments([]);
  };

  const handlePeriodSliceChange = (next: AnalyticsPeriodSlice) => {
    setPeriodSlice(next);
    setSelectedYears([]);
    setSelectedQuarters([]);
    setSelectedMonths([]);
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
        render: ({ resetCardLayout }) => (
          <ChartCard title="Сводка KPI" description="" dense exportSectionId="summary" exportSelected={exportSections.isSelected('summary')} onToggleExport={() => exportSections.toggleSection('summary')} onResetCardLayout={resetCardLayout}>
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
        defaultLayout: { x: 0, y: 2, w: 4, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard title="Портфель проверок и рекомендаций" description="Общий объём работ по срокам" exportSectionId="portfolio" exportSelected={exportSections.isSelected('portfolio')} onToggleExport={() => exportSections.toggleSection('portfolio')} onResetCardLayout={resetCardLayout}>
            {portfolioSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={portfolioSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="recommendations" name="Рекомендации" fill="#A78BFA" radius={[4, 4, 0, 0]}><LabelList dataKey="recommendations" position="top" fontSize={10} /></Bar><Line type="monotone" dataKey="checks" name="Проверки" stroke="#003366" strokeWidth={2.5} /></ComposedChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'auditorLoad',
        defaultLayout: { x: 4, y: 2, w: 4, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard title="Нагрузка аудиторов" description="Проверки + рекомендации" exportSectionId="auditorLoad" exportSelected={exportSections.isSelected('auditorLoad')} onToggleExport={() => exportSections.toggleSection('auditorLoad')} onResetCardLayout={resetCardLayout}>
            <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><BarChart data={auditorLoad.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 24, left: 30, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" name="Единицы нагрузки" fill="#1E40AF" radius={[0, 6, 6, 0]}><LabelList dataKey="value" position="right" fontSize={10} /></Bar></BarChart></ResponsiveContainer></div>
          </ChartCard>
        ),
      },
      {
        id: 'departmentMap',
        defaultLayout: { x: 8, y: 2, w: 4, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard title="Карта департаментов" description="Объекты аудита по объёму рекомендаций" exportSectionId="departmentMap" exportSelected={exportSections.isSelected('departmentMap')} onToggleExport={() => exportSections.toggleSection('departmentMap')} onResetCardLayout={resetCardLayout}>
            {departmentMap.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><Treemap data={departmentMap.map((item, index) => ({ ...item, fill: PALETTE[index % PALETTE.length] }))} dataKey="value" nameKey="name" content={<TreemapContent />} /></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'riskProfile',
        defaultLayout: { x: 0, y: 5, w: 4, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard title="Риск-профиль рекомендаций" description="Существенность портфеля" exportSectionId="riskProfile" exportSelected={exportSections.isSelected('riskProfile')} onToggleExport={() => exportSections.toggleSection('riskProfile')} onResetCardLayout={resetCardLayout}>
            {riskProfile.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableDonutChart data={riskProfile} />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'auditorMatrix',
        defaultLayout: { x: 4, y: 5, w: 4, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard title="Матрица аудитор × срок" description="Тепловая таблица нагрузки" exportSectionId="auditorMatrix" exportSelected={exportSections.isSelected('auditorMatrix')} onToggleExport={() => exportSections.toggleSection('auditorMatrix')} onResetCardLayout={resetCardLayout}>
            {matrix.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-full min-h-[13rem] overflow-auto rounded-lg border border-gray-100 text-xs dark:border-slate-700">
                <table className="min-w-full border-collapse">
                  <tbody>
                    {matrix.map((row) => (
                      <tr key={row.auditor} className="border-b border-gray-100 dark:border-slate-700">
                        <th className="sticky left-0 bg-white px-2 py-1.5 text-left font-medium text-gray-700 dark:bg-slate-800 dark:text-slate-200">{row.auditor}</th>
                        {row.periods.map((period) => {
                          const value = row.byPeriod[period.label] ?? 0;
                          return (
                            <td key={period.key} title={period.label} className="px-2 py-1.5 text-center text-white" style={{ backgroundColor: value ? PALETTE[Math.min(value, PALETTE.length - 1)] : '#E5E7EB' }}>
                              {value || ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'documentsClosure',
        defaultLayout: { x: 8, y: 5, w: 4, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard title="Документы и закрытие" description="Готовность документов проверок и закрытие рекомендаций" exportSectionId="documentsClosure" exportSelected={exportSections.isSelected('documentsClosure')} onToggleExport={() => exportSections.toggleSection('documentsClosure')} onResetCardLayout={resetCardLayout}>
            <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><BarChart data={[...documentReadiness, { name: 'Закрытие рек.', filled: recSummary.withCompletionDate, empty: Math.max(recSummary.total - recSummary.withCompletionDate, 0) }]} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="filled" name="Готово" stackId="docs" fill="#22C55E"><LabelList dataKey="filled" position="center" fontSize={10} fill="#fff" /></Bar><Bar dataKey="empty" name="Не готово" stackId="docs" fill="#CBD5E1"><LabelList dataKey="empty" position="center" fontSize={10} /></Bar></BarChart></ResponsiveContainer></div>
          </ChartCard>
        ),
      },
      {
        id: 'auditorTreemap',
        defaultLayout: { x: 0, y: 8, w: 12, h: 3, minW: 4, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard
            title="Tree Map аудиторов"
            description="Площадь блока показывает нагрузку аудитора (проверки + рекомендации)"
            exportSectionId="auditorTreemap"
            exportSelected={exportSections.isSelected('auditorTreemap')}
            onToggleExport={() => exportSections.toggleSection('auditorTreemap')}
            onResetCardLayout={resetCardLayout}
          >
            {auditorLoad.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableTreemapChart data={auditorLoad} />
            )}
          </ChartCard>
        ),
      },
    ],
    [auditorLoad, checkSummary.total, departmentMap, documentReadiness, exportSections, matrix, portfolioSeries, recSummary, riskProfile, filteredChecks],
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
                onRemove: (value) => {
                  if (periodSlice === 'month') {
                    setSelectedMonths((prev) => prev.filter((item) => item !== value));
                  } else if (periodSlice === 'quarter') {
                    setSelectedQuarters((prev) => prev.filter((item) => item !== value));
                  } else {
                    setSelectedYears((prev) => prev.filter((item) => item !== value));
                  }
                },
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
        <AnalyticsDashboardGrid storageKey="sokol.analytics.layout.dva" cards={cards} />
      </main>
    </div>
  );
}
