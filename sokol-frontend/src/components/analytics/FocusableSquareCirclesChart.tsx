import { useMemo, useState } from 'react';
import { ChartLegend, CHART_LEGEND_STYLE } from './AnalyticsChartPrimitives';
import { PALETTE } from './analyticsPalette';
import { formatChartLegendText } from './chartLegend';

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

type CircleSlot = {
  x: number;
  y: number;
};

const VIEW_WIDTH = 200;
const VIEW_HEIGHT = 68;
const MAX_RADIUS = 19;
const CIRCLE_Y = 34;
const SIDE_PAD = 28;
const LABEL_FONT_SIZE = 4.2;

function slotForIndex(index: number, count: number): CircleSlot {
  if (count <= 1) {
    return { x: VIEW_WIDTH / 2, y: CIRCLE_Y };
  }
  const usable = VIEW_WIDTH - SIDE_PAD * 2;
  return { x: SIDE_PAD + (usable * index) / (count - 1), y: CIRCLE_Y };
}

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

export function FocusableSquareCirclesChart({
  data,
  palette = PALETTE,
  labelMode = 'both',
  legendPercentFirst = false,
  legendFontSize = CHART_LEGEND_STYLE.fontSize,
  legendFontWeight = CHART_LEGEND_STYLE.fontWeight,
}: SquareCirclesChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const legendItems = useMemo(
    () =>
      data
        .map((item, index) => ({
          ...item,
          color: item.color ?? palette[index % palette.length],
          index,
        }))
        .sort((a, b) => b.value - a.value || a.index - b.index),
    [data, palette],
  );

  const slices = useMemo(
    () => legendItems.filter((item) => item.value > 0).slice(0, 4),
    [legendItems],
  );

  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);
  const maxShare = useMemo(() => {
    if (total <= 0) {
      return 0;
    }
    return Math.max(...slices.map((item) => item.value / total));
  }, [slices, total]);

  return (
    <div className="flex h-full min-h-[13rem] flex-col overflow-hidden">
      <div className="min-h-0 flex-1 pb-1">
        <svg
          className="h-full w-full"
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Квадратная визуализация распределения"
        >
          {slices.map((item, index) => {
            const slot = slotForIndex(index, slices.length);
            const percent = total > 0 ? (item.value / total) * 100 : 0;
            const share = total > 0 ? item.value / total : 0;
            const radius = maxShare > 0 ? MAX_RADIUS * Math.sqrt(share / maxShare) : 0;
            const isActive = activeIndex === index;
            const fill = item.color ?? palette[index % palette.length];
            const roundedPercent = Math.round(percent);
            const tooltip = formatChartLegendText({
              name: item.name,
              value: item.value,
              percent: roundedPercent,
              mode: labelMode,
              percentFirst: legendPercentFirst,
            });

            return (
              <g
                key={item.name}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <circle
                  cx={slot.x}
                  cy={slot.y}
                  r={radius}
                  fill={fill}
                  stroke={isActive ? '#0f172a' : 'none'}
                  strokeWidth={isActive ? 1 : 0}
                  vectorEffect="non-scaling-stroke"
                  style={{
                    filter: isActive ? 'brightness(1.05)' : undefined,
                    transition: 'filter 160ms ease',
                  }}
                >
                  <title>{tooltip}</title>
                </circle>
                <text
                  x={slot.x}
                  y={slot.y}
                  fill={contrastLabelColor(fill)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={LABEL_FONT_SIZE}
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

      <ChartLegend
        fontSize={legendFontSize}
        fontWeight={legendFontWeight}
        items={legendItems.map((item, index) => ({
          key: `${item.name}-${index}`,
          color: item.color,
          label: labelMode === 'both' ? `${item.name}: ${item.value}` : item.name,
        }))}
      />
    </div>
  );
}
