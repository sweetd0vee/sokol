import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChartLegend,
  CHART_LEGEND_STYLE,
  CHART_SLICE_PERCENT_FONT_SIZE,
  CHART_VALUE_LABEL_WEIGHT,
} from './AnalyticsChartPrimitives';
import { PALETTE } from './analyticsPalette';
import { formatChartLegendText } from './formatChartLegendText';

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
  legendLayout?: 'column' | 'row';
};

const VIEW_WIDTH = 200;
const VIEW_HEIGHT = 68;
const MAX_RADIUS = 16;
const CIRCLE_Y = 34;
const CIRCLE_GAP = 4;

function packCircleCenters(radii: number[]): number[] {
  if (radii.length === 0) {
    return [];
  }
  if (radii.length === 1) {
    return [VIEW_WIDTH / 2];
  }

  const xs = [radii[0]];
  for (let index = 1; index < radii.length; index += 1) {
    xs.push(xs[index - 1] + radii[index - 1] + CIRCLE_GAP + radii[index]);
  }

  const left = xs[0] - radii[0];
  const right = xs[xs.length - 1] + radii[xs.length - 1];
  const offset = (VIEW_WIDTH - (right - left)) / 2 - left;
  return xs.map((x) => x + offset);
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
  legendLayout = 'column',
}: SquareCirclesChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  /** ViewBox units that render as CHART_SLICE_PERCENT_FONT_SIZE screen pixels (donut parity). */
  const [labelFontSize, setLabelFontSize] = useState(CHART_SLICE_PERCENT_FONT_SIZE / 3);

  useEffect(() => {
    const node = svgRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    const update = () => {
      const rect = node.getBoundingClientRect();
      const scale = Math.min(rect.width / VIEW_WIDTH, rect.height / VIEW_HEIGHT);
      if (scale > 0) {
        setLabelFontSize(CHART_SLICE_PERCENT_FONT_SIZE / scale);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
  const packedSlices = useMemo(() => {
    const maxShare =
      total > 0 ? Math.max(...slices.map((item) => item.value / total), 0) : 0;
    const radii = slices.map((item) => {
      if (total <= 0 || maxShare <= 0) {
        return 0;
      }
      return MAX_RADIUS * Math.sqrt(item.value / total / maxShare);
    });
    const xs = packCircleCenters(radii);
    return slices.map((item, index) => ({
      ...item,
      radius: radii[index],
      x: xs[index],
      percent: total > 0 ? (item.value / total) * 100 : 0,
    }));
  }, [slices, total]);

  return (
    <div className="flex h-full min-h-[13rem] flex-col overflow-hidden">
      <div className="min-h-0 flex-1 pb-1">
        <svg
          ref={svgRef}
          className="h-full w-full"
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Квадратная визуализация распределения"
        >
          {packedSlices.map((item, index) => {
            const isActive = activeIndex === index;
            const fill = item.color ?? palette[index % palette.length];
            const roundedPercent = Math.round(item.percent);
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
                  cx={item.x}
                  cy={CIRCLE_Y}
                  r={item.radius}
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
                  x={item.x}
                  y={CIRCLE_Y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={contrastLabelColor(fill)}
                  fontSize={labelFontSize}
                  fontWeight={CHART_VALUE_LABEL_WEIGHT}
                  style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}
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
        layout={legendLayout}
        items={legendItems.map((item, index) => ({
          key: `${item.name}-${index}`,
          color: item.color,
          label: labelMode === 'both' ? `${item.name}: ${item.value}` : item.name,
        }))}
      />
    </div>
  );
}
