import { useMemo, useState } from 'react';
import { CHART_LEGEND_STYLE } from './AnalyticsChartPrimitives';
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
const VIEW_HEIGHT = 76;
const MAX_RADIUS = 22;
const CIRCLE_Y = 42;
const SIDE_PAD = 28;
const LABEL_GAP = 3.8;
const LABEL_FONT_SIZE = 6.6;
const LABEL_COLOR = '#111827';

function slotForIndex(index: number, count: number): CircleSlot {
  if (count <= 1) {
    return { x: VIEW_WIDTH / 2, y: CIRCLE_Y };
  }
  const usable = VIEW_WIDTH - SIDE_PAD * 2;
  return { x: SIDE_PAD + (usable * index) / (count - 1), y: CIRCLE_Y };
}

function percentLabelPosition(slot: CircleSlot, radius: number) {
  return {
    x: slot.x,
    y: slot.y - radius - LABEL_GAP,
    textAnchor: 'middle' as const,
  };
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
            const fill = colors[index] ?? palette[index % palette.length];
            const roundedPercent = Math.round(percent);
            const label = percentLabelPosition(slot, radius);
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
                  x={label.x}
                  y={label.y}
                  fill={LABEL_COLOR}
                  textAnchor={label.textAnchor}
                  dominantBaseline="auto"
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

      <div
        className="mx-auto flex w-full max-w-full shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 pb-1 pt-0.5"
        style={{
          fontSize: legendFontSize,
          fontWeight: legendFontWeight,
          paddingTop: 4,
        }}
      >
        {legendItems.map((item, index) => {
          return (
            <div
              key={`${item.name}-${index}`}
              className="grid shrink-0 grid-cols-[14px_auto] items-center gap-x-2 whitespace-nowrap"
            >
              <span
                className="box-border block h-3.5 w-3.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: item.color,
                }}
                aria-hidden
              />
              <span className="text-left text-slate-900" style={{ fontWeight: legendFontWeight }}>
                {labelMode === 'both' ? `${item.name}: ${item.value}` : item.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
