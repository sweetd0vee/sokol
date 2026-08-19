import { useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { getValueBasedColors, PALETTE } from './analyticsPalette';
import { CHART_LEGEND_STYLE, CHART_TOOLTIP_STYLE } from './AnalyticsChartPrimitives';

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

function PieValueLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  value = 0,
  percent = 0,
  labelMode = 'percent',
}: LabelProps) {
  if (percent < 0.06 || value <= 0) {
    return null;
  }
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.62;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const textColor = '#ffffff';
  const percentLabel =`${Math.round(percent * 100)}%`;

  if (labelMode === 'both') {
    return (
      <g style={{ pointerEvents: 'none' }}>
        <text
          x={x}
          y={y - 5}
          fill={textColor}
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
          fill={textColor}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          fontWeight={600}
          opacity={0.92}
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
        fill={textColor}
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
}: FocusableDonutChartProps) {
  const resolvedLegendLabelMode = legendLabelMode ?? labelMode;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const colors = palette.length > 0 ? palette : PALETTE;
  const valueColors = colorByValue ? getValueBasedColors(data.map((entry) => entry.value), colors) : [];
  const chartData = data.map((entry, index) => ({
    ...entry,
    color: entry.color ?? (colorByValue ? valueColors[index] : colors[index % colors.length]),
  }));
  const total = chartData.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className={containerClassName}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="42%"
            innerRadius={0}
            outerRadius="72%"
            stroke="none"
            label={
              showValueLabels
                ? (props) => <PieValueLabel {...props} labelMode={labelMode} />
                : false
            }
            labelLine={false}
            isAnimationActive={false}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {chartData.map((entry, index) => {
              const isDimmed = activeIndex !== null && activeIndex !== index;
              const isActive = activeIndex === index;
              return (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  fillOpacity={isDimmed ? 0.32 : 1}
                  stroke={isActive ? '#0f172a' : 'none'}
                  strokeWidth={isActive ? 1 : 0}
                  style={{
                    cursor: 'pointer',
                    filter: isDimmed ? 'brightness(0.72) saturate(0.85)' : isActive ? 'brightness(1.04)' : undefined,
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
          {showLegend ? (
            <Legend
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              iconSize={9}
              formatter={(value) => {
                const name = String(value);
                if (resolvedLegendLabelMode !== 'both') {
                  return name;
                }
                const item = data.find((entry) => entry.name === name);
                if (!item) {
                  return name;
                }
                const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return legendPercentFirst
                  ? `${name}: ${percent}% (${item.value})`
                  : `${name}: ${item.value} (${percent}%)`;
              }}
              wrapperStyle={{
                ...CHART_LEGEND_STYLE,
                fontSize: legendFontSize,
                fontWeight: legendFontWeight,
                paddingTop: 4,
              }}
            />
          ) : null}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
