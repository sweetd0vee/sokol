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
  /** Percent label sits on the outer side of the 2×2 grid. */
  outward: 'left' | 'right';
};

const VIEW_WIDTH = 140;
const VIEW_HEIGHT = 100;
const MAX_RADIUS = 18;
const LABEL_GAP = 4.2;
const LABEL_FONT_SIZE = 6.6;
const LABEL_COLOR = '#111827';

// Largest → smallest: top-left, bottom-left, top-right, bottom-right.
// Center gap of 38 keeps max-size circles from overlapping while packing the cluster.
const TARGET_SLOTS: CircleSlot[] = [
  { x: 53, y: 33, outward: 'left' },
  { x: 53, y: 71, outward: 'left' },
  { x: 91, y: 33, outward: 'right' },
  { x: 91, y: 71, outward: 'right' },
];

function percentLabelPosition(slot: CircleSlot, radius: number) {
  const isLeft = slot.outward === 'left';
  return {
    x: isLeft ? slot.x - radius - LABEL_GAP : slot.x + radius + LABEL_GAP,
    y: slot.y,
    textAnchor: (isLeft ? 'end' : 'start') as 'end' | 'start',
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

  const slices = useMemo(
    () => data.filter((item) => item.value > 0).slice(0, 4),
    [data],
  );

  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);
  const maxShare = useMemo(() => {
    if (total <= 0) {
      return 0;
    }
    return Math.max(...slices.map((item) => item.value / total));
  }, [slices, total]);

  const slotsByIndex = useMemo(() => {
    const indexed = slices.map((slice, i) => ({ i, v: slice.value }));
    indexed.sort((a, b) => (b.v - a.v) || (a.i - b.i));

    const byIndex = new Map<number, CircleSlot>();
    indexed.forEach((entry, rank) => {
      const slot = TARGET_SLOTS[rank];
      if (slot) {
        byIndex.set(entry.i, slot);
      }
    });
    return byIndex;
  }, [slices]);

  const colors = useMemo(() => {
    return slices.map((item, index) => item.color ?? palette[index % palette.length]);
  }, [palette, slices]);

  const legendItems = useMemo(
    () =>
      data.map((item, index) => ({
        ...item,
        color: item.color ?? palette[index % palette.length],
      })),
    [data, palette],
  );

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
            const slot = slotsByIndex.get(index) ?? TARGET_SLOTS[0];
            const percent = total > 0 ? (item.value / total) * 100 : 0;
            const share = total > 0 ? item.value / total : 0;
            const radius = maxShare > 0 ? MAX_RADIUS * Math.sqrt(share / maxShare) : 0;
            const isDimmed = activeIndex !== null && activeIndex !== index;
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
                  fillOpacity={isDimmed ? 0.34 : 1}
                  stroke={isActive ? '#0f172a' : 'rgba(15, 23, 42, 0.14)'}
                  strokeWidth={isActive ? 1.1 : 0.45}
                  strokeOpacity={isDimmed ? 0.34 : 1}
                  style={{
                    filter: isDimmed ? 'brightness(0.78) saturate(0.88)' : isActive ? 'brightness(1.05)' : undefined,
                    transition: 'fill-opacity 160ms ease, filter 160ms ease',
                  }}
                >
                  <title>{tooltip}</title>
                </circle>
                <text
                  x={label.x}
                  y={label.y}
                  fill={LABEL_COLOR}
                  textAnchor={label.textAnchor}
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

      <div
        className="mx-auto grid w-max max-w-full shrink-0 grid-cols-2 justify-items-start gap-x-10 gap-y-2 px-3 pb-1 pt-0.5"
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
              className="grid grid-cols-[14px_auto] items-center gap-x-2"
            >
              <span
                className="box-border block h-3.5 w-3.5 shrink-0 rounded-full border border-black/15"
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
