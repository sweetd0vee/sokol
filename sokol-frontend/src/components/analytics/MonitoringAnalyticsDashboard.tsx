import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchMonitoringAnalytics } from '../../api/analytics';
import { MultiCheckboxSelect } from '../ui/MultiCheckboxSelect';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsFilterSidebar } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { ChartCard, CHART_AXIS_TICK, CHART_LEGEND_STYLE, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import { exportGenericAnalyticsDashboard, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import { MONITORING_EXPORT_SECTIONS, type MonitoringExportSectionId } from '../../constants/analyticsExportSections';
import { MATERIALITY_LEVEL_OPTIONS, RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS, RECOMMENDATION_STATUS_OPTIONS } from '../../constants/recommendations';
import { useExportSections } from '../../hooks/useExportSections';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { hasAnalyticsPeriodFilters, useAnalyticsAnchorDates } from '../../hooks/useAnalyticsAnchorDates';
import { STATUS_COLORS, type PeriodGranularity } from '../../utils/recommendationAnalytics';
import { ErrorState, LoadingState } from '../ui/StateMessage';

export function MonitoringAnalyticsDashboard() {
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

  const bootstrapQuery = useQuery({
    queryKey: ['analytics', 'monitoring', 'bootstrap'],
    queryFn: () => fetchMonitoringAnalytics({ granularity: 'year' }),
    staleTime: 60_000,
  });

  const anchorDates = useAnalyticsAnchorDates(bootstrapQuery.data?.filterOptions.anchorDates);
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

  const granularity: PeriodGranularity = periodSlice;
  const hasActiveFilters = hasAnalyticsPeriodFilters({
    yearKeys: selectedYearKeys,
    quarterKeys: selectedQuarterKeys,
    monthKeys: selectedMonthKeys,
    auditors: selectedAuditors,
    departments: selectedDepartments,
    statuses: selectedStatuses,
    additionalStatuses: selectedAdditionalStatuses,
    materialityLevels: selectedMateriality,
    granularity,
  });

  const analyticsQuery = useQuery({
    queryKey: [
      'analytics',
      'monitoring',
      granularity,
      selectedYearKeys,
      selectedQuarterKeys,
      selectedMonthKeys,
      selectedAuditors,
      selectedDepartments,
      selectedStatuses,
      selectedAdditionalStatuses,
      selectedMateriality,
    ],
    queryFn: () =>
      fetchMonitoringAnalytics({
        granularity,
        years: selectedYearKeys,
        quarters: selectedQuarterKeys,
        months: selectedMonthKeys,
        auditors: selectedAuditors,
        departments: selectedDepartments,
        statuses: selectedStatuses,
        additionalStatuses: selectedAdditionalStatuses,
        materialityLevels: selectedMateriality,
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

  const summary = data?.summary ?? {
    total: 0,
    byStatus: { completed: 0, unresolved: 0, on_control: 0, in_progress: 0 },
    byMateriality: { низкий: 0, средний: 0, высокий: 0 },
    byAdditional: { on_time: 0, deadline_violated: 0, on_control: 0 },
    withExtensions: 0,
    withCompletionDate: 0,
    completionRate: 0,
    violationRate: 0,
  };
  const periodSeries = data?.periodSeries ?? [];
  const statusDistribution = data?.statusDistribution ?? [];
  const additionalStatusDistribution = data?.additionalStatusDistribution ?? [];
  const universeTotal = data?.universeTotal ?? 0;
  const filteredTotal = data?.filteredTotal ?? 0;

  const resetFilters = () => {
    resetPeriodSelections();
    setSelectedAuditors([]);
    setSelectedDepartments([]);
    setSelectedMateriality([]);
    setSelectedStatuses([]);
    setSelectedAdditionalStatuses([]);
  };

  const handleExport = async () => {
    if (filteredTotal === 0 || isExporting) {return;}
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
            ['Записей в выборке', String(filteredTotal)],
            ['Всего в системе', String(universeTotal)],
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
        render: () => (
          <ChartCard title="Сводка KPI" description="" dense hideTitle exportSectionId="summary" exportSelected={exportSections.isSelected('summary')} onToggleExport={() => exportSections.toggleSection('summary')}>
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
        render: () => (
          <ChartCard title="Динамика сроков исполнения" description="Статусы рекомендаций по срокам" exportSectionId="deadlineDynamics" exportSelected={exportSections.isSelected('deadlineDynamics')} onToggleExport={() => exportSections.toggleSection('deadlineDynamics')}>
            {periodSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-full min-h-[13rem]"><ResponsiveContainer width="100%" height="100%"><BarChart data={periodSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="label" tick={CHART_AXIS_TICK} /><YAxis allowDecimals={false} tick={CHART_AXIS_TICK} /><Tooltip /><Legend wrapperStyle={CHART_LEGEND_STYLE} />{RECOMMENDATION_STATUS_OPTIONS.map((status) => <Bar key={status.value} dataKey={status.value} name={status.label} stackId="status" fill={STATUS_COLORS[status.value]} />)}</BarChart></ResponsiveContainer></div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'statuses',
        defaultLayout: { x: 0, y: 5, w: 4, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Статусы"
            description="Распределение статусов за период"
            exportSectionId="statuses"
            exportSelected={exportSections.isSelected('statuses')}
            onToggleExport={() => exportSections.toggleSection('statuses')}
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
        render: () => (
          <ChartCard
            title="Срок исполнения"
            description="Распределение дополнительных статусов за период"
            exportSectionId="additionalStatuses"
            exportSelected={exportSections.isSelected('additionalStatuses')}
            onToggleExport={() => exportSections.toggleSection('additionalStatuses')}
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

  if (bootstrapQuery.isLoading && !data) {
    return <LoadingState title="Загрузка аналитики мониторинга…" />;
  }
  if ((bootstrapQuery.isError || analyticsQuery.isError) && !data) {
    const error = analyticsQuery.error ?? bootstrapQuery.error;
    return (
      <ErrorState
        title="Не удалось загрузить аналитику мониторинга"
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
        canExport={filteredTotal > 0}
        onExport={handleExport}
        exportSelectedCount={exportSections.selectedCount}
        exportTotalCount={exportSections.totalCount}
        onSelectAllExport={exportSections.selectAll}
        onClearExport={exportSections.clearAll}
        selectionSummary={(
          <AnalyticsSelectionSummary
            metrics={[
            { label: 'Рекомендаций', value: filteredTotal, hint:`из ${universeTotal}` },
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
          <p className="mb-2 text-sm font-medium leading-relaxed text-gray-900">Контроль</p>
          <div className="space-y-2.5">
            <MultiCheckboxSelect options={MATERIALITY_LEVEL_OPTIONS} value={selectedMateriality} onChange={setSelectedMateriality} placeholder="Выберите уровень существенности" />
            <MultiCheckboxSelect options={RECOMMENDATION_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))} value={selectedStatuses} onChange={setSelectedStatuses} placeholder="Выберите статус" />
            <MultiCheckboxSelect options={RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))} value={selectedAdditionalStatuses} onChange={setSelectedAdditionalStatuses} placeholder="Выберите дополнительный статус" />
          </div>
        </div>
      </AnalyticsFilterSidebar>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AnalyticsDashboardGrid cards={cards} />
      </main>
    </div>
  );
}
