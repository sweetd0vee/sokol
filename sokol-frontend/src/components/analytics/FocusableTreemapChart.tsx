import { useState } from 'react';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import { getRankBasedColors, getValueBasedColors, PALETTE } from './analyticsPalette';
import { CHART_TOOLTIP_STYLE } from './AnalyticsChartPrimitives';
import { MATERIALITY_COLORS } from '../../utils/recommendationAnalytics';
import { formatTreemapExportLabel } from '../../utils/treemapExportLabel';

export type TreemapDatum = {
  name: string;
  value: number;
  fill?: string;
  materiality?: {
    низкий: number;
    средний: number;
    высокий: number;
  };
};

type FocusableTreemapChartProps = {
  data: TreemapDatum[];
  palette?: readonly string[];
  /** Map smaller values to lighter shades and larger values to darker shades. */
  colorByValue?: boolean;
  /** Assign distinct palette stops by rank so close values stay visually separate. */
  colorByRank?: boolean;
};

type TreemapNodeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  fill?: string;
  materiality?: TreemapDatum['materiality'];
  activeName?: string | null;
  onActivate?: (name: string | null) => void;
};

function treemapMaterialityDataAttrs(materiality?: TreemapDatum['materiality']) {
  if (!materiality) {
    return {};
  }
  return {
    'data-materiality-high': String(materiality.высокий),
    'data-materiality-medium': String(materiality.средний),
    'data-materiality-low': String(materiality.низкий),
  };
}

function splitLabelToken(token: string, maxChars: number) {
  if (token.length <= maxChars) {
    return [token];
  }

  const chunks: string[] = [];
  for (let start = 0; start < token.length; start += maxChars) {
    chunks.push(token.slice(start, start + maxChars));
  }
  return chunks;
}

function wrapTreemapLabel(label: string, maxChars: number) {
  const words = label.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  words.flatMap((word) => splitLabelToken(word, maxChars)).forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxChars) {
      currentLine = nextLine;
      return;
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [label];
}

function TreemapContent({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name = '',
  value = 0,
  fill = '#2563EB',
  materiality,
  activeName = null,
  onActivate,
}: TreemapNodeProps) {
  if (width <= 0 || height <= 0) {
    return null;
  }

  function hexToRgb(color: string) {
    const normalized = color.trim().replace('#', '');
    if (normalized.length !== 6) {
      return { red: 0, green: 0, blue: 0 };
    }
    return {
      red: Number.parseInt(normalized.slice(0, 2), 16),
      green: Number.parseInt(normalized.slice(2, 4), 16),
      blue: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }

  function getContrastingTextColor(backgroundFill: string) {
    const { red, green, blue } = hexToRgb(backgroundFill);
    // Relative luminance (sRGB)
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    return luminance < 0.6 ? '#FFFFFF' : '#000000';
  }

  const isDimmed = activeName !== null && activeName !== name;
  const isActive = activeName === name;
  const showLabel = width >= 42 && height >= 32;
  // Dashboard treemap labels should be readable against dark fills,
  // but match the requested "black text" visual design.
  const textColor = getContrastingTextColor(fill);
  const labelOpacity = isDimmed ? 0.55 : 1;
  const labelFontSize = width < 100 ? 11 : 12;
  const labelLineHeight = labelFontSize + 3;
  const maxCharsPerLine = Math.max(6, Math.floor((width - 16) / (labelFontSize * 0.58)));
  const labelLines = wrapTreemapLabel(name, maxCharsPerLine);
  const firstLabelY = y + 16;
  const valueY = firstLabelY + labelLines.length * labelLineHeight + 2;
  const exportLabel = formatTreemapExportLabel(name, value, materiality);

  return (
    <g
      onMouseEnter={() => onActivate?.(name)}
      style={{ cursor: 'pointer' }}
    >
      <title>{exportLabel}</title>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={isDimmed ? 0.32 : 1}
        stroke={isActive ? '#0f172a' : '#ffffff'}
        strokeWidth={isActive ? 2.5 : 2}
        rx={showLabel ? 8 : 0}
        data-name={name}
        data-value={String(value)}
        aria-label={exportLabel}
        {...treemapMaterialityDataAttrs(materiality)}
        style={{
          filter: isDimmed
            ? 'brightness(0.72) saturate(0.85)'
            : isActive
              ? 'brightness(1.04)'
              : undefined,
          transition: 'fill-opacity 160ms ease, filter 160ms ease, stroke-width 160ms ease',
        }}
      />
      {showLabel ? (
        <>
          <text
            x={x + 8}
            y={firstLabelY}
            fill={textColor}
            fontSize={labelFontSize}
            fontWeight={700}
            style={{ pointerEvents: 'none', opacity: labelOpacity }}
          >
            {labelLines.map((line, index) => (
              <tspan key={`${line}-${index}`} x={x + 8} dy={index === 0 ? 0 : labelLineHeight}>
                {line}
              </tspan>
            ))}
          </text>
          <text
            x={x + 8}
            y={valueY}
            fill={textColor}
            fontSize={15}
            style={{ pointerEvents: 'none', opacity: labelOpacity }}
          >
            {value}
          </text>
        </>
      ) : null}
    </g>
  );
}

export function FocusableTreemapChart({
  data,
  palette = PALETTE,
  colorByValue = false,
  colorByRank = false,
}: FocusableTreemapChartProps) {
  const [activeName, setActiveName] = useState<string | null>(null);
  const colors = palette.length > 0 ? palette : PALETTE;
  const values = data.map((item) => item.value);
  const valueColors = colorByRank
    ? getRankBasedColors(values, colors)
    : colorByValue
      ? getValueBasedColors(values, colors)
      : [];
  const chartData = data.map((item, index) => ({
    ...item,
    fill: item.fill ?? (colorByRank || colorByValue ? valueColors[index] : colors[index % colors.length]),
  }));
  const tooltipFormatter = (
    value: unknown,
    _name: unknown,
    props?: { payload?: TreemapDatum },
  ) => {
    const payload = props?.payload;
    const materiality = payload?.materiality;
    const numericValue = typeof value === 'number' ? value : Number(value);
    const total = Number.isFinite(numericValue) ? numericValue : payload?.value ?? 0;
    if (!materiality) {
      return [total, 'Количество рекомендаций'];
    }
    return [
      <>
        <div className="font-semibold text-gray-900">Всего: {total}</div>
        <div className="mt-1 font-medium" style={{ color: MATERIALITY_COLORS.высокий }}>
          Высокий: {materiality.высокий}
        </div>
        <div className="font-medium" style={{ color: MATERIALITY_COLORS.средний }}>
          Средний: {materiality.средний}
        </div>
        <div className="font-medium" style={{ color: MATERIALITY_COLORS.низкий }}>
          Низкий: {materiality.низкий}
        </div>
      </>,
      'Рекомендации',
    ];
  };

  return (
    <div
      className="h-full min-h-[13rem]"
      onMouseLeave={() => setActiveName(null)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={chartData}
          dataKey="value"
          nameKey="name"
          isAnimationActive={false}
          content={<TreemapContent activeName={activeName} onActivate={setActiveName} />}
        >
          <Tooltip
            formatter={tooltipFormatter}
            labelFormatter={(label) => `Департамент: ${label}`}
            contentStyle={CHART_TOOLTIP_STYLE}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
