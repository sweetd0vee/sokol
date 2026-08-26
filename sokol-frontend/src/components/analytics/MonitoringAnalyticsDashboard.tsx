import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchMonitoringAnalytics } from '../../api/analytics';
import { queryKeys } from '../../api/queryKeys';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsFilterSidebar } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import {
  ChartCard,
  CHART_TOOLTIP_STYLE,
  CHART_VALUE_LABEL_SIZE,
  EmptyChart,
  KpiCard,
} from './AnalyticsChartPrimitives';
import { CHECKS_PALETTE, getValueBasedColors } from './analyticsPalette';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableSquareCirclesChart } from './FocusableSquareCirclesChart';
import { StatusMatrixChart } from './StatusMatrixChart';
import { exportGenericAnalyticsDashboard, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import { MONITORING_EXPORT_SECTIONS, type MonitoringExportSectionId } from '../../constants/analyticsExportSections';
import { useExportSections } from '../../hooks/useExportSections';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { hasAnalyticsPeriodFilters, useAnalyticsAnchorDates } from '../../hooks/useAnalyticsAnchorDates';
import {
  getRecommendationAdditionalStatusColor,
  getRecommendationStatusColor,
  type PeriodGranularity,
} from '../../utils/recommendationAnalytics';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import { completeNamedDistribution, distributionHasValues } from '../../utils/analyticsDistribution';

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
const EMPTY_ADDITIONAL_STATUS_DISTRIBUTION: never[] = [];
const EMPTY_STATUS_DISTRIBUTION: never[] = [];
const EMPTY_STATUS_MATRIX: never[] = [];
const EMPTY_DEADLINE_EXTENSIONS: never[] = [];

function CheckKeyAxisTick({
  x = 0,
  y = 0,
  payload,
  shortNameByKey,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  shortNameByKey: Map<string, string>;
}) {
  const key = String(payload?.value ?? '');
  const shortName = shortNameByKey.get(key) || key;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{shortName}</title>
      <text
        dy={14}
        textAnchor="middle"
        fill="#64748B"
        fontSize={9}
      >
        {key}
      </text>
    </g>
  );
}

export function MonitoringAnalyticsDashboard() {
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<AnalyticsExportFormat>('html');
  const [isExporting, setIsExporting] = useState(false);

  const exportSections = useExportSections(
    MONITORING_EXPORT_SECTIONS.map((section) => section.id) as MonitoringExportSectionId[],
  );

  const bootstrapQuery = useQuery({
    queryKey: queryKeys.analytics.monitoringBootstrap,
    queryFn: () => fetchMonitoringAnalytics({ granularity: 'year' }),
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
      'monitoring',
      granularity,
      selectedYearKeys,
      selectedQuarterKeys,
      selectedAuditors,
      selectedDepartments,
    ],
    queryFn: () =>
      fetchMonitoringAnalytics({
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

  const summary = data?.summary ?? EMPTY_RECOMMENDATION_SUMMARY;
  const additionalStatusDistribution = data?.additionalStatusDistribution ?? EMPTY_ADDITIONAL_STATUS_DISTRIBUTION;
  const statusDistribution = data?.statusDistribution ?? EMPTY_STATUS_DISTRIBUTION;
  const statusMatrix = data?.statusMatrix ?? EMPTY_STATUS_MATRIX;
  const deadlineExtensionsByCheck = data?.deadlineExtensionsByCheck ?? EMPTY_DEADLINE_EXTENSIONS;
  const universeTotal = data?.universeTotal ?? 0;
  const filteredTotal = data?.filteredTotal ?? 0;

  const deadlineExtensionShortNames = useMemo(
    () => new Map(deadlineExtensionsByCheck.map((item) => [item.key, item.shortName || item.name || item.key])),
    [deadlineExtensionsByCheck],
  );
  const deadlineExtensionColors = useMemo(
    () => getValueBasedColors(deadlineExtensionsByCheck.map((item) => item.value)),
    [deadlineExtensionsByCheck],
  );

  const coloredAdditionalStatusDistribution = useMemo(
    () =>
      completeNamedDistribution(
        additionalStatusDistribution,
        [
          { value: 'on_control', label: 'На контроле' },
          { value: 'deadline_violated', label: 'Срок нарушен' },
          { value: 'on_time', label: 'В срок' },
        ],
        getRecommendationAdditionalStatusColor,
      ),
    [additionalStatusDistribution],
  );

  const coloredStatusDistribution = useMemo(
    () =>
      completeNamedDistribution(
        statusDistribution,
        [
          { value: 'completed', label: 'Исполнено' },
          { value: 'unresolved', label: 'Не решено' },
          { value: 'in_progress', label: 'В процессе' },
          { value: 'on_control', label: 'На контроле' },
        ],
        getRecommendationStatusColor,
      ),
    [statusDistribution],
  );

  const resetFilters = () => {
    resetPeriodSelections();
    setSelectedAuditors([]);
    setSelectedDepartments([]);
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
          documentTitle: 'Мониторинг',
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
          <ChartCard title="Итого" description="" dense exportSectionId="summary" exportSelected={exportSections.isSelected('summary')} onToggleExport={() => exportSections.toggleSection('summary')}>
            <div className="grid w-full grid-cols-2 gap-1 lg:grid-cols-5">
              <KpiCard label="На контроле" value={summary.byStatus.on_control} tone="slate" />
              <KpiCard label="В работе" value={summary.byStatus.in_progress} tone="amber" />
              <KpiCard label="Исполнено" value={summary.byStatus.completed} tone="green" />
              <KpiCard label="Срок нарушен" value={summary.byAdditional.deadline_violated} tone="red" />
              <KpiCard label="Доля просроченных" value={summary.violationRate} suffix="%" tone="red" />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'statuses',
        defaultLayout: { x: 0, y: 2, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Статусы"
            description="Распределение статусов за период"
            exportSectionId="statuses"
            exportSelected={exportSections.isSelected('statuses')}
            onToggleExport={() => exportSections.toggleSection('statuses')}
          >
            {distributionHasValues(coloredStatusDistribution) ? (
              <FocusableSquareCirclesChart
                data={coloredStatusDistribution}
                labelMode="both"
              />
            ) : (
              <EmptyChart message="Нет данных" />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'additionalStatuses',
        defaultLayout: { x: 6, y: 2, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Дополнительные статусы"
            description="Распределение дополнительных статусов за период"
            exportSectionId="additionalStatuses"
            exportSelected={exportSections.isSelected('additionalStatuses')}
            onToggleExport={() => exportSections.toggleSection('additionalStatuses')}
          >
            {distributionHasValues(coloredAdditionalStatusDistribution) ? (
              <FocusableDonutChart
                data={coloredAdditionalStatusDistribution}
                variant="ring"
                showLegend={false}
              />
            ) : (
              <EmptyChart message="Нет данных" />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'deadlineExtensions',
        defaultLayout: { x: 0, y: 5, w: 12, h: 4, minW: 6, minH: 3 },
        render: () => (
          <ChartCard
            title="Перенос срока"
            description="Количество переносов срока за период"
            exportSectionId="deadlineExtensions"
            exportSelected={exportSections.isSelected('deadlineExtensions')}
            onToggleExport={() => exportSections.toggleSection('deadlineExtensions')}
          >
            {deadlineExtensionsByCheck.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[14rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={deadlineExtensionsByCheck}
                    margin={{ top: 22, right: 16, left: -10, bottom: 28 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="key"
                      interval={0}
                      height={36}
                      tick={(props) => (
                        <CheckKeyAxisTick {...props} shortNameByKey={deadlineExtensionShortNames} />
                      )}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(value) => [value, 'Переносов']}
                      labelFormatter={(label) => {
                        const key = String(label);
                        const shortName = deadlineExtensionShortNames.get(key);
                        return shortName && shortName !== key ? `${key} — ${shortName}` : key;
                      }}
                    />
                    <Bar dataKey="value" name="Переносов" fill={CHECKS_PALETTE[0]} radius={[4, 4, 0, 0]}>
                      {deadlineExtensionsByCheck.map((item, index) => (
                        <Cell key={item.id} fill={deadlineExtensionColors[index]} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="top"
                        fontSize={CHART_VALUE_LABEL_SIZE}
                        fill={CHECKS_PALETTE[0]}
                        offset={8}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ),
      },
      {
        id: 'statusMatrix',
        defaultLayout: { x: 0, y: 9, w: 12, h: 8, minW: 6, minH: 6 },
        render: () => (
          <ChartCard
            title="Матрица статусов"
            description="Матрица статусов по проверкам за период"
            exportSectionId="statusMatrix"
            exportSelected={exportSections.isSelected('statusMatrix')}
            onToggleExport={() => exportSections.toggleSection('statusMatrix')}
          >
            {statusMatrix.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <StatusMatrixChart rows={statusMatrix} />
            )}
          </ChartCard>
        ),
      },
    ],
    [
      coloredAdditionalStatusDistribution,
      coloredStatusDistribution,
      deadlineExtensionColors,
      deadlineExtensionShortNames,
      deadlineExtensionsByCheck,
      exportSections,
      statusMatrix,
      summary,
    ],
  );

  if (bootstrapQuery.isLoading && !data) {
    return <LoadingState title="Загрузка мониторинга…" />;
  }
  if ((bootstrapQuery.isError || analyticsQuery.isError) && !data) {
    const error = analyticsQuery.error ?? bootstrapQuery.error;
    return (
      <ErrorState
        title="Не удалось загрузить мониторинг"
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
