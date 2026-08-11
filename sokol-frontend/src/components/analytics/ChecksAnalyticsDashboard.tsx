import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
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
import { ChartCard, CHART_AXIS_TICK, CHART_LEGEND_STYLE, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import { EffectivenessMatrixChart } from './EffectivenessMatrixChart';
import { CHECKS_PALETTE } from './analyticsPalette';
import { exportChecksDashboard, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import { CHECK_EXPORT_SECTIONS, type CheckExportSectionId } from '../../constants/analyticsExportSections';
import { useExportSections } from '../../hooks/useExportSections';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { parseDateValue } from '../../utils/dates';
import {
  buildCheckDepartmentDistribution,
  buildCompletionShare,
  buildCumulativeSeries,
  buildEffectivenessMatrix,
  buildPeriodSeries,
  buildTypeDistribution,
  buildViewDistribution,
  collectAnalyticsAuditors,
  collectAuditObjects,
  filterChecksForAnalytics,
  summarizeChecks,
  type PeriodGranularity,
} from '../../utils/checkAnalytics';

type ChecksAnalyticsDashboardProps = {
  checks: Check[];
  recommendations: Recommendation[];
};

export function ChecksAnalyticsDashboard({ checks, recommendations }: ChecksAnalyticsDashboardProps) {
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<AnalyticsExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  const exportSections = useExportSections(
    CHECK_EXPORT_SECTIONS.map((section) => section.id) as CheckExportSectionId[],
  );

  const anchorDates = useMemo(
    () => [
      ...checks.map((check) => parseDateValue(check.start_date)),
      new Date(2025, 0, 1).getTime(),
      new Date(2026, 11, 1).getTime(),
    ],
    [checks],
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
    [
      checks,
      recommendations,
      selectedAuditors,
      selectedDepartments,
      selectedYearKeys,
      selectedQuarterKeys,
      selectedMonthKeys,
    ],
  );

  const granularity: PeriodGranularity = periodSlice;
  const summary = useMemo(() => summarizeChecks(filteredChecks), [filteredChecks]);
  const completionShare = useMemo(() => buildCompletionShare(filteredChecks), [filteredChecks]);
  const periodSeries = useMemo(() => buildPeriodSeries(filteredChecks, granularity), [filteredChecks, granularity]);
  const cumulativeSeries = useMemo(() => buildCumulativeSeries(filteredChecks, granularity), [filteredChecks, granularity]);
  const flowSeries = useMemo(
    () =>
      periodSeries.map((item) => ({
        ...item,
        cumulative: cumulativeSeries.find((point) => point.key === item.key)?.cumulative ?? item.total,
      })),
    [periodSeries, cumulativeSeries],
  );
  const viewDistribution = useMemo(() => buildViewDistribution(filteredChecks), [filteredChecks]);
  const typeDistribution = useMemo(() => buildTypeDistribution(filteredChecks), [filteredChecks]);
  const departmentMap = useMemo(
    () => buildCheckDepartmentDistribution(filteredChecks, recommendations),
    [filteredChecks, recommendations],
  );
  const effectivenessMatrix = useMemo(
    () => buildEffectivenessMatrix(filteredChecks),
    [filteredChecks],
  );

  const resetFilters = () => {
    resetPeriodSelections();
    setSelectedAuditors([]);
    setSelectedDepartments([]);
  };

  const handleExport = async () => {
    if (filteredChecks.length === 0 || isExporting) {return;}
    if (exportSections.selectedSections.length === 0) {
      window.alert('Выберите хотя бы один дашборд для экспорта');
      return;
    }
    setIsExporting(true);
    try {
      await exportChecksDashboard(
        {
          checks,
          filteredChecks,
          granularity,
          auditors: selectedAuditors,
          departments: selectedDepartments,
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
        render: () => (
          <ChartCard
            title="Сводка KPI"
            description=""
            dense
            exportSectionId="summary"
            exportSelected={exportSections.isSelected('summary')}
            onToggleExport={() => exportSections.toggleSection('summary')}
          >
            <div className="grid w-full grid-cols-2 gap-1 lg:grid-cols-5">
              <KpiCard label="Всего" value={summary.total} hint={`из ${checks.length}`} tone="violet" />
              <KpiCard label="Запланировано" value={summary.not_started} tone="slate" />
              <KpiCard label="В процессе" value={summary.in_progress} tone="amber" />
              <KpiCard label="Завершено" value={summary.completed} tone="green" />
              <KpiCard label="Доля завершённых" value={completionShare} suffix="%" tone="blue" />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'dynamics',
        defaultLayout: { x: 0, y: 2, w: 6, h: 4, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Количество проверок"
            description="Динамика и накопительный итог"
            exportSectionId="dynamics"
            exportSelected={exportSections.isSelected('dynamics')}
            onToggleExport={() => exportSections.toggleSection('dynamics')}
          >
            {flowSeries.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={flowSeries} margin={{ top: 22, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
                    <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <Tooltip />
                    <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                    <Bar dataKey="total" name="За период" fill={CHECKS_PALETTE[11]} radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="cumulative" name="Всего" stroke={CHECKS_PALETTE[0]} strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'views',
        defaultLayout: { x: 6, y: 2, w: 6, h: 4, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Виды проверок"
            description="Количество проверок за период"
            exportSectionId="views"
            exportSelected={exportSections.isSelected('views')}
            onToggleExport={() => exportSections.toggleSection('views')}
          >
            {viewDistribution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={viewDistribution} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <YAxis dataKey="name" type="category" width={92} tick={CHART_AXIS_TICK} />
                    <Tooltip />
                    <Bar dataKey="value" name="Проверки" fill={CHECKS_PALETTE[8]} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'types',
        defaultLayout: { x: 0, y: 6, w: 5, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Типы проверок"
            description="Распределение плановых, внеплановых и контрольных процедур за период"
            exportSectionId="types"
            exportSelected={exportSections.isSelected('types')}
            onToggleExport={() => exportSections.toggleSection('types')}
          >
            {typeDistribution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableDonutChart data={typeDistribution} palette={CHECKS_PALETTE} />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'departmentMap',
        defaultLayout: { x: 5, y: 6, w: 7, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Карта департаментов"
            description="Количество проверок за период по департаментам"
            exportSectionId="departmentMap"
            exportSelected={exportSections.isSelected('departmentMap')}
            onToggleExport={() => exportSections.toggleSection('departmentMap')}
          >
            {departmentMap.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableTreemapChart data={departmentMap} palette={CHECKS_PALETTE} />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'effectivenessMatrix',
        defaultLayout: { x: 0, y: 9, w: 12, h: 6, minW: 6, minH: 4 },
        render: () => (
          <ChartCard
            title="Оценка эффективности"
            description="Матрица оценок по проверкам за период"
            exportSectionId="effectivenessMatrix"
            exportSelected={exportSections.isSelected('effectivenessMatrix')}
            onToggleExport={() => exportSections.toggleSection('effectivenessMatrix')}
          >
            {effectivenessMatrix.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <EffectivenessMatrixChart rows={effectivenessMatrix} />
            )}
          </ChartCard>
        ),
      },
    ],
    [
      checks.length,
      completionShare,
      departmentMap,
      effectivenessMatrix,
      exportSections,
      flowSeries,
      summary,
      typeDistribution,
      viewDistribution,
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
        canExport={filteredChecks.length > 0}
        onExport={handleExport}
        exportSelectedCount={exportSections.selectedCount}
        exportTotalCount={exportSections.totalCount}
        onSelectAllExport={exportSections.selectAll}
        onClearExport={exportSections.clearAll}
        selectionSummary={(
          <AnalyticsSelectionSummary
            metrics={[
            { label: 'Проверок', value: filteredChecks.length, hint: `из ${checks.length}` },
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
