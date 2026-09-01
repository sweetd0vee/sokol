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

  // Keep generous breathing room so circles never touch the card edges.
  const maxRadius = 17.5;
  // Fixed stroke for all circles — same absolute thickness as FocusableDonutChart ring
  // band relative to the largest circle: (outer 70% − inner 48%) / 70%.
  const strokeWidth = maxRadius * ((70 - 48) / 70);

  // Target positions by size rank (largest -> smallest).
  // TL: top-left, BL: bottom-left, TR: top-right, BR: bottom-right.
  const targetCenters: Array<{ x: number; y: number }> = [
    { x: 34, y: 32 }, // TL (largest)
    { x: 34, y: 72 }, // BL (2nd largest)
    { x: 74, y: 32 }, // TR (3rd largest)
    { x: 74, y: 72 }, // BR (smallest)
  ];

  // Compute per-slice placement by descending value.
  const centersByIndex = useMemo(() => {
    const indexed = slices.map((slice, i) => ({ i, v: slice.value }));
    // Stable sort: if values are equal, preserve original index order.
    indexed.sort((a, b) => (b.v - a.v) || (a.i - b.i));

    const byIndex = new Map<number, { x: number; y: number }>();
    indexed.forEach((entry, rank) => {
      const center = targetCenters[rank];
      if (center) {
        byIndex.set(entry.i, center);
      }
    });
    return byIndex;
  }, [slices, targetCenters]);

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
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          role="img"
        aria-label="Квадратная визуализация распределения"
        >
          {slices.map((item, index) => {
            const center = centersByIndex.get(index) ?? targetCenters[0];
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
            const strokeColor = isActive ? '#0f172a' : fill;

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
                  fill="#ffffff"
                  fillOpacity={isDimmed ? 0.32 : 1}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={isDimmed ? 0.32 : 1}
                >
                  <title>
                    {formatChartLegendText({
                      name: item.name,
                      value: item.value,
                      percent: roundedPercent,
                      mode: labelMode,
                      percentFirst: legendPercentFirst,
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

