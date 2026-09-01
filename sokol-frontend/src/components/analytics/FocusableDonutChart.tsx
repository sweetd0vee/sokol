import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { getValueBasedColors, PALETTE } from './analyticsPalette';
import { CHART_LEGEND_STYLE, CHART_TOOLTIP_STYLE } from './AnalyticsChartPrimitives';
import { formatChartLegendText } from './chartLegend';

export type DonutDatum = {
  name: string;
  value: number;
  color?: string;
};

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
  /** Ring (doughnut) layout: hollow center, white gaps, labels outside. */
  variant?: 'pie' | 'ring';
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
};

function RingSegmentLabels({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent = 0,
  name,
  payload,
}: LabelProps & { name?: string }) {
  if (percent < 0.04) {
    return null;
  }
  const RADIAN = Math.PI / 180;
  const cos = Math.cos(-midAngle * RADIAN);
  const sin = Math.sin(-midAngle * RADIAN);
  const nameRadius = outerRadius + 22;
  const nameX = cx + nameRadius * cos;
  const nameY = cy + nameRadius * sin;
  const nameAnchor = nameX > cx ? 'start' : 'end';
  const label = name ?? payload?.name ?? '';
  const percentLabel = `${Math.round(percent * 100)}%`;
  const percentRadius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const percentX = cx + percentRadius * cos;
  const percentY = cy + percentRadius * sin;

  return (
    <g style={{ pointerEvents: 'none' }}>
      <text
        x={nameX}
        y={nameY}
        fill="#111827"
        textAnchor={nameAnchor}
        dominantBaseline="central"
        fontSize={15}
        fontWeight={600}
      >
        {label}
      </text>
      {percent >= 0.06 ? (
        <text
          x={percentX}
          y={percentY}
          fill="#111827"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={14}
          fontWeight={700}
        >
          {percentLabel}
        </text>
      ) : null}
    </g>
  );
}

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
}: LabelProps) {
  if (percent < 0.06 || value <= 0) {
    return null;
  }
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.62;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const labelColor = '#ffffff';
  const percentLabel =`${Math.round(percent * 100)}%`;

  if (labelMode === 'both') {
    return (
      <g style={{ pointerEvents: 'none' }}>
        <text
          x={x}
          y={y - 5}
          fill={labelColor}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={15}
          fontWeight={700}
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
          fontWeight={600}
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
        fontSize={labelMode === 'percent' ? 15 : 16}
        fontWeight={700}
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
  legendFontWeight = 400,
  legendPercentFirst = false,
  variant = 'pie',
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
          <PieChart margin={isRing ? { top: 28, right: 96, bottom: 28, left: 96 } : { top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={isRing ? '36%' : 0}
            outerRadius="72%"
            startAngle={isRing ? 90 : 0}
            endAngle={isRing ? -270 : 360}
            paddingAngle={isRing ? 3 : 0}
            stroke={isRing ? '#ffffff' : 'none'}
            label={
              showValueLabels
                ? isRing
                  ? (props) => <RingSegmentLabels {...props} />
                  : (props) => <PieValueLabel {...props} labelMode={labelMode} />
                : false
            }
            labelLine={
              isRing
                ? { stroke: '#cbd5e1', strokeWidth: 1 }
                : false
            }
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
              return (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  fillOpacity={isDimmed ? (isRing ? 0.34 : 0.32) : 1}
                  stroke={strokeColor}
                  strokeWidth={isRing ? (isActive ? 2 : 5) : (isActive ? 1 : 0)}
                  strokeOpacity={isDimmed && isRing ? 0.34 : 1}
                  style={{
                    cursor: 'pointer',
                    filter: isRing
                      ? (isActive ? 'brightness(1.04)' : undefined)
                      : isDimmed
                        ? 'brightness(0.72) saturate(0.85)'
                        : isActive
                          ? 'brightness(1.04)'
                          : undefined,
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
        <ul
          className="recharts-default-legend mx-auto flex w-max max-w-full shrink-0 flex-col items-start gap-y-1 px-3 pb-1 pt-0.5"
          style={{
            marginTop: 0,
            marginBottom: 0,
            paddingTop: 4,
            listStyle: 'none',
            fontSize: legendFontSize,
            fontWeight: legendFontWeight,
          }}
        >
          {chartData.map((item) => (
            <li
              key={item.name}
              className="recharts-legend-item grid grid-cols-[10px_auto] items-center gap-x-2"
              style={{ margin: 0 }}
            >
              <span
                className="recharts-legend-icon"
                style={{
                  display: 'block',
                  width: 9,
                  height: 9,
                  borderRadius: 9,
                  backgroundColor: item.color,
                }}
              />
              <span className="recharts-legend-item-text whitespace-nowrap" style={{ color: item.color }}>
                {formatLegendText(item)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
