import { useState } from 'react';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import { getValueBasedColors, PALETTE } from './analyticsPalette';
import { CHART_TOOLTIP_STYLE } from './AnalyticsChartPrimitives';

export type TreemapDatum = {
  name: string;
  value: number;
  fill?: string;
};

type FocusableTreemapChartProps = {
  data: TreemapDatum[];
  palette?: readonly string[];
  /** Map smaller values to lighter shades and larger values to darker shades. */
  colorByValue?: boolean;
};

type TreemapNodeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  fill?: string;
  activeName?: string | null;
  onActivate?: (name: string | null) => void;
};

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
  activeName = null,
  onActivate,
}: TreemapNodeProps) {
  if (width <= 0 || height <= 0) {
    return null;
  }

  const isDimmed = activeName !== null && activeName !== name;
  const isActive = activeName === name;
  const showLabel = width >= 42 && height >= 32;
  const textColor = '#ffffff';
  const labelOpacity = isDimmed ? 0.55 : 1;
  const labelFontSize = width < 100 ? 11 : 12;
  const labelLineHeight = labelFontSize + 3;
  const maxCharsPerLine = Math.max(6, Math.floor((width - 16) / (labelFontSize * 0.58)));
  const labelLines = wrapTreemapLabel(name, maxCharsPerLine);
  const firstLabelY = y + 16;
  const valueY = firstLabelY + labelLines.length * labelLineHeight + 2;

  return (
    <g
      onMouseEnter={() => onActivate?.(name)}
      style={{ cursor: 'pointer' }}
    >
      <title>{`${name}: ${value}`}</title>
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
}: FocusableTreemapChartProps) {
  const [activeName, setActiveName] = useState<string | null>(null);
  const colors = palette.length > 0 ? palette : PALETTE;
  const valueColors = colorByValue ? getValueBasedColors(data.map((item) => item.value), colors) : [];
  const chartData = data.map((item, index) => ({
    ...item,
    fill: item.fill ?? (colorByValue ? valueColors[index] : colors[index % colors.length]),
  }));

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
            formatter={(value, name) => [value, name]}
            contentStyle={CHART_TOOLTIP_STYLE}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
