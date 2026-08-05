import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
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
import { AnalyticsFilterSidebar } from './AnalyticsFilterSidebar';
import { ChartCard, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { PALETTE } from './analyticsPalette';
import { exportRecommendationsDashboard, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import {
  RECOMMENDATION_EXPORT_SECTIONS,
  type RecommendationExportSectionId,
} from '../../constants/analyticsExportSections';
import {
  MATERIALITY_LEVEL_OPTIONS,
  RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS,
  RECOMMENDATION_STATUS_OPTIONS,
} from '../../constants/recommendations';
import { useExportSections } from '../../hooks/useExportSections';
import { collectCalendarPeriodOptions } from '../../utils/analyticsPeriod';
import { parseDateValue } from '../../utils/dates';
import {
  MATERIALITY_COLORS,
  STATUS_COLORS,
  buildAdditionalStatusDistribution,
  buildAuditObjectDistribution,
  buildAuditorDistribution,
  buildCheckLinkDistribution,
  buildCumulativeSeries,
  buildDeadlineBuckets,
  buildFunnel,
  buildIndicatorDistribution,
  buildMaterialityDistribution,
  buildPeriodSeries,
  buildStatusDistribution,
  collectAuditObjects,
  collectRecommendationAuditors,
  filterRecommendationsForAnalytics,
  summarizeRecommendations,
  type PeriodGranularity,
} from '../../utils/recommendationAnalytics';

type RecommendationsAnalyticsDashboardProps = {
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

function TreemapContent(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name = '', value = 0, fill = '#7C3AED' } = props;
  if (width < 42 || height < 32) {
    return <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} />;
  }
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={8} />
      <text x={x + 8} y={y + 18} fill="#fff" fontSize={11} fontWeight={700}>
        {name.length > 20 ? `${name.slice(0, 18)}...` : name}
      </text>
      <text x={x + 8} y={y + 34} fill="#fff" fontSize={12}>
        {value}
      </text>
    </g>
  );
}

export function RecommendationsAnalyticsDashboard({ recommendations }: RecommendationsAnalyticsDashboardProps) {
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

  const selectedYearKeys = useMemo(() => periodKeys(anchorDates, 'year', selectedYears), [anchorDates, selectedYears]);
  const selectedQuarterKeys = useMemo(() => periodKeys(anchorDates, 'quarter', selectedQuarters), [anchorDates, selectedQuarters]);
  const selectedMonthKeys = useMemo(() => periodKeys(anchorDates, 'month', selectedMonths), [anchorDates, selectedMonths]);

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

  const granularity: PeriodGranularity =
    selectedMonths.length > 0 ? 'month' : selectedQuarters.length > 0 ? 'quarter' : 'year';
  const summary = useMemo(() => summarizeRecommendations(filtered), [filtered]);
  const periodSeries = useMemo(() => buildPeriodSeries(filtered, granularity), [filtered, granularity]);
  const cumulativeSeries = useMemo(() => buildCumulativeSeries(filtered, granularity), [filtered, granularity]);
  const statusDistribution = useMemo(() => buildStatusDistribution(filtered), [filtered]);
  const materialityDistribution = useMemo(() => buildMaterialityDistribution(filtered), [filtered]);
  const additionalStatusDistribution = useMemo(() => buildAdditionalStatusDistribution(filtered), [filtered]);
  const indicatorDistribution = useMemo(() => buildIndicatorDistribution(filtered), [filtered]);
  const deadlineBuckets = useMemo(() => buildDeadlineBuckets(filtered), [filtered]);
  const funnel = useMemo(() => buildFunnel(filtered), [filtered]);
  const auditorDistribution = useMemo(() => buildAuditorDistribution(filtered), [filtered]);
  const objectDistribution = useMemo(() => buildAuditObjectDistribution(filtered), [filtered]);
  const checkLinks = useMemo(() => buildCheckLinkDistribution(filtered), [filtered]);

  const resetFilters = () => {
    setSelectedYears([]);
    setSelectedQuarters([]);
    setSelectedMonths([]);
    setSelectedAuditors([]);
    setSelectedDepartments([]);
    setSelectedMateriality([]);
    setSelectedStatuses([]);
    setSelectedAdditionalStatuses([]);
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
          <ChartCard title="Сводка KPI" description="Контроль исполнения рекомендаций" exportSectionId="summary" exportSelected={exportSections.isSelected('summary')} onToggleExport={() => exportSections.toggleSection('summary')} onResetCardLayout={resetCardLayout}>
            <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-6">
              <KpiCard label="Всего" value={summary.total} hint={`из ${recommendations.length}`} tone="violet" />
              <KpiCard label="Исполнено" value={summary.byStatus.completed} tone="green" />
              <KpiCard label="Не решено" value={summary.byStatus.unresolved} tone="red" />
              <KpiCard label="Высокая сущ." value={summary.byMateriality.высокий} tone="amber" />
              <KpiCard label="Исполнение" value={summary.completionRate} suffix="%" tone="blue" />
              <KpiCard label="Нарушение срока" value={summary.violationRate} suffix="%" tone="red" />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'periods',
        defaultLayout: { x: 0, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard title="Динамика сроков" description="Рекомендации по срокам исполнения" exportSectionId="periods" exportSelected={exportSections.isSelected('periods')} onToggleExport={() => exportSections.toggleSection('periods')} onResetCardLayout={resetCardLayout}>
            {periodSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-40"><ResponsiveContainer width="100%" height="100%"><AreaChart data={periodSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="total" name="Рекомендации" stroke="#7C3AED" fill="#DDD6FE" strokeWidth={2}><LabelList dataKey="total" position="top" fontSize={10} /></Area></AreaChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'cumulative',
        defaultLayout: { x: 6, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard title="Накопление и исполнение" description="Всего и исполнено нарастающим итогом" exportSectionId="cumulative" exportSelected={exportSections.isSelected('cumulative')} onToggleExport={() => exportSections.toggleSection('cumulative')} onResetCardLayout={resetCardLayout}>
            {cumulativeSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-40"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={cumulativeSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="total" name="За срок" fill="#A78BFA" radius={[4, 4, 0, 0]} /><Line type="monotone" dataKey="cumulative" name="Накопительно" stroke="#4F46E5" strokeWidth={2.5} /><Line type="monotone" dataKey="cumulativeCompleted" name="Исполнено" stroke="#10B981" strokeWidth={2.5} /></ComposedChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'statusByPeriod',
        defaultLayout: { x: 0, y: 6, w: 8, h: 4, minW: 5, minH: 3 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard title="Статусы по периодам" description="Доли статусов внутри срока" exportSectionId="statusByPeriod" exportSelected={exportSections.isSelected('statusByPeriod')} onToggleExport={() => exportSections.toggleSection('statusByPeriod')} onResetCardLayout={resetCardLayout}>
            {periodSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-40"><ResponsiveContainer width="100%" height="100%"><BarChart data={periodSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />{RECOMMENDATION_STATUS_OPTIONS.map((status) => <Bar key={status.value} dataKey={status.value} name={status.label} stackId="status" fill={STATUS_COLORS[status.value]}><LabelList dataKey={status.value} position="center" fontSize={10} fill="#fff" /></Bar>)}</BarChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'materialityByPeriod',
        defaultLayout: { x: 8, y: 6, w: 4, h: 4, minW: 4, minH: 3 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard title="Существенность по периодам" description="Низкий, средний и высокий уровни" exportSectionId="materialityByPeriod" exportSelected={exportSections.isSelected('materialityByPeriod')} onToggleExport={() => exportSections.toggleSection('materialityByPeriod')} onResetCardLayout={resetCardLayout}>
            {periodSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-40"><ResponsiveContainer width="100%" height="100%"><BarChart data={periodSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="low" name="Низкий" stackId="mat" fill={MATERIALITY_COLORS.низкий} /><Bar dataKey="medium" name="Средний" stackId="mat" fill={MATERIALITY_COLORS.средний} /><Bar dataKey="high" name="Высокий" stackId="mat" fill={MATERIALITY_COLORS.высокий} /></BarChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      ...[
        ['materiality', 'Существенность', materialityDistribution],
        ['statuses', 'Статусы', statusDistribution],
        ['additionalStatuses', 'Срок исполнения', additionalStatusDistribution],
        ['indicators', 'Индикаторы', indicatorDistribution],
      ].map(([id, title, data], index) => ({
        id: id as string,
        defaultLayout: { x: (index % 2) * 6, y: 10 + Math.floor(index / 2) * 4, w: 6, h: 4, minW: 4, minH: 3 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard title={title as string} description="Распределение выбранной выборки" exportSectionId={id as string} exportSelected={exportSections.isSelected(id as RecommendationExportSectionId)} onToggleExport={() => exportSections.toggleSection(id as RecommendationExportSectionId)} onResetCardLayout={resetCardLayout}>
            {(data as Array<{ name: string; value: number; color?: string }>).length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-40"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data as Array<{ name: string; value: number; color?: string }>} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={46} outerRadius={78} label>{(data as Array<{ name: string; value: number; color?: string }>).map((entry, colorIndex) => <Cell key={entry.name} fill={entry.color ?? PALETTE[colorIndex % PALETTE.length]} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      })),
      {
        id: 'deadlines',
        defaultLayout: { x: 0, y: 18, w: 4, h: 4, minW: 4, minH: 3 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard title="Горизонт сроков" description="Ближайшие и дальние сроки исполнения" exportSectionId="deadlines" exportSelected={exportSections.isSelected('deadlines')} onToggleExport={() => exportSections.toggleSection('deadlines')} onResetCardLayout={resetCardLayout}>
            <div className="h-40"><ResponsiveContainer width="100%" height="100%"><BarChart data={deadlineBuckets} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" name="Рекомендации" fill="#F97316" radius={[4, 4, 0, 0]}><LabelList dataKey="value" position="top" fontSize={10} /></Bar></BarChart></ResponsiveContainer></div>
          </ChartCard>
        ),
      },
      {
        id: 'funnel',
        defaultLayout: { x: 4, y: 18, w: 4, h: 4, minW: 4, minH: 3 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard title="Воронка исполнения" description="Переход от общего портфеля к исполнению" exportSectionId="funnel" exportSelected={exportSections.isSelected('funnel')} onToggleExport={() => exportSections.toggleSection('funnel')} onResetCardLayout={resetCardLayout}>
            <div className="h-40"><ResponsiveContainer width="100%" height="100%"><FunnelChart><Tooltip /><Funnel dataKey="value" data={funnel} isAnimationActive fill="#4F46E5"><LabelList position="right" dataKey="name" fill="#334155" fontSize={11} /></Funnel></FunnelChart></ResponsiveContainer></div>
          </ChartCard>
        ),
      },
      {
        id: 'objects',
        defaultLayout: { x: 8, y: 18, w: 4, h: 4, minW: 4, minH: 3 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard title="Объекты аудита" description="Департаменты по количеству рекомендаций" exportSectionId="objects" exportSelected={exportSections.isSelected('objects')} onToggleExport={() => exportSections.toggleSection('objects')} onResetCardLayout={resetCardLayout}>
            {objectDistribution.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-40"><ResponsiveContainer width="100%" height="100%"><Treemap data={objectDistribution.map((item, index) => ({ ...item, fill: PALETTE[index % PALETTE.length] }))} dataKey="value" nameKey="name" content={<TreemapContent />} /></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'auditors',
        defaultLayout: { x: 0, y: 22, w: 6, h: 4, minW: 4, minH: 3 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard title="Нагрузка аудиторов" description="Топ аудиторов по рекомендациям" exportSectionId="auditors" exportSelected={exportSections.isSelected('auditors')} onToggleExport={() => exportSections.toggleSection('auditors')} onResetCardLayout={resetCardLayout}>
            <div className="h-40"><ResponsiveContainer width="100%" height="100%"><BarChart data={auditorDistribution.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 24, left: 30, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" name="Рекомендации" fill="#1D4ED8" radius={[0, 6, 6, 0]}><LabelList dataKey="value" position="right" fontSize={10} /></Bar></BarChart></ResponsiveContainer></div>
          </ChartCard>
        ),
      },
      {
        id: 'checkLinks',
        defaultLayout: { x: 6, y: 22, w: 6, h: 4, minW: 4, minH: 3 },
        render: ({ resetCardLayout }: { resetCardLayout: () => void }) => (
          <ChartCard title="По проверкам" description="Количество рекомендаций на ключ проверки" exportSectionId="checkLinks" exportSelected={exportSections.isSelected('checkLinks')} onToggleExport={() => exportSections.toggleSection('checkLinks')} onResetCardLayout={resetCardLayout}>
            <div className="h-40"><ResponsiveContainer width="100%" height="100%"><BarChart data={checkLinks.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 24, left: 30, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" name="Рекомендации" fill="#0369A1" radius={[0, 6, 6, 0]}><LabelList dataKey="value" position="right" fontSize={10} /></Bar></BarChart></ResponsiveContainer></div>
          </ChartCard>
        ),
      },
    ],
    [
      additionalStatusDistribution,
      auditorDistribution,
      checkLinks,
      cumulativeSeries,
      deadlineBuckets,
      exportSections,
      funnel,
      indicatorDistribution,
      materialityDistribution,
      objectDistribution,
      periodSeries,
      recommendations.length,
      statusDistribution,
      summary,
    ],
  );

  return (
    <div className="flex flex-col gap-4 text-left lg:flex-row lg:items-start">
      <AnalyticsFilterSidebar
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
      >
        <div>
          <p className="mb-2 text-sm font-medium leading-relaxed text-gray-900 dark:text-slate-100">Срезы</p>
          <div className="space-y-2.5">
            <MultiCheckboxSelect options={MATERIALITY_LEVEL_OPTIONS} value={selectedMateriality} onChange={setSelectedMateriality} placeholder="Все уровни существенности" />
            <MultiCheckboxSelect options={RECOMMENDATION_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))} value={selectedStatuses} onChange={setSelectedStatuses} placeholder="Все статусы" />
            <MultiCheckboxSelect options={RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))} value={selectedAdditionalStatuses} onChange={setSelectedAdditionalStatuses} placeholder="Все доп. статусы" />
          </div>
        </div>
      </AnalyticsFilterSidebar>

      <main className="min-w-0 flex-1">
        <AnalyticsDashboardGrid storageKey="sokol.analytics.layout.recommendations" cards={cards} />
      </main>
    </div>
  );
}
