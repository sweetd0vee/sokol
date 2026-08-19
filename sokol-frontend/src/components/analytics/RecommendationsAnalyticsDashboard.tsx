import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchRecommendationsAnalytics, type RecommendationPeriodPoint } from '../../api/analytics';
import { queryKeys } from '../../api/queryKeys';
import { MultiCheckboxSelect } from '../ui/MultiCheckboxSelect';
import { AnalyticsDashboardGrid, type AnalyticsGridCard } from './AnalyticsDashboardGrid';
import { AnalyticsFilterSidebar } from './AnalyticsFilterSidebar';
import { AnalyticsSelectionSummary } from './AnalyticsSelectionSummary';
import { ChartCard, CHART_AXIS_TICK, CHART_LEGEND_STYLE, CHART_VALUE_LABEL_SIZE, EmptyChart, KpiCard } from './AnalyticsChartPrimitives';
import { FocusableDonutChart } from './FocusableDonutChart';
import { FocusableSquareCirclesChart } from './FocusableSquareCirclesChart';
import { FocusableTreemapChart } from './FocusableTreemapChart';
import { MaterialityMatrixChart } from './MaterialityMatrixChart';
import {
  getValueBasedColors,
  RECOMMENDATIONS_PALETTE,
  VALUE_GRAY_SCALE,
} from './analyticsPalette';
import { exportRecommendationsDashboard, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import {
  RECOMMENDATION_EXPORT_SECTIONS,
  type RecommendationExportSectionId,
} from '../../constants/analyticsExportSections';
import {
  INDICATOR_OPTIONS,
  MATERIALITY_LEVEL_OPTIONS,
  RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS,
  RECOMMENDATION_STATUS_OPTIONS,
} from '../../constants/recommendations';
import { useExportSections } from '../../hooks/useExportSections';
import { toAnalyticsSelectOptions, useAnalyticsPeriodFilters } from '../../hooks/useAnalyticsPeriodFilters';
import { hasAnalyticsPeriodFilters, useAnalyticsAnchorDates } from '../../hooks/useAnalyticsAnchorDates';
import { labelFromPeriodKey } from '../../utils/analyticsPeriod';
import {
  MATERIALITY_COLORS,
  STATUS_COLORS,
  getIndicatorColor,
  getMaterialityLevelColor,
  type PeriodGranularity,
} from '../../utils/recommendationAnalytics';
import { completeNamedDistribution, distributionHasValues } from '../../utils/analyticsDistribution';
import { registerDashboardChart } from '../../utils/dashboardChartRegistry';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import type { MaterialityLevel } from '../../types/recommendation';
import {
  DEFAULT_MATERIALITY_MATRIX_COUNT_SORT,
  sortMaterialityMatrixRows,
  type MaterialityMatrixCountSortConfig,
} from '../../utils/materialityMatrix';

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
const EMPTY_PERIOD_SERIES: RecommendationPeriodPoint[] = [];
const EMPTY_CUMULATIVE_SERIES: RecommendationPeriodPoint[] = [];
const EMPTY_MATERIALITY_DISTRIBUTION: never[] = [];
const EMPTY_INDICATOR_DISTRIBUTION: never[] = [];
const EMPTY_OBJECT_DISTRIBUTION: never[] = [];
const EMPTY_MATERIALITY_MATRIX: never[] = [];

function sortKeyFromQuarterKey(key: string) {
  const [year, quarter] = key.split('-Q');
  return Number(year) * 10 + Number(quarter);
}

function completeSelectedQuarterPeriods(
  series: RecommendationPeriodPoint[],
  selectedQuarterKeys: string[],
): RecommendationPeriodPoint[] {
  if (selectedQuarterKeys.length === 0) {
    return series;
  }

  const byKey = new Map(series.map((item) => [item.key, item]));

  const ordered = selectedQuarterKeys
    .map((key) => {
      return (
        byKey.get(key) ?? {
          key,
          label: labelFromPeriodKey(key, 'quarter'),
          sortKey: sortKeyFromQuarterKey(key),
          total: 0,
          completed: 0,
          unresolved: 0,
          on_control: 0,
          in_progress: 0,
          low: 0,
          medium: 0,
          high: 0,
          cumulative: 0,
          cumulativeCompleted: 0,
        }
      );
    })
    .sort((a, b) => a.sortKey - b.sortKey);

  let running = 0;
  let completedRunning = 0;
  return ordered.map((item) => {
    running += item.total;
    completedRunning += item.completed;
    return {
      ...item,
      cumulative: running,
      cumulativeCompleted: completedRunning,
    };
  });
}

function getPeriodXAxisProps(granularity: PeriodGranularity) {
  if (granularity === 'quarter') {
    return {
      interval: 0 as const,
      height: 40,
      tickMargin: 8,
      minTickGap: 0,
      tick: {
        ...CHART_AXIS_TICK,
        fontSize: 12,
      },
    };
  }

  return {};
}

const STACKED_LABEL_MIN_INSIDE_HEIGHT = 14;
const STACKED_LABEL_CHAR_WIDTH = 0.62;
const STACKED_NOTE_FONT_SIZE = 11;
const STACKED_NOTE_PAD_X = 6;
const STACKED_NOTE_PAD_Y = 3;
const STACKED_NOTE_BOX_HEIGHT = STACKED_NOTE_FONT_SIZE + STACKED_NOTE_PAD_Y * 2;
const STACKED_NOTE_ROW_GAP = 6;
const STACKED_NOTE_ROW_HEIGHT = STACKED_NOTE_BOX_HEIGHT + STACKED_NOTE_ROW_GAP;
const STACKED_NOTE_ANCHOR_GAP = 16;
const STACKED_NOTE_SIDE_GAP = 8;
const STACKED_PERIOD_CHART_TOP_MARGIN = 56;
const STACKED_PERIOD_CHART_SIDE_MARGIN = 28;

type StackedSegmentLabelView = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string;
  dataKey?: string | number;
  fill?: string;
  payload?: Record<string, unknown>;
  viewBox?: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
  };
};

const STATUS_STACK_KEYS = RECOMMENDATION_STATUS_OPTIONS.map((status) => status.value);
const MATERIALITY_STACK_KEYS = ['low', 'medium', 'high'] as const;

function getStatusSegmentColor(key: string) {
  return STATUS_COLORS[key as keyof typeof STATUS_COLORS] ?? '#e5e7eb';
}

function getMaterialitySegmentColor(key: string) {
  if (key === 'low') {
    return MATERIALITY_COLORS.низкий;
  }
  if (key === 'medium') {
    return MATERIALITY_COLORS.средний;
  }
  if (key === 'high') {
    return MATERIALITY_COLORS.высокий;
  }
  return '#e5e7eb';
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function readLabelValue(value: unknown): number | undefined {
  if (Array.isArray(value)) {
    const start = toFiniteNumber(value[0]) ?? 0;
    const end = toFiniteNumber(value[value.length - 1]);
    if (end === undefined) {
      return undefined;
    }
    return Math.abs(end - start) || end;
  }
  return toFiniteNumber(value);
}

function readLabelGeometry(view: StackedSegmentLabelView) {
  const box = view.viewBox;
  return {
    x: toFiniteNumber(box?.x) ?? toFiniteNumber(view.x),
    y: toFiniteNumber(box?.y) ?? toFiniteNumber(view.y),
    width: toFiniteNumber(box?.width) ?? toFiniteNumber(view.width) ?? 0,
    height: toFiniteNumber(box?.height) ?? toFiniteNumber(view.height) ?? 0,
  };
}

function readStackValue(view: StackedSegmentLabelView, key: string): number {
  const sources: Array<Record<string, unknown> | undefined> = [
    view.payload,
    view as Record<string, unknown>,
    view.payload?.payload as Record<string, unknown> | undefined,
  ];
  for (const source of sources) {
    if (!source) {
      continue;
    }
    const parsed = toFiniteNumber(source[key]);
    if (parsed !== undefined) {
      return Math.max(0, parsed);
    }
  }
  return 0;
}

function segmentFitsInsideLabel(segmentHeight: number, segmentWidth: number, value: number) {
  if (segmentHeight < STACKED_LABEL_MIN_INSIDE_HEIGHT || value <= 0) {
    return false;
  }
  const roundedStr = String(Math.round(value));
  const fontSizeBase = segmentHeight >= 20 ? 13 : 12;
  const maxFontSizeByWidth =
    segmentWidth > 0 ? Math.floor((segmentWidth - 6) / (roundedStr.length * STACKED_LABEL_CHAR_WIDTH)) : 0;
  const fontSize = Math.max(9, Math.min(fontSizeBase, maxFontSizeByWidth));
  const estimatedTextWidth = roundedStr.length * fontSize * STACKED_LABEL_CHAR_WIDTH;
  return segmentWidth >= estimatedTextWidth + 4 && fontSize >= 9;
}

function StackedBarSegmentValueLabel({
  stackKeys,
  getColor,
  dataKey,
  ...view
}: StackedSegmentLabelView & {
  stackKeys: readonly string[];
  getColor: (key: string) => string;
}) {
  const { x, y, width: w, height: h } = readLabelGeometry(view);
  const key = dataKey != null ? String(dataKey) : '';
  const numericValue = readLabelValue(view.value) ?? (key ? readStackValue(view, key) : undefined);
  if (numericValue === undefined || numericValue <= 0 || x === undefined || y === undefined) {
    return null;
  }

  const rounded = Math.round(numericValue);
  const roundedStr = String(rounded);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const segmentColor = (key ? getColor(key) : undefined) || view.fill || '#e5e7eb';
  const stackIndex = Math.max(0, stackKeys.indexOf(key));
  const stackValues = stackKeys.map((stackKey) => readStackValue(view, stackKey));
  const hasPayloadValues = stackValues.some((stackValue) => stackValue > 0);
  const pxPerUnit = h > 0 ? h / numericValue : 0;
  const valueAbove = hasPayloadValues
    ? stackValues.slice(stackIndex + 1).reduce((sum, stackValue) => sum + stackValue, 0)
    : 0;
  const barTopY = pxPerUnit > 0 ? y - valueAbove * pxPerUnit : y;
  const canPlaceInside = segmentFitsInsideLabel(h, w, numericValue);

  if (canPlaceInside) {
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={h >= 20 ? 13 : 12}
        fontWeight={700}
        fill="#111827"
        style={{ pointerEvents: 'none' }}
      >
        {roundedStr}
      </text>
    );
  }

  const outsideKeys = hasPayloadValues
    ? stackKeys.filter((stackKey, index) => {
        const stackValue = stackValues[index];
        if (stackValue <= 0) {
          return false;
        }
        const segmentHeight = pxPerUnit > 0 ? stackValue * pxPerUnit : stackKey === key ? h : 0;
        return !segmentFitsInsideLabel(segmentHeight, w, stackValue);
      })
    : stackKeys.filter((stackKey) => stackKey === key);
  const matchedOutsideIndex = outsideKeys.indexOf(key);
  const outsideIndex = hasPayloadValues && matchedOutsideIndex !== -1
    ? matchedOutsideIndex
    : stackIndex;
  const boxWidth = roundedStr.length * STACKED_NOTE_FONT_SIZE * STACKED_LABEL_CHAR_WIDTH + STACKED_NOTE_PAD_X * 2;
  const side = outsideIndex % 2 === 0 ? -1 : 1;
  const row = Math.floor(outsideIndex / 2);
  const labelCx = cx + side * (w / 2 + STACKED_NOTE_SIDE_GAP + boxWidth / 2);
  const boxBottomY = barTopY - STACKED_NOTE_ANCHOR_GAP - row * STACKED_NOTE_ROW_HEIGHT;
  const noteBoxBottomY = Math.max(STACKED_NOTE_BOX_HEIGHT + 4, boxBottomY);
  const noteCenterY = noteBoxBottomY - STACKED_NOTE_BOX_HEIGHT / 2;
  const boxX = labelCx - boxWidth / 2;
  const boxY = noteCenterY - STACKED_NOTE_BOX_HEIGHT / 2;
  const lineStartX = side < 0 ? boxX + boxWidth : boxX;

  return (
    <g style={{ pointerEvents: 'none' }}>
      <line
        x1={lineStartX}
        y1={noteCenterY}
        x2={cx}
        y2={cy}
        stroke={segmentColor}
        strokeWidth={1.25}
      />
      <rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={STACKED_NOTE_BOX_HEIGHT}
        rx={6}
        fill="#ffffff"
        stroke={segmentColor}
        strokeWidth={1.25}
      />
      <text
        x={labelCx}
        y={noteCenterY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={STACKED_NOTE_FONT_SIZE}
        fontWeight={700}
        fill="#111827"
      >
        {roundedStr}
      </text>
    </g>
  );
}

export function RecommendationsAnalyticsDashboard() {
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedMateriality, setSelectedMateriality] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedAdditionalStatuses, setSelectedAdditionalStatuses] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<AnalyticsExportFormat>('html');
  const [isExporting, setIsExporting] = useState(false);

  const exportSections = useExportSections(
    RECOMMENDATION_EXPORT_SECTIONS.map((section) => section.id) as RecommendationExportSectionId[],
  );

  const bootstrapQuery = useQuery({
    queryKey: queryKeys.analytics.recommendationsBootstrap,
    queryFn: () => fetchRecommendationsAnalytics({ granularity: 'year' }),
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
    statuses: selectedStatuses,
    additionalStatuses: selectedAdditionalStatuses,
    materialityLevels: selectedMateriality,
    granularity,
  });

  const analyticsQuery = useQuery({
    queryKey: [
      'analytics',
      'recommendations',
      granularity,
      selectedYearKeys,
      selectedQuarterKeys,
      selectedAuditors,
      selectedDepartments,
      selectedStatuses,
      selectedAdditionalStatuses,
      selectedMateriality,
    ],
    queryFn: () =>
      fetchRecommendationsAnalytics({
        granularity,
        years: selectedYearKeys,
        quarters: selectedQuarterKeys,
        months: [],
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

  const summary = data?.summary ?? EMPTY_RECOMMENDATION_SUMMARY;
  const periodSeries = data?.periodSeries ?? EMPTY_PERIOD_SERIES;
  const cumulativeSeries = data?.cumulativeSeries ?? EMPTY_CUMULATIVE_SERIES;
  const completedPeriodSeries = useMemo(
    () =>
      granularity === 'quarter'
        ? completeSelectedQuarterPeriods(periodSeries, selectedQuarterKeys)
        : periodSeries,
    [granularity, periodSeries, selectedQuarterKeys],
  );
  const completedCumulativeSeries = useMemo(
    () =>
      granularity === 'quarter'
        ? completeSelectedQuarterPeriods(cumulativeSeries, selectedQuarterKeys)
        : cumulativeSeries,
    [granularity, cumulativeSeries, selectedQuarterKeys],
  );
  const cumulativeColors = useMemo(
    () => getValueBasedColors(completedCumulativeSeries.map((item) => item.total), VALUE_GRAY_SCALE),
    [completedCumulativeSeries],
  );
  const materialityDistribution = data?.materialityDistribution ?? EMPTY_MATERIALITY_DISTRIBUTION;
  const indicatorDistribution = data?.indicatorDistribution ?? EMPTY_INDICATOR_DISTRIBUTION;

  // Colorize chart segments by the same tones used in the recommendations table.
  const coloredMaterialityDistribution = useMemo(
    () =>
      completeNamedDistribution(
        materialityDistribution,
        MATERIALITY_LEVEL_OPTIONS,
        getMaterialityLevelColor,
      ),
    [materialityDistribution],
  );

  const coloredIndicatorDistribution = useMemo(
    () =>
      completeNamedDistribution(
        indicatorDistribution,
        INDICATOR_OPTIONS,
        getIndicatorColor,
      ),
    [indicatorDistribution],
  );

  const objectDistribution = data?.objectDistribution ?? EMPTY_OBJECT_DISTRIBUTION;
  const objectDistributionTop = useMemo(
    () => [...objectDistribution].sort((left, right) => right.value - left.value).slice(0, 10),
    [objectDistribution],
  );
  const universeTotal = data?.universeTotal ?? 0;
  const filteredTotal = data?.filteredTotal ?? 0;
  const materialityMatrix = data?.materialityMatrix ?? EMPTY_MATERIALITY_MATRIX;
  const materialityMatrixSortRef = useRef<MaterialityMatrixCountSortConfig>(
    DEFAULT_MATERIALITY_MATRIX_COUNT_SORT,
  );
  const handleMaterialityMatrixSortChange = useCallback((sortConfig: MaterialityMatrixCountSortConfig) => {
    materialityMatrixSortRef.current = sortConfig;
  }, []);
  const periodXAxisProps = useMemo(() => getPeriodXAxisProps(granularity), [granularity]);

  // Export needs two separate capture nodes, even though UI now renders them as one card.
  const materialityByPeriodCaptureRef = useRef<HTMLDivElement>(null);
  const materialityCaptureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanupByPeriod = registerDashboardChart({
      id: 'materialityByPeriod',
      title: 'Существенность по периодам',
      description: 'Распределение уровней существенности внутри периода',
      getNode: () => materialityByPeriodCaptureRef.current,
    });
    const cleanupMateriality = registerDashboardChart({
      id: 'materiality',
      title: 'Существенность',
      description: 'Распределение уровней существенности за период',
      getNode: () => materialityCaptureRef.current,
    });

    return () => {
      cleanupByPeriod();
      cleanupMateriality();
    };
  }, []);

  const isMaterialityExportSelected =
    exportSections.isSelected('materialityByPeriod') && exportSections.isSelected('materiality');

  const toggleMaterialityExport = useCallback(() => {
    const shouldEnable = !isMaterialityExportSelected;

    if (shouldEnable) {
      if (!exportSections.isSelected('materialityByPeriod')) {
        exportSections.toggleSection('materialityByPeriod');
      }
      if (!exportSections.isSelected('materiality')) {
        exportSections.toggleSection('materiality');
      }
      return;
    }

    if (exportSections.isSelected('materialityByPeriod')) {
      exportSections.toggleSection('materialityByPeriod');
    }
    if (exportSections.isSelected('materiality')) {
      exportSections.toggleSection('materiality');
    }
  }, [exportSections, isMaterialityExportSelected]);

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
      await exportRecommendationsDashboard(
        {
          recommendations: [],
          filteredRecommendations: [],
          granularity,
          dateFrom: null,
          dateTo: null,
          auditors: selectedAuditors,
          departments: selectedDepartments,
          materialityLevels: selectedMateriality as MaterialityLevel[],
          selectedSections: exportSections.selectedSections,
          materialityMatrixOverride: sortMaterialityMatrixRows(
            materialityMatrix,
            materialityMatrixSortRef.current,
          ),
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
            title="Итого"
            description=""
            dense
            exportSectionId="summary"
            exportSelected={exportSections.isSelected('summary')}
            onToggleExport={() => exportSections.toggleSection('summary')}
          >
            <div className="grid w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
              <KpiCard label="Всего" value={summary.total} hint={`из ${universeTotal}`} tone="slate" />
              <KpiCard label="В процессе" value={summary.byStatus.in_progress} tone="amber" />
              <KpiCard label="Не решено" value={summary.byStatus.unresolved} tone="slate" />
              <KpiCard label="Исполнено" value={summary.byStatus.completed} tone="green" />
              <KpiCard label="Доля исполненных" value={summary.completionRate} suffix="%" tone="green" />
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'cumulative',
        defaultLayout: { x: 0, y: 2, w: 9, h: 3, minW: 4, minH: 2 },
        render: () => (
          <ChartCard
            title="Количество рекомендаций"
            description="Динамика количества рекомендаций за период"
            exportSectionId="cumulative"
            exportSelected={exportSections.isSelected('cumulative')}
            onToggleExport={() => exportSections.toggleSection('cumulative')}
          >
            {completedCumulativeSeries.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={completedCumulativeSeries}
                    margin={{ top: 22, right: 12, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={CHART_AXIS_TICK} {...periodXAxisProps} />
                    <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <Tooltip />
                    <Bar dataKey="total" name="За период" fill={RECOMMENDATIONS_PALETTE[0]} radius={[4, 4, 0, 0]}>
                      {completedCumulativeSeries.map((item, index) => (
                        <Cell key={item.key} fill={cumulativeColors[index]} />
                      ))}
                      <LabelList
                        dataKey="total"
                        position="top"
                        fontSize={CHART_VALUE_LABEL_SIZE}
                        fill="#111827"
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
        id: 'statusByPeriod',
        defaultLayout: { x: 0, y: 16, w: 6, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Статусы по периодам"
            description="Распределение статусов по периодам"
            exportSectionId="statusByPeriod"
            exportSelected={exportSections.isSelected('statusByPeriod')}
            onToggleExport={() => exportSections.toggleSection('statusByPeriod')}
          >
            {completedPeriodSeries.length === 0 ? <EmptyChart message="Нет данных" /> : (
              <div className="h-full min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={completedPeriodSeries} margin={{ top: STACKED_PERIOD_CHART_TOP_MARGIN, right: STACKED_PERIOD_CHART_SIDE_MARGIN, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={CHART_AXIS_TICK} {...periodXAxisProps} />
                    <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
                    <Tooltip />
                    <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                    {RECOMMENDATION_STATUS_OPTIONS.map((status) => (
                      <Bar
                        key={status.value}
                        dataKey={status.value}
                        name={status.label}
                        stackId="status"
                        fill={STATUS_COLORS[status.value]}
                      >
                        <LabelList
                          dataKey={status.value}
                          content={(props) => (
                            <StackedBarSegmentValueLabel
                              {...props}
                              dataKey={status.value}
                              stackKeys={STATUS_STACK_KEYS}
                              getColor={getStatusSegmentColor}
                            />
                          )}
                        />
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
        id: 'materialityCombined',
        defaultLayout: { x: 0, y: 5, w: 12, h: 3, minW: 6, minH: 2 },
        render: () => (
          <ChartCard
            title="Существенность"
            description="Распределение уровней существенности: за период и по периодам"
            exportSelected={isMaterialityExportSelected}
            onToggleExport={toggleMaterialityExport}
          >
            <div className="relative flex h-full min-h-0 flex-row gap-2">
              <div
                ref={materialityCaptureRef}
                style={{ flex: 1 }}
                data-analytics-export-capture-id="materiality"
                data-analytics-export-title="Существенность"
                data-analytics-export-description="Распределение уровней существенности за период"
                className="flex-1 min-h-0 min-w-0"
              >
                {distributionHasValues(coloredMaterialityDistribution) ? (
                  <FocusableDonutChart
                    data={coloredMaterialityDistribution}
                    labelMode="both"
                    legendLabelMode="name"
                    showLegend={false}
                    containerClassName="h-full min-h-0"
                  />
                ) : (
                  <EmptyChart message="Нет данных" heightClass="h-full" />
                )}
              </div>

              <div
                ref={materialityByPeriodCaptureRef}
                style={{ flex: 3 }}
                data-analytics-export-capture-id="materialityByPeriod"
                data-analytics-export-title="Существенность по периодам"
                data-analytics-export-description="Распределение уровней существенности внутри периода"
                className="flex-1 min-h-0 min-w-0"
              >
                {completedPeriodSeries.length === 0 ? (
                  <EmptyChart message="Нет данных" heightClass="h-full" />
                ) : (
                  <div className="h-full min-h-0 pb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={completedPeriodSeries}
                        margin={{ top: STACKED_PERIOD_CHART_TOP_MARGIN, right: STACKED_PERIOD_CHART_SIDE_MARGIN, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="label" tick={CHART_AXIS_TICK} {...periodXAxisProps} />
                        <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
                        <Tooltip />
                        <Bar dataKey="low" name="Низкий" stackId="mat" fill={MATERIALITY_COLORS.низкий}>
                          <LabelList
                            dataKey="low"
                            content={(props) => (
                              <StackedBarSegmentValueLabel
                                {...props}
                                dataKey="low"
                                stackKeys={MATERIALITY_STACK_KEYS}
                                getColor={getMaterialitySegmentColor}
                              />
                            )}
                          />
                        </Bar>
                        <Bar
                          dataKey="medium"
                          name="Средний"
                          stackId="mat"
                          fill={MATERIALITY_COLORS.средний}
                        >
                          <LabelList
                            dataKey="medium"
                            content={(props) => (
                              <StackedBarSegmentValueLabel
                                {...props}
                                dataKey="medium"
                                stackKeys={MATERIALITY_STACK_KEYS}
                                getColor={getMaterialitySegmentColor}
                              />
                            )}
                          />
                        </Bar>
                        <Bar
                          dataKey="high"
                          name="Высокий"
                          stackId="mat"
                          fill={MATERIALITY_COLORS.высокий}
                        >
                          <LabelList
                            dataKey="high"
                            content={(props) => (
                              <StackedBarSegmentValueLabel
                                {...props}
                                dataKey="high"
                                stackKeys={MATERIALITY_STACK_KEYS}
                                getColor={getMaterialitySegmentColor}
                              />
                            )}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Custom legend centered across the whole card */}
                    <div className="pointer-events-none absolute bottom-1 left-1/2 flex -translate-x-1/2 flex-row items-center justify-center gap-6">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-sm"
                          style={{ backgroundColor: MATERIALITY_COLORS.высокий }}
                        />
                        Высокий
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-sm"
                          style={{ backgroundColor: MATERIALITY_COLORS.средний }}
                        />
                        Средний
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-sm"
                          style={{ backgroundColor: MATERIALITY_COLORS.низкий }}
                        />
                        Низкий
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ChartCard>
        ),
      },
      {
        id: 'materialityMatrix',
        defaultLayout: { x: 0, y: 8, w: 12, h: 8, minW: 6, minH: 6 },
        render: () => (
          <ChartCard
            title="Существенность"
            description="Матрица уровней существенности по проверкам за период"
            exportSectionId="materialityMatrix"
            exportSelected={exportSections.isSelected('materialityMatrix')}
            onToggleExport={() => exportSections.toggleSection('materialityMatrix')}
          >
            {materialityMatrix.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <MaterialityMatrixChart
                rows={materialityMatrix}
                onSortConfigChange={handleMaterialityMatrixSortChange}
              />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'indicators',
        defaultLayout: { x: 9, y: 2, w: 3, h: 3, minW: 3, minH: 2 },
        render: () => (
          <ChartCard
            title="Индикаторы"
            description="Распределение индикаторов за период"
            exportSectionId="indicators"
            exportSelected={exportSections.isSelected('indicators')}
            onToggleExport={() => exportSections.toggleSection('indicators')}
          >
            {distributionHasValues(coloredIndicatorDistribution) ? (
              <FocusableSquareCirclesChart
                data={coloredIndicatorDistribution}
                labelMode="both"
              />
            ) : (
              <EmptyChart message="Нет данных" />
            )}
          </ChartCard>
        ),
      },
      {
        id: 'objects',
        defaultLayout: { x: 6, y: 16, w: 6, h: 3, minW: 6, minH: 3 },
        render: () => (
          <ChartCard
            title="Карта департаментов (ТОП-10)"
            description="Количество рекомендаций за период по департаментам"
            exportSectionId="objects"
            exportSelected={exportSections.isSelected('objects')}
            onToggleExport={() => exportSections.toggleSection('objects')}
          >
            {objectDistributionTop.length === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <FocusableTreemapChart
                data={objectDistributionTop}
                palette={VALUE_GRAY_SCALE}
                colorByValue
              />
            )}
          </ChartCard>
        ),
      },
    ],
    [
      cumulativeColors,
      completedCumulativeSeries,
      exportSections,
      isMaterialityExportSelected,
      coloredIndicatorDistribution,
      coloredMaterialityDistribution,
      indicatorDistribution,
      materialityDistribution,
      materialityMatrix,
      handleMaterialityMatrixSortChange,
      objectDistributionTop,
      periodXAxisProps,
      completedPeriodSeries,
      toggleMaterialityExport,
      universeTotal,
      summary,
    ],
  );

  if (bootstrapQuery.isLoading && !data) {
    return <LoadingState title="Загрузка аналитики рекомендаций…" />;
  }
  if ((bootstrapQuery.isError || analyticsQuery.isError) && !data) {
    const error = analyticsQuery.error ?? bootstrapQuery.error;
    return (
      <ErrorState
        title="Не удалось загрузить аналитику рекомендаций"
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
          <p className="mb-2 text-sm font-medium leading-relaxed text-gray-900">Контроль</p>
          <div className="space-y-2.5">
            <MultiCheckboxSelect options={MATERIALITY_LEVEL_OPTIONS} value={selectedMateriality} onChange={setSelectedMateriality} placeholder="Выберите уровень существенности" />
            <MultiCheckboxSelect options={RECOMMENDATION_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))} value={selectedStatuses} onChange={setSelectedStatuses} placeholder="Выберите статус" />
            <MultiCheckboxSelect options={RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))} value={selectedAdditionalStatuses} onChange={setSelectedAdditionalStatuses} placeholder="Выберите дополнительный статус" />
          </div>
        </div>
      </AnalyticsFilterSidebar>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col lg:-mt-[84px]">
        <AnalyticsDashboardGrid cards={cards} />
      </main>
    </div>
  );
}
