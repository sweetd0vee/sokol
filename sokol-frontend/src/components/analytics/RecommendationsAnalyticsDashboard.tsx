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
import type {
  MaterialityLevel,
  Recommendation,
  RecommendationAdditionalStatus,
  RecommendationStatus,
} from '../../types/recommendation';
import { MultiCheckboxSelect } from '../ui/MultiCheckboxSelect';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsFilterSidebar, type AnalyticsPeriodSlice } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { ChartCard, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import {
  RECOMMENDATIONS_CUMULATIVE_LINE_COLOR,
  RECOMMENDATIONS_MATERIALITY_COLORS,
  RECOMMENDATIONS_PALETTE,
} from './analyticsPalette';
import { exportRecommendationsDashboard, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import {
  RECOMMENDATION_EXPORT_SECTIONS,
  type RecommendationExportSectionId,
} from '../../constants/analyticsExportSections';
import {
  MATERIALITY_LEVEL_OPTIONS,
  RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS,
  RECOMMENDATION_STATUS_OPTIONS,
  getIndicatorLabel,
} from '../../constants/recommendations';
import { useExportSections } from '../../hooks/useExportSections';
import { collectCalendarPeriodOptions, periodKeysFromLabels } from '../../utils/analyticsPeriod';
import { parseDateValue } from '../../utils/dates';
import {
  buildMaterialityDistribution,
  buildPeriodSeries,
  buildAuditObjectDistribution,
  buildCheckLinkDistribution,
  buildCumulativeSeries,
  buildIndicatorDistribution,
  collectAuditObjects,
  collectRecommendationAuditors,
  filterRecommendationsForAnalytics,
  INDICATOR_COLORS,
  MATERIALITY_COLORS,
  STATUS_COLORS,
  summarizeRecommendations,
  type PeriodGranularity,
} from '../../utils/recommendationAnalytics';

type RecommendationsAnalyticsDashboardProps = {
  recommendations: Recommendation[];
};

function toOptions(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

function TreemapContent(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill = '#7C3AED' } = props;
  if (width <= 0 || height <= 0) {
    return null;
  }
  const rounded = width >= 42 && height >= 32;
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      stroke="#fff"
      strokeWidth={2}
      rx={rounded ? 8 : 0}
    />
  );
}

export function RecommendationsAnalyticsDashboard({ recommendations }: RecommendationsAnalyticsDashboardProps) {
  const [periodSlice, setPeriodSlice] = useState<AnalyticsPeriodSlice>('year');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedQuarters, setSelectedQuarters] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedMateriality, setSelectedMateriality] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedAdditionalStatuses, setSelectedAdditionalStatuses] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<AnalyticsExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  const exportSections = useExportSections(
    RECOMMENDATION_EXPORT_SECTIONS.map((section) => section.id) as RecommendationExportSectionId[],
  );

  const anchorDates = useMemo(
    () => [
      ...recommendations.map((item) => parseDateValue(item.deadline)),
      new Date(2025, 0, 1).getTime(),
      new Date(2026, 11, 1).getTime(),
    ],
    [recommendations],
  );
  const yearOptions = useMemo(() => toOptions(collectCalendarPeriodOptions(anchorDates, 'year').map((item) => item.label)), [anchorDates]);
  const quarterOptions = useMemo(() => toOptions(collectCalendarPeriodOptions(anchorDates, 'quarter').map((item) => item.label)), [anchorDates]);
  const monthOptions = useMemo(() => toOptions(collectCalendarPeriodOptions(anchorDates, 'month').map((item) => item.label)), [anchorDates]);
  const auditorOptions = useMemo(() => toOptions(collectRecommendationAuditors(recommendations)), [recommendations]);
  const departmentOptions = useMemo(() => toOptions(collectAuditObjects(recommendations)), [recommendations]);

  const selectedYearKeys = useMemo(() => periodKeysFromLabels(anchorDates, 'year', selectedYears), [anchorDates, selectedYears]);
  const selectedQuarterKeys = useMemo(() => periodKeysFromLabels(anchorDates, 'quarter', selectedQuarters), [anchorDates, selectedQuarters]);
  const selectedMonthKeys = useMemo(() => periodKeysFromLabels(anchorDates, 'month', selectedMonths), [anchorDates, selectedMonths]);

  const filtered = useMemo(
    () =>
      filterRecommendationsForAnalytics(recommendations, {
        dateFrom: null,
        dateTo: null,
        auditors: selectedAuditors,
        departments: selectedDepartments,
        statuses: selectedStatuses as RecommendationStatus[],
        additionalStatuses: selectedAdditionalStatuses as RecommendationAdditionalStatus[],
        materialityLevels: selectedMateriality as MaterialityLevel[],
        granularity: 'month',
        selectedPeriods: [],
        selectedYears: selectedYearKeys,
        selectedQuarters: selectedQuarterKeys,
        selectedMonths: selectedMonthKeys,
      }),
    [
      recommendations,
      selectedAdditionalStatuses,
      selectedAuditors,
      selectedDepartments,
      selectedMateriality,
      selectedMonthKeys,
      selectedQuarterKeys,
      selectedStatuses,
      selectedYearKeys,
    ],
  );

  const granularity: PeriodGranularity = periodSlice;
  const periodSliceLabel = periodSlice === 'month' ? 'Месяц' : periodSlice === 'quarter' ? 'Квартал' : 'Год';
  const activePeriodValues =
    periodSlice === 'month' ? selectedMonths : periodSlice === 'quarter' ? selectedQuarters : selectedYears;
  const summary = useMemo(() => summarizeRecommendations(filtered), [filtered]);
  const periodSeries = useMemo(() => buildPeriodSeries(filtered, granularity), [filtered, granularity]);
  const cumulativeSeries = useMemo(() => buildCumulativeSeries(filtered, granularity), [filtered, granularity]);
  const materialityDistribution = useMemo(
    () =>
      buildMaterialityDistribution(filtered).map((item) => {
        const level = MATERIALITY_LEVEL_OPTIONS.find((option) => option.label === item.name)?.value;
        return {
          ...item,
          color: level ? RECOMMENDATIONS_MATERIALITY_COLORS[level] : RECOMMENDATIONS_PALETTE[0],
        };
      }),
    [filtered],
  );
  const indicatorDistribution = useMemo(
    () =>
      buildIndicatorDistribution(filtered).map((item) => {
        const indicator = (Object.keys(INDICATOR_COLORS) as Array<
          keyof typeof INDICATOR_COLORS
        >).find((key) => getIndicatorLabel(key) === item.name);
        return {
          ...item,
          color: indicator
            ? INDICATOR_COLORS[indicator]
            : RECOMMENDATIONS_PALETTE[2],
        };
      }),
    [filtered],
  );
  const objectDistribution = useMemo(() => buildAuditObjectDistribution(filtered), [filtered]);
  const checkLinks = useMemo(() => buildCheckLinkDistribution(filtered), [filtered]);

  const resetFilters = () => {
    setPeriodSlice('year');
    setSelectedYears([]);
    setSelectedQuarters([]);
    setSelectedMonths([]);
    setSelectedAuditors([]);
    setSelectedDepartments([]);
    setSelectedMateriality([]);
    setSelectedStatuses([]);
    setSelectedAdditionalStatuses([]);
  };

  const handlePeriodSliceChange = (next: AnalyticsPeriodSlice) => {
    setPeriodSlice(next);
    setSelectedYears([]);
    setSelectedQuarters([]);
    setSelectedMonths([]);
  };

  const handleExport = async () => {
    if (filtered.length === 0 || isExporting) {return;}
    if (exportSections.selectedSections.length === 0) {
      window.alert('Выберите хотя бы один дашборд для экспорта');
      return;
    }
    setIsExporting(true);
    try {
      await exportRecommendationsDashboard(
        {
          recommendations,
          filteredRecommendations: filtered,
          granularity,
          dateFrom: null,
          dateTo: null,
          auditors: selectedAuditors,
          departments: selectedDepartments,
          materialityLevels: selectedMateriality as MaterialityLevel[],
          selectedSections: exportSections.selectedSections,
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
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard
            title="Сводка KPI"
            description=""
            dense
            exportSectionId="summary"
            exportSelected={exportSections.isSelected('summary')}
            onToggleExport={() => exportSections.toggleSection('summary')}
            onResetCardLayout={resetCardLayout}
          >
            <div className="grid w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard label="Всего" value={summary.total} hint={`из ${recommendations.length}`} tone="violet" />
              <KpiCard label="Исполнено" value={summary.byStatus.completed} tone="green" />
              <KpiCard label="Не решено" value={summary.byStatus.unresolved} tone="slate" />
              <KpiCard label="Высокая существенность" value={summary.byMateriality.высокий} tone="amber" />
              <KpiCard label="Исполнение" value={summary.completionRate} suffix="%" tone="blue" />
              <KpiCard label="Нарушение срока" value={summary.violationRate} suffix="%" tone="red" />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'cumulative',
        defaultLayout: { x: 0, y: 2, w: 6, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard
            title="Количество рекомендаций"
            description="Динамика и накопительный итог"
            exportSectionId="cumulative"
            exportSelected={exportSections.isSelected('cumulative')}
            onToggleExport={() => exportSections.toggleSection('cumulative')}
            onResetCardLayout={resetCardLayout}
          >
            {cumulativeSeries.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cumulativeSeries} margin={{ top: 22, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={{ fontSize: 13 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 13 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Bar dataKey="total" name="За период" fill={RECOMMENDATIONS_PALETTE[5]} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="total" position="top" fontSize={12} />
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      name="Всего"
                      stroke={RECOMMENDATIONS_CUMULATIVE_LINE_COLOR}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: RECOMMENDATIONS_CUMULATIVE_LINE_COLOR }}
                    >
                      <LabelList
                        dataKey="cumulative"
                        position="top"
                        fontSize={12}
                        fill={RECOMMENDATIONS_CUMULATIVE_LINE_COLOR}
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
        id: 'statusByPeriod',
        defaultLayout: { x: 6, y: 2, w: 6, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard
            title="Статусы по периодам"
            description="Распределение статусов внутри периода"
            exportSectionId="statusByPeriod"
            exportSelected={exportSections.isSelected('statusByPeriod')}
            onToggleExport={() => exportSections.toggleSection('statusByPeriod')}
            onResetCardLayout={resetCardLayout}
          >
            {periodSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><BarChart data={periodSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="label" tick={{ fontSize: 13 }} /><YAxis allowDecimals={false} tick={{ fontSize: 13 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 13 }} />{RECOMMENDATION_STATUS_OPTIONS.map((status) => <Bar key={status.value} dataKey={status.value} name={status.label} stackId="status" fill={STATUS_COLORS[status.value]} />)}</BarChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'materialityByPeriod',
        defaultLayout: { x: 0, y: 5, w: 6, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard
            title="Существенность по периодам"
            description="Распределение уровней существенности внутри периода"
            exportSectionId="materialityByPeriod"
            exportSelected={exportSections.isSelected('materialityByPeriod')}
            onToggleExport={() => exportSections.toggleSection('materialityByPeriod')}
            onResetCardLayout={resetCardLayout}
          >
            {periodSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><BarChart data={periodSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="label" tick={{ fontSize: 13 }} /><YAxis allowDecimals={false} tick={{ fontSize: 13 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 13 }} /><Bar dataKey="low" name="Низкий" stackId="mat" fill={MATERIALITY_COLORS.низкий} /><Bar dataKey="medium" name="Средний" stackId="mat" fill={MATERIALITY_COLORS.средний} /><Bar dataKey="high" name="Высокий" stackId="mat" fill={MATERIALITY_COLORS.высокий} /></BarChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'materiality',
        defaultLayout: { x: 6, y: 5, w: 6, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard
            title="Существенность"
            description="Распределение уровней существенности за период"
            exportSectionId="materiality"
            exportSelected={exportSections.isSelected('materiality')}
            onToggleExport={() => exportSections.toggleSection('materiality')}
            onResetCardLayout={resetCardLayout}
          >
            {materialityDistribution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableDonutChart
                data={materialityDistribution}
                palette={RECOMMENDATIONS_PALETTE}
                showPercentInLabel
              />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'indicators',
        defaultLayout: { x: 0, y: 8, w: 4, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard
            title="Индикаторы"
            description="Распределение выбранной выборки"
            exportSectionId="indicators"
            exportSelected={exportSections.isSelected('indicators')}
            onToggleExport={() => exportSections.toggleSection('indicators')}
            onResetCardLayout={resetCardLayout}
          >
            {indicatorDistribution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableDonutChart data={indicatorDistribution} palette={RECOMMENDATIONS_PALETTE} showPercentInLabel />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'objects',
        defaultLayout: { x: 4, y: 8, w: 4, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard title="Объекты аудита" description="Департаменты по количеству рекомендаций" exportSectionId="objects" exportSelected={exportSections.isSelected('objects')} onToggleExport={() => exportSections.toggleSection('objects')} onResetCardLayout={resetCardLayout}>
            {objectDistribution.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><Treemap data={objectDistribution.map((item, index) => ({ ...item, fill: RECOMMENDATIONS_PALETTE[index % RECOMMENDATIONS_PALETTE.length] }))} dataKey="value" nameKey="name" content={<TreemapContent />}><Tooltip /></Treemap></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'checkLinks',
        defaultLayout: { x: 8, y: 8, w: 4, h: 3, minW: 4, minH: 2 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard title="По проверкам" description="Количество рекомендаций на ключ проверки" exportSectionId="checkLinks" exportSelected={exportSections.isSelected('checkLinks')} onToggleExport={() => exportSections.toggleSection('checkLinks')} onResetCardLayout={resetCardLayout}>
            <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><BarChart data={checkLinks.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 24, left: 30, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 13 }} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="value" name="Рекомендации" fill={RECOMMENDATIONS_PALETTE[6]} radius={[0, 6, 6, 0]}><LabelList dataKey="value" position="right" fontSize={12} /></Bar></BarChart></ResponsiveContainer></div>
          </ChartCard>
        ),
      },
    ],
    [
      checkLinks,
      cumulativeSeries,
      exportSections,
      indicatorDistribution,
      materialityDistribution,
      objectDistribution,
      periodSeries,
      recommendations.length,
      summary,
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
        canExport={filtered.length > 0}
        onExport={handleExport}
        exportSelectedCount={exportSections.selectedCount}
        exportTotalCount={exportSections.totalCount}
        onSelectAllExport={exportSections.selectAll}
        onClearExport={exportSections.clearAll}
        selectionSummary={(
          <AnalyticsSelectionSummary
            metrics={[
            { label: 'Рекомендаций', value: filtered.length, hint: `из ${recommendations.length}` },
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
              {
                label: 'Существенность',
                chips: selectedMateriality.map((value) => ({
                  value,
                  label: MATERIALITY_LEVEL_OPTIONS.find((option) => option.value === value)?.label ?? value,
                })),
                emptyLabel: 'Все уровни',
                onRemove: (value) => setSelectedMateriality((prev) => prev.filter((item) => item !== value)),
              },
              {
                label: 'Статусы',
                chips: selectedStatuses.map((value) => ({
                  value,
                  label: RECOMMENDATION_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value,
                })),
                emptyLabel: 'Все статусы',
                onRemove: (value) => setSelectedStatuses((prev) => prev.filter((item) => item !== value)),
              },
              {
                label: 'Дополнительные статусы',
                chips: selectedAdditionalStatuses.map((value) => ({
                  value,
                  label:
                    RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value,
                })),
                emptyLabel: 'Все доп. статусы',
                onRemove: (value) => setSelectedAdditionalStatuses((prev) => prev.filter((item) => item !== value)),
              },
            ]}
          />
        )}
      >
        <div>
          <p className="mb-2 text-sm font-medium leading-relaxed text-gray-900 dark:text-slate-100">Контроль</p>
          <div className="space-y-2.5">
            <MultiCheckboxSelect options={MATERIALITY_LEVEL_OPTIONS} value={selectedMateriality} onChange={setSelectedMateriality} placeholder="Выберите уровень существенности" />
            <MultiCheckboxSelect options={RECOMMENDATION_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))} value={selectedStatuses} onChange={setSelectedStatuses} placeholder="Выберите статус" />
            <MultiCheckboxSelect options={RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))} value={selectedAdditionalStatuses} onChange={setSelectedAdditionalStatuses} placeholder="Выберите дополнительный статус" />
          </div>
        </div>
      </AnalyticsFilterSidebar>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AnalyticsDashboardGrid storageKey="sokol.analytics.layout.recommendations" cards={cards} />
      </main>
    </div>
  );
}
