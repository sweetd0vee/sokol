import { useMemo, useState } from 'react';
import { CHART_LEGEND_STYLE } from './AnalyticsChartPrimitives';
import { PALETTE } from './analyticsPalette';

export type SquareCirclesDatum = {
  name: string;
  value: number;
  /**
   * Optional per-segment color coming from backend.
   * If provided, it overrides the palette.
   */
  color?: string;
};

type SquareCirclesChartProps = {
  data: SquareCirclesDatum[];
  palette?: readonly string[];
  /**
   * Controls legend formatting.
   * For compatibility with `FocusableDonutChart`, if not `both` — legend shows only names.
   */
  labelMode?: 'value' | 'percent' | 'both';
  legendPercentFirst?: boolean;
  legendFontSize?: number;
  legendFontWeight?: number;
};

function formatPercent(value: number) {
  return `${value}%`;
}

function formatLegendLabel({
  name,
  value,
  percent,
  labelMode,
  legendPercentFirst,
}: {
  name: string;
  value: number;
  percent: number;
  labelMode: 'value' | 'percent' | 'both';
  legendPercentFirst: boolean;
}) {
  if (labelMode !== 'both') {
    return name;
  }

  return legendPercentFirst
    ? `${name}: ${formatPercent(percent)} (${value})`
    : `${name}: ${value} (${formatPercent(percent)})`;
}

export function FocusableSquareCirclesChart({
  data,
  palette = PALETTE,
  labelMode = 'both',
  legendPercentFirst = false,
  legendFontSize = CHART_LEGEND_STYLE.fontSize,
  legendFontWeight = 400,
}: SquareCirclesChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const slices = useMemo(() => data.slice(0, 4), [data]);

  const total = useMemo(() => slices.reduce((sum, item) => sum + item.value, 0), [slices]);
  const maxShare = useMemo(() => {
    if (total <= 0) {
      return 0;
    }
    return Math.max(...slices.map((item) => item.value / total));
  }, [slices, total]);

  // Keep generous breathing room so circles never touch the card edges.
  // Slightly larger than before to better match the visual design.
  const maxRadius = 17.5;
  const centers: Array<{ x: number; y: number }> = [
    { x: 31, y: 29 }, // top-left
    { x: 76, y: 32 }, // top-right
    { x: 31, y: 74 }, // bottom-left
    { x: 67, y: 66 }, // bottom-right
  ];

  const colors = useMemo(() => {
    return slices.map((item, index) => item.color ?? palette[index % palette.length]);
  }, [palette, slices]);

  return (
    <div className="flex h-full min-h-[13rem] flex-col overflow-hidden">
      <div className="min-h-0 flex-1 pb-1">
        <svg
          className="h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Квадратная визуализация распределения"
        >
          {slices.map((item, index) => {
            const center = centers[index] ?? centers[0];
            const percent = total > 0 ? (item.value / total) * 100 : 0;
            const share = total > 0 ? item.value / total : 0;

            // Radius^2 is proportional to share (and therefore to percent).
            // Normalize to `maxShare` so the largest circle fits the quadrant.
            const radius = maxShare > 0 ? maxRadius * Math.sqrt(share / maxShare) : 0;
            const isDimmed = activeIndex !== null && activeIndex !== index;
            const isActive = activeIndex === index;
            const fill = colors[index] ?? palette[index % palette.length];

            const roundedPercent = Math.round(percent);
            // Keep consistent typography for dashboard charts.
            const labelColor = '#111827';
            const fontSize = Math.max(4.5, Math.min(7.5, radius * 0.42));

            return (
              <g
                key={item.name}
                style={{ cursor: 'default' }}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <circle
                  cx={center.x}
                  cy={center.y}
                  r={radius}
                  fill={fill}
                  fillOpacity={isDimmed ? 0.32 : 1}
                  stroke={isActive ? '#0f172a' : 'none'}
                  strokeWidth={isActive ? 1 : 0}
                  vectorEffect="non-scaling-stroke"
                >
                  <title>
                    {formatLegendLabel({
                      name: item.name,
                      value: item.value,
                      percent: roundedPercent,
                      labelMode,
                      legendPercentFirst,
                    })}
                  </title>
                </circle>
                <text
                  x={center.x}
                  y={center.y}
                  fill={labelColor}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fontSize}
                  fontWeight={700}
                  style={{ pointerEvents: 'none' }}
                >
                  {roundedPercent}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div
        className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-1.5 pb-1 pt-0.5"
        style={{
          fontSize: legendFontSize,
          fontWeight: legendFontWeight,
          paddingTop: 4,
        }}
      >
        {slices.map((item, index) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          const fill = colors[index] ?? palette[index % palette.length];
          return (
            <div key={`${item.name}-${index}`} className="inline-flex items-center gap-2">
              <span
                className="inline-block h-3.5 w-3.5 rounded-full"
                style={{
                  backgroundColor: fill,
                }}
                aria-hidden
              />
                  <span className="text-slate-900" style={{ fontWeight: legendFontWeight }}>
                {formatLegendLabel({
                  name: item.name,
                  value: item.value,
                  percent,
                  labelMode,
                  legendPercentFirst,
                })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

