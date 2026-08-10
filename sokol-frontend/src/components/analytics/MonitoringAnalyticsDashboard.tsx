import { useMemo, useState } from 'react';
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
import type { MaterialityLevel, Recommendation, RecommendationAdditionalStatus, RecommendationStatus } from '../../types/recommendation';
import { MultiCheckboxSelect } from '../ui/MultiCheckboxSelect';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsFilterSidebar, type AnalyticsPeriodSlice } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { ChartCard, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import { exportGenericAnalyticsDashboard, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import { MONITORING_EXPORT_SECTIONS, type MonitoringExportSectionId } from '../../constants/analyticsExportSections';
import { MATERIALITY_LEVEL_OPTIONS, RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS, RECOMMENDATION_STATUS_OPTIONS } from '../../constants/recommendations';
import { useExportSections } from '../../hooks/useExportSections';
import { collectCalendarPeriodOptions, periodKeysFromLabels } from '../../utils/analyticsPeriod';
import { parseDateValue } from '../../utils/dates';
import {
  STATUS_COLORS,
  buildAdditionalStatusDistribution,
  buildPeriodSeries,
  buildStatusDistribution,
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
  const selectedYearKeys = useMemo(() => periodKeysFromLabels(anchorDates, 'year', selectedYears), [anchorDates, selectedYears]);
  const selectedQuarterKeys = useMemo(() => periodKeysFromLabels(anchorDates, 'quarter', selectedQuarters), [anchorDates, selectedQuarters]);
  const selectedMonthKeys = useMemo(() => periodKeysFromLabels(anchorDates, 'month', selectedMonths), [anchorDates, selectedMonths]);
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
  const statusDistribution = useMemo(() => buildStatusDistribution(filtered), [filtered]);
  const additionalStatusDistribution = useMemo(() => buildAdditionalStatusDistribution(filtered), [filtered]);

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
          <ChartCard title="Сводка KPI" description="" dense exportSectionId="summary" exportSelected={exportSections.isSelected('summary')} onToggleExport={() => exportSections.toggleSection('summary')} onResetCardLayout={resetCardLayout}>
            <div className="grid w-full grid-cols-2 gap-1 lg:grid-cols-5">
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
        defaultLayout: { x: 0, y: 2, w: 12, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard title="Динамика сроков исполнения" description="Статусы рекомендаций по срокам" exportSectionId="deadlineDynamics" exportSelected={exportSections.isSelected('deadlineDynamics')} onToggleExport={() => exportSections.toggleSection('deadlineDynamics')} onResetCardLayout={resetCardLayout}>
            {periodSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><BarChart data={periodSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />{RECOMMENDATION_STATUS_OPTIONS.map((status) => <Bar key={status.value} dataKey={status.value} name={status.label} stackId="status" fill={STATUS_COLORS[status.value]}><LabelList dataKey={status.value} position="center" fontSize={10} fill="#fff" /></Bar>)}</BarChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'statuses',
        defaultLayout: { x: 0, y: 5, w: 4, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard
            title="Статусы"
            description="Распределение статусов за период"
            exportSectionId="statuses"
            exportSelected={exportSections.isSelected('statuses')}
            onToggleExport={() => exportSections.toggleSection('statuses')}
            onResetCardLayout={resetCardLayout}
          >
            {statusDistribution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableDonutChart data={statusDistribution} />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'additionalStatuses',
        defaultLayout: { x: 4, y: 5, w: 4, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard
            title="Срок исполнения"
            description="Распределение дополнительных статусов за период"
            exportSectionId="additionalStatuses"
            exportSelected={exportSections.isSelected('additionalStatuses')}
            onToggleExport={() => exportSections.toggleSection('additionalStatuses')}
            onResetCardLayout={resetCardLayout}
          >
            {additionalStatusDistribution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableDonutChart data={additionalStatusDistribution} />
            )}
          </ChartCard>
        ),
      },
    ],
    [additionalStatusDistribution, exportSections, periodSeries, statusDistribution, summary],
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
                label: 'Статусы контроля',
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
        <AnalyticsDashboardGrid storageKey="sokol.analytics.layout.monitoring" cards={cards} />
      </main>
    </div>
  );
}
