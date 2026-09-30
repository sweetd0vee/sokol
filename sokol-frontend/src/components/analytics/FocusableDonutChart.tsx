import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { getValueBasedColors, PALETTE } from './analyticsPalette';
import { ChartLegend, CHART_LEGEND_STYLE, CHART_SLICE_PERCENT_FONT_SIZE, CHART_TOOLTIP_STYLE, CHART_VALUE_LABEL_WEIGHT } from './AnalyticsChartPrimitives';
import { formatChartLegendText } from './formatChartLegendText';
import type { DonutDatum } from '../../types/analyticsCharts';

export type { DonutDatum };

type FocusableDonutChartProps = {
  data: DonutDatum[];
  palette?: readonly string[];
  /** Allows overriding outer container sizing in composed cards. */
  containerClassName?: string;
  /** When false, hides the legend under the chart. */
  showLegend?: boolean;
  /** Map smaller values to lighter shades and larger values to darker shades. */
  colorByValue?: boolean;
  /** What to show on segment labels. Defaults to absolute value and percent together. */
  labelMode?: 'value' | 'percent' | 'both';
  /** Controls what the legend shows. Defaults to detailed legend when `labelMode="both"`. */
  legendLabelMode?: 'value' | 'percent' | 'both' | 'name';
  /** When false, values appear only in the hover tooltip. */
  showValueLabels?: boolean;
  legendFontSize?: number;
  legendFontWeight?: number;
  /** When true, legend shows percent first and absolute value in parentheses. */
  legendPercentFirst?: boolean;
  legendLayout?: 'column' | 'row';
  /** Ring (doughnut) layout: hollow center, white gaps, percent labels on the ring. */
  variant?: 'pie' | 'ring';
  /** Color of in-slice percent / value labels. Defaults to white. */
  valueLabelColor?: string;
};

type LabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  value?: number;
  percent?: number;
  labelMode?: 'value' | 'percent' | 'both';
  fill?: string;
  payload?: DonutDatum;
  valueLabelColor?: string;
};

function contrastLabelColor(fill?: string, fallback = '#111827') {
  if (!fill?.startsWith('#')) {
    return fallback;
  }
  let raw = fill.slice(1);
  if (raw.length === 3) {
    raw = raw
      .split('')
      .map((char) => char + char)
      .join('');
  }
  if (raw.length < 6) {
    return fallback;
  }
  const red = Number.parseInt(raw.slice(0, 2), 16);
  const green = Number.parseInt(raw.slice(2, 4), 16);
  const blue = Number.parseInt(raw.slice(4, 6), 16);
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return fallback;
  }
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? '#111827' : '#ffffff';
}

/** Slices below this share get the number just outside the ring so it still reads. */
const MIN_INSIDE_SLICE_PERCENT = 0.06;

function PieValueLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  value = 0,
  percent = 0,
  labelMode = 'percent',
  fill: _fill,
  payload: _payload,
  valueLabelColor = '#ffffff',
}: LabelProps) {
  if (value <= 0) {
    return null;
  }
  const RADIAN = Math.PI / 180;
  const placeOutside = percent < MIN_INSIDE_SLICE_PERCENT;
  const radiusRatio = innerRadius > 0 ? 0.5 : 0.62;
  const radius = placeOutside
    ? outerRadius + 14
    : innerRadius + (outerRadius - innerRadius) * radiusRatio;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const labelColor = placeOutside ? '#111827' : valueLabelColor;
  const percentLabel = `${Math.round(percent * 100)}%`;

  if (labelMode === 'both') {
    return (
      <g style={{ pointerEvents: 'none' }}>
        <text
          x={x}
          y={y - 5}
          fill={labelColor}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={CHART_SLICE_PERCENT_FONT_SIZE}
          fontWeight={CHART_VALUE_LABEL_WEIGHT}
        >
          {percentLabel}
        </text>
        <text
          x={x}
          y={y + 11}
          fill={labelColor}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          fontWeight={CHART_VALUE_LABEL_WEIGHT}
        >
          {value}
        </text>
      </g>
    );
  }

  return (
    <g style={{ pointerEvents: 'none' }}>
      <text
        x={x}
        y={y}
        fill={labelColor}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={labelMode === 'percent' ? CHART_SLICE_PERCENT_FONT_SIZE : 16}
        fontWeight={CHART_VALUE_LABEL_WEIGHT}
      >
        {labelMode === 'percent' ? percentLabel : value}
      </text>
    </g>
  );
}

export function FocusableDonutChart({
  data,
  palette = PALETTE,
  containerClassName = 'h-full min-h-[13rem]',
  showLegend = true,
  colorByValue = false,
  labelMode = 'both',
  legendLabelMode,
  showValueLabels = true,
  legendFontSize = CHART_LEGEND_STYLE.fontSize,
  legendFontWeight = CHART_LEGEND_STYLE.fontWeight,
  legendPercentFirst = false,
  legendLayout = 'column',
  variant = 'pie',
  valueLabelColor = '#ffffff',
}: FocusableDonutChartProps) {
  const isRing = variant === 'ring';
  const resolvedLegendLabelMode = legendLabelMode ?? labelMode;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const colors = palette.length > 0 ? palette : PALETTE;
  const valueColors = colorByValue ? getValueBasedColors(data.map((entry) => entry.value), colors) : [];
  const chartData = data.map((entry, index) => ({
    ...entry,
    color: entry.color ?? (colorByValue ? valueColors[index] : colors[index % colors.length]),
  }));
  const pieData = chartData.filter((entry) => entry.value > 0);
  const total = chartData.reduce((sum, entry) => sum + entry.value, 0);
  const hasOutsideSliceLabel = pieData.some(
    (entry) => total > 0 && entry.value / total < MIN_INSIDE_SLICE_PERCENT,
  );
  const pieMargin = hasOutsideSliceLabel
    ? { top: 20, right: 20, bottom: 20, left: 20 }
    : { top: 8, right: 8, bottom: 8, left: 8 };

  const formatLegendText = (item: DonutDatum) => {
    const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
    return formatChartLegendText({
      name: item.name,
      value: item.value,
      percent,
      mode: resolvedLegendLabelMode,
      percentFirst: legendPercentFirst,
    });
  };

  return (
    <div className={`flex min-h-0 flex-col ${containerClassName}`}>
      <div className="min-h-0 min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={pieMargin}>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={isRing ? '48%' : 0}
            outerRadius="72%"
            startAngle={isRing ? 90 : 0}
            endAngle={isRing ? -270 : 360}
            paddingAngle={isRing ? 3 : 0}
            stroke={isRing ? '#ffffff' : 'none'}
            label={
              showValueLabels
                ? (props) => (
                    <PieValueLabel
                      {...props}
                      labelMode={isRing ? 'percent' : labelMode}
                      valueLabelColor={
                        isRing
                          ? contrastLabelColor(
                              props.payload?.color ??
                                (typeof props.fill === 'string' ? props.fill : undefined),
                            )
                          : valueLabelColor
                      }
                    />
                  )
                : false
            }
            labelLine={false}
            isAnimationActive={false}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {pieData.map((entry, index) => {
              const isDimmed = activeIndex !== null && activeIndex !== index;
              const isActive = activeIndex === index;
              const strokeColor = isRing
                ? (isActive ? '#0f172a' : '#ffffff')
                : (isActive ? '#0f172a' : 'none');
              const hoverFilter = isActive ? 'brightness(1.04)' : undefined;
              return (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  fillOpacity={isRing ? 1 : isDimmed ? 0.32 : 1}
                  stroke={strokeColor}
                  strokeWidth={isRing ? (isActive ? 2 : 5) : (isActive ? 1 : 0)}
                  strokeOpacity={1}
                  style={{
                    cursor: 'pointer',
                    filter: isRing
                      ? hoverFilter
                      : isDimmed
                        ? 'brightness(0.72) saturate(0.85)'
                        : hoverFilter,
                    transition: 'fill-opacity 160ms ease, filter 160ms ease',
                    outline: 'none',
                  }}
                />
              );
            })}
          </Pie>
          <Tooltip
            formatter={(value, name, item) => {
              const numericValue = typeof value === 'number' ? value : Number(value);
              const payload = item?.payload as DonutDatum | undefined;
              const percent = total > 0 ? Math.round((numericValue / total) * 100) : 0;
              const displayValue =`${numericValue} (${percent}%)`;
              return [displayValue, payload?.name ?? name];
            }}
            contentStyle={CHART_TOOLTIP_STYLE}
          />
        </PieChart>
        </ResponsiveContainer>
      </div>
      {showLegend ? (
        <ChartLegend
          fontSize={legendFontSize}
          fontWeight={legendFontWeight}
          layout={legendLayout}
          items={chartData.map((item, index) => ({
            key: `${item.name}-${index}`,
            color: item.color,
            label:
              isRing && resolvedLegendLabelMode === 'both'
                ? `${item.name}: ${item.value}`
                : formatLegendText(item),
          }))}
        />
      ) : null}
    </div>
  );
}
