import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts';
import type { MaterialityLevel, Recommendation, RecommendationAdditionalStatus, RecommendationStatus } from '../../types/recommendation';
import { MultiCheckboxSelect } from '../ui/MultiCheckboxSelect';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsFilterSidebar, type AnalyticsPeriodSlice } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { ChartCard, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { PALETTE } from './analyticsPalette';
import { exportGenericAnalyticsDashboard, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import { MONITORING_EXPORT_SECTIONS, type MonitoringExportSectionId } from '../../constants/analyticsExportSections';
import { MATERIALITY_LEVEL_OPTIONS, RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS, RECOMMENDATION_STATUS_OPTIONS } from '../../constants/recommendations';
import { useExportSections } from '../../hooks/useExportSections';
import { collectCalendarPeriodOptions } from '../../utils/analyticsPeriod';
import { parseDateValue } from '../../utils/dates';
import {
  ADDITIONAL_STATUS_COLORS,
  STATUS_COLORS,
  buildAuditObjectDistribution,
  buildDeadlineBuckets,
  buildFunnel,
  buildPeriodSeries,
  buildTreemapData,
  collectAuditObjects,
  collectRecommendationAuditors,
  filterRecommendationsForAnalytics,
  summarizeRecommendations,
  type PeriodGranularity,
} from '../../utils/recommendationAnalytics';

type MonitoringAnalyticsDashboardProps = {
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
  const { x = 0, y = 0, width = 0, height = 0, name = '', value = 0, fill = '#EF4444' } = props;
  if (width < 42 || height < 32) {return <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} />;}
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={8} />
      <text x={x + 8} y={y + 18} fill="#fff" fontSize={11} fontWeight={700}>{name.length > 20 ? `${name.slice(0, 18)}...` : name}</text>
      <text x={x + 8} y={y + 34} fill="#fff" fontSize={12}>{value}</text>
    </g>
  );
}

export function MonitoringAnalyticsDashboard({ recommendations }: MonitoringAnalyticsDashboardProps) {
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
    MONITORING_EXPORT_SECTIONS.map((section) => section.id) as MonitoringExportSectionId[],
  );
  const anchorDates = useMemo(
    () => [...recommendations.map((item) => parseDateValue(item.deadline)), new Date(2025, 0, 1).getTime(), new Date(2026, 11, 1).getTime()],
    [recommendations],
  );
  const yearOptions = useMemo(() => toOptions(collectCalendarPeriodOptions(anchorDates, 'year').map((item) => item.label)), [anchorDates]);
  const quarterOptions = useMemo(() => toOptions(collectCalendarPeriodOptions(anchorDates, 'quarter').map((item) => item.label)), [anchorDates]);
  const monthOptions = useMemo(() => toOptions(collectCalendarPeriodOptions(anchorDates, 'month').map((item) => item.label)), [anchorDates]);
  const selectedYearKeys = useMemo(() => periodKeys(anchorDates, 'year', selectedYears), [anchorDates, selectedYears]);
  const selectedQuarterKeys = useMemo(() => periodKeys(anchorDates, 'quarter', selectedQuarters), [anchorDates, selectedQuarters]);
  const selectedMonthKeys = useMemo(() => periodKeys(anchorDates, 'month', selectedMonths), [anchorDates, selectedMonths]);
  const auditorOptions = useMemo(() => toOptions(collectRecommendationAuditors(recommendations)), [recommendations]);
  const departmentOptions = useMemo(() => toOptions(collectAuditObjects(recommendations)), [recommendations]);

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
    [recommendations, selectedAdditionalStatuses, selectedAuditors, selectedDepartments, selectedMateriality, selectedMonthKeys, selectedQuarterKeys, selectedStatuses, selectedYearKeys],
  );

  const granularity: PeriodGranularity = periodSlice;
  const periodSliceLabel = periodSlice === 'month' ? 'Месяц' : periodSlice === 'quarter' ? 'Квартал' : 'Год';
  const activePeriodValues =
    periodSlice === 'month' ? selectedMonths : periodSlice === 'quarter' ? selectedQuarters : selectedYears;
  const summary = useMemo(() => summarizeRecommendations(filtered), [filtered]);
  const periodSeries = useMemo(() => buildPeriodSeries(filtered, granularity), [filtered, granularity]);
  const deadlineBuckets = useMemo(() => buildDeadlineBuckets(filtered), [filtered]);
  const funnel = useMemo(() => buildFunnel(filtered), [filtered]);
  const objects = useMemo(() => buildAuditObjectDistribution(filtered), [filtered]);
  const problemObjects = useMemo(
    () =>
      buildTreemapData(
        filtered.filter((item) => item.additional_status === 'deadline_violated' || item.materiality_level === 'высокий'),
      ),
    [filtered],
  );

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
      await exportGenericAnalyticsDashboard(
        {
          kind: 'monitoring',
          documentTitle: 'Мониторинг рекомендаций',
          filenamePrefix: 'analytics-monitoring',
          selectedSections: exportSections.selectedSections,
          meta: [
            ['Аудиторы', selectedAuditors.length ? selectedAuditors.join(', ') : 'Все'],
            ['Департаменты', selectedDepartments.length ? selectedDepartments.join(', ') : 'Все'],
            ['Записей в выборке', String(filtered.length)],
            ['Всего в системе', String(recommendations.length)],
          ],
        },
        exportFormat,
      );
    } catch (error) {
      console.error('Monitoring export failed', error);
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
          <ChartCard title="Сводка KPI" description="Контроль сроков и исполнения" exportSectionId="summary" exportSelected={exportSections.isSelected('summary')} onToggleExport={() => exportSections.toggleSection('summary')} onResetCardLayout={resetCardLayout}>
            <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-5">
              <KpiCard label="На контроле" value={summary.byStatus.on_control} tone="slate" />
              <KpiCard label="Срок нарушен" value={summary.byAdditional.deadline_violated} tone="red" />
              <KpiCard label="Исполнено" value={summary.byStatus.completed} tone="green" />
              <KpiCard label="В работе" value={summary.byStatus.in_progress} tone="amber" />
              <KpiCard label="Просрочка" value={summary.violationRate} suffix="%" tone="red" />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'deadlineDynamics',
        defaultLayout: { x: 0, y: 2, w: 8, h: 4, minW: 5, minH: 3 },
        render: ({ resetCardLayout }) => (
          <ChartCard title="Динамика сроков исполнения" description="Статусы рекомендаций по срокам" exportSectionId="deadlineDynamics" exportSelected={exportSections.isSelected('deadlineDynamics')} onToggleExport={() => exportSections.toggleSection('deadlineDynamics')} onResetCardLayout={resetCardLayout}>
            {periodSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-40"><ResponsiveContainer width="100%" height="100%"><BarChart data={periodSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />{RECOMMENDATION_STATUS_OPTIONS.map((status) => <Bar key={status.value} dataKey={status.value} name={status.label} stackId="status" fill={STATUS_COLORS[status.value]}><LabelList dataKey={status.value} position="center" fontSize={10} fill="#fff" /></Bar>)}</BarChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'violationsByDepartment',
        defaultLayout: { x: 8, y: 2, w: 4, h: 4, minW: 4, minH: 3 },
        render: ({ resetCardLayout }) => (
          <ChartCard title="Просрочка по департаментам" description="Объекты аудита с нарушенными сроками" exportSectionId="violationsByDepartment" exportSelected={exportSections.isSelected('violationsByDepartment')} onToggleExport={() => exportSections.toggleSection('violationsByDepartment')} onResetCardLayout={resetCardLayout}>
            <div className="h-40"><ResponsiveContainer width="100%" height="100%"><BarChart data={objects.slice(0, 8)} layout="vertical" margin={{ top: 8, right: 24, left: 30, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" name="Рекомендации" fill={ADDITIONAL_STATUS_COLORS.deadline_violated} radius={[0, 6, 6, 0]}><LabelList dataKey="value" position="right" fontSize={10} /></Bar></BarChart></ResponsiveContainer></div>
          </ChartCard>
        ),
      },
      {
        id: 'deadlineBuckets',
        defaultLayout: { x: 0, y: 6, w: 4, h: 4, minW: 4, minH: 3 },
        render: ({ resetCardLayout }) => (
          <ChartCard title="Горизонт сроков" description="Ближайшие сроки и долгий хвост" exportSectionId="deadlineBuckets" exportSelected={exportSections.isSelected('deadlineBuckets')} onToggleExport={() => exportSections.toggleSection('deadlineBuckets')} onResetCardLayout={resetCardLayout}>
            <div className="h-40"><ResponsiveContainer width="100%" height="100%"><BarChart data={deadlineBuckets} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" name="Рекомендации" fill="#F97316" radius={[4, 4, 0, 0]}><LabelList dataKey="value" position="top" fontSize={10} /></Bar></BarChart></ResponsiveContainer></div>
          </ChartCard>
        ),
      },
      {
        id: 'funnel',
        defaultLayout: { x: 4, y: 6, w: 4, h: 4, minW: 4, minH: 3 },
        render: ({ resetCardLayout }) => (
          <ChartCard title="Воронка исполнения" description="От общего портфеля к закрытию" exportSectionId="funnel" exportSelected={exportSections.isSelected('funnel')} onToggleExport={() => exportSections.toggleSection('funnel')} onResetCardLayout={resetCardLayout}>
            <div className="h-40"><ResponsiveContainer width="100%" height="100%"><FunnelChart><Tooltip /><Funnel dataKey="value" data={funnel} fill="#4F46E5"><LabelList position="right" dataKey="name" fill="#334155" fontSize={11} /></Funnel></FunnelChart></ResponsiveContainer></div>
          </ChartCard>
        ),
      },
      {
        id: 'problemTreemap',
        defaultLayout: { x: 8, y: 6, w: 4, h: 4, minW: 4, minH: 3 },
        render: ({ resetCardLayout }) => (
          <ChartCard title="Tree Map проблемных объектов" description="Просроченные и высокосущественные рекомендации" exportSectionId="problemTreemap" exportSelected={exportSections.isSelected('problemTreemap')} onToggleExport={() => exportSections.toggleSection('problemTreemap')} onResetCardLayout={resetCardLayout}>
            {problemObjects.length === 0 ? <EmptyChart message="Нет проблемных объектов" /> : (
              <div className="h-40"><ResponsiveContainer width="100%" height="100%"><Treemap data={problemObjects.map((item, index) => ({ ...item, fill: PALETTE[(index + 5) % PALETTE.length] }))} dataKey="value" nameKey="name" content={<TreemapContent />} /></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
    ],
    [deadlineBuckets, exportSections, funnel, objects, periodSeries, problemObjects, summary],
  );

  return (
    <div className="flex flex-col gap-4 text-left lg:flex-row lg:items-start">
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
              { label: periodSliceLabel, values: activePeriodValues, emptyLabel: 'Все значения' },
              { label: 'Аудиторы', values: selectedAuditors, emptyLabel: 'Все аудиторы' },
              { label: 'Департаменты', values: selectedDepartments, emptyLabel: 'Все департаменты' },
              {
                label: 'Существенность',
                values: selectedMateriality.map(
                  (value) => MATERIALITY_LEVEL_OPTIONS.find((option) => option.value === value)?.label ?? value,
                ),
                emptyLabel: 'Все уровни',
              },
              {
                label: 'Статусы контроля',
                values: selectedStatuses.map(
                  (value) => RECOMMENDATION_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value,
                ),
                emptyLabel: 'Все статусы',
              },
              {
                label: 'Дополнительные статусы',
                values: selectedAdditionalStatuses.map(
                  (value) => RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value,
                ),
                emptyLabel: 'Все доп. статусы',
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

      <main className="min-w-0 flex-1">
        <AnalyticsDashboardGrid storageKey="sokol.analytics.layout.monitoring" cards={cards} />
      </main>
    </div>
  );
}
