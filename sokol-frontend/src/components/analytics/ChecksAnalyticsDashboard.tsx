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
import { AnalyticsFilterSidebar, type AnalyticsPeriodSlice } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { ChartCard, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import { exportChecksDashboard, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import { CHECK_EXPORT_SECTIONS, type CheckExportSectionId } from '../../constants/analyticsExportSections';
import { useExportSections } from '../../hooks/useExportSections';
import { collectCalendarPeriodOptions } from '../../utils/analyticsPeriod';
import { parseDateValue } from '../../utils/dates';
import {
  buildAuditorDistribution,
  buildCompletionShare,
  buildCumulativeSeries,
  buildDocumentReadiness,
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

const STATUS_STACK = [
  { key: 'not_started', label: 'Запланировано', color: '#94A3B8' },
  { key: 'in_progress', label: 'В процессе', color: '#F59E0B' },
  { key: 'completed', label: 'Завершено', color: '#22C55E' },
] as const;

function toOptions(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

export function ChecksAnalyticsDashboard({ checks, recommendations }: ChecksAnalyticsDashboardProps) {
  const [periodSlice, setPeriodSlice] = useState<AnalyticsPeriodSlice>('year');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedQuarters, setSelectedQuarters] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
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
  const yearOptions = useMemo(() => toOptions(collectCalendarPeriodOptions(anchorDates, 'year').map((item) => item.label)), [anchorDates]);
  const quarterOptions = useMemo(() => toOptions(collectCalendarPeriodOptions(anchorDates, 'quarter').map((item) => item.label)), [anchorDates]);
  const monthOptions = useMemo(() => toOptions(collectCalendarPeriodOptions(anchorDates, 'month').map((item) => item.label)), [anchorDates]);
  const auditorOptions = useMemo(
    () => toOptions(collectAnalyticsAuditors(checks, recommendations)),
    [checks, recommendations],
  );
  const departmentOptions = useMemo(() => toOptions(collectAuditObjects(recommendations)), [recommendations]);

  const selectedYearKeys = useMemo(
    () => collectCalendarPeriodOptions(anchorDates, 'year').filter((item) => selectedYears.includes(item.label)).map((item) => item.key),
    [anchorDates, selectedYears],
  );
  const selectedQuarterKeys = useMemo(
    () => collectCalendarPeriodOptions(anchorDates, 'quarter').filter((item) => selectedQuarters.includes(item.label)).map((item) => item.key),
    [anchorDates, selectedQuarters],
  );
  const selectedMonthKeys = useMemo(
    () => collectCalendarPeriodOptions(anchorDates, 'month').filter((item) => selectedMonths.includes(item.label)).map((item) => item.key),
    [anchorDates, selectedMonths],
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
  const periodSliceLabel = periodSlice === 'month' ? 'Месяц' : periodSlice === 'quarter' ? 'Квартал' : 'Год';
  const activePeriodValues =
    periodSlice === 'month' ? selectedMonths : periodSlice === 'quarter' ? selectedQuarters : selectedYears;
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
  const documentReadiness = useMemo(() => buildDocumentReadiness(filteredChecks), [filteredChecks]);
  const auditorDistribution = useMemo(() => buildAuditorDistribution(filteredChecks), [filteredChecks]);

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
        render: ({ resetCardLayout }) => (
          <ChartCard
            title="Сводка KPI"
            description=""
            dense
            exportSectionId="summary"
            exportSelected={exportSections.isSelected('summary')}
            onToggleExport={() => exportSections.toggleSection('summary')}
            onResetCardLayout={resetCardLayout}
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
        defaultLayout: { x: 0, y: 2, w: 4, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard
            title="Динамика и накопительный итог"
            description="Проверки по сроку и накопление портфеля"
            exportSectionId="dynamics"
            exportSelected={exportSections.isSelected('dynamics')}
            onToggleExport={() => exportSections.toggleSection('dynamics')}
            onResetCardLayout={resetCardLayout}
          >
            {flowSeries.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={flowSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="total" name="За срок" fill="#6699FF" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="total" position="top" fontSize={10} />
                    </Bar>
                    <Line type="monotone" dataKey="cumulative" name="Накопительно" stroke="#003366" strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'views',
        defaultLayout: { x: 8, y: 2, w: 4, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard
            title="Структура по видам"
            description="Сколько проверок каждого вида в выбранном сроке"
            exportSectionId="views"
            exportSelected={exportSections.isSelected('views')}
            onToggleExport={() => exportSections.toggleSection('views')}
            onResetCardLayout={resetCardLayout}
          >
            {viewDistribution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={viewDistribution} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={92} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Проверки" fill="#2563EB" radius={[0, 6, 6, 0]}>
                      <LabelList dataKey="value" position="right" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'types',
        defaultLayout: { x: 0, y: 5, w: 3, h: 3, minW: 2, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard
            title="Структура по типам проверок"
            description="Плановые, внеплановые и тематические проверки"
            exportSectionId="types"
            exportSelected={exportSections.isSelected('types')}
            onToggleExport={() => exportSections.toggleSection('types')}
            onResetCardLayout={resetCardLayout}
          >
            {typeDistribution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableDonutChart data={typeDistribution} />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'statusByPeriod',
        defaultLayout: { x: 4, y: 2, w: 4, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard
            title="Статусы по сроку"
            description="Количество и пропорции статусов по месяцам, кварталам или годам"
            exportSectionId="statusByPeriod"
            exportSelected={exportSections.isSelected('statusByPeriod')}
            onToggleExport={() => exportSections.toggleSection('statusByPeriod')}
            onResetCardLayout={resetCardLayout}
          >
            {periodSeries.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={periodSeries} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {STATUS_STACK.map((status) => (
                      <Bar key={status.key} dataKey={status.key} name={status.label} stackId="status" fill={status.color}>
                        <LabelList dataKey={status.key} position="center" fontSize={10} fill="#fff" />
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'documents',
        defaultLayout: { x: 3, y: 5, w: 3, h: 3, minW: 2, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard
            title="Готовность документов"
            description="Заполненность реквизитов приказа, программы, АЗ и ДЗ"
            exportSectionId="documents"
            exportSelected={exportSections.isSelected('documents')}
            onToggleExport={() => exportSections.toggleSection('documents')}
            onResetCardLayout={resetCardLayout}
          >
            <div className="h-full min-h-[13rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={documentReadiness} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="filled" name="Заполнено" stackId="docs" fill="#22C55E">
                    <LabelList dataKey="filled" position="center" fontSize={10} fill="#fff" />
                  </Bar>
                  <Bar dataKey="empty" name="Не заполнено" stackId="docs" fill="#CBD5E1">
                    <LabelList dataKey="empty" position="center" fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'auditorTreemap',
        defaultLayout: { x: 6, y: 5, w: 6, h: 3, minW: 3, minH: 2 },
        render: ({ resetCardLayout }) => (
          <ChartCard
            title="Tree Map аудиторов"
            description="Площадь блока показывает нагрузку аудитора"
            exportSectionId="auditorTreemap"
            exportSelected={exportSections.isSelected('auditorTreemap')}
            onToggleExport={() => exportSections.toggleSection('auditorTreemap')}
            onResetCardLayout={resetCardLayout}
          >
            {auditorDistribution.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableTreemapChart data={auditorDistribution} />
            )}
          </ChartCard>
        ),
      },
    ],
    [
      auditorDistribution,
      checks.length,
      completionShare,
      documentReadiness,
      exportSections,
      flowSeries,
      periodSeries,
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
        <AnalyticsDashboardGrid storageKey="sokol.analytics.layout.checks" cards={cards} />
      </main>
    </div>
  );
}
