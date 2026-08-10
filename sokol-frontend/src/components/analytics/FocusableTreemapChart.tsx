import { useState } from 'react';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import { PALETTE } from './analyticsPalette';
import { contrastLabelColor } from './chartContrast';

export type TreemapDatum = {
  name: string;
  value: number;
  fill?: string;
};

type FocusableTreemapChartProps = {
  data: TreemapDatum[];
  palette?: readonly string[];
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
  const textColor = contrastLabelColor(fill, false);
  const labelOpacity = isDimmed ? 0.55 : 1;

  return (
    <g
      onMouseEnter={() => onActivate?.(name)}
      style={{ cursor: 'pointer' }}
    >
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
            y={y + 18}
            fill={textColor}
            fontSize={13}
            fontWeight={700}
            style={{ pointerEvents: 'none', opacity: labelOpacity }}
          >
            {name.length > 20 ? `${name.slice(0, 18)}...` : name}
          </text>
          <text
            x={x + 8}
            y={y + 34}
            fill={textColor}
            fontSize={14}
            style={{ pointerEvents: 'none', opacity: labelOpacity }}
          >
            {value}
          </text>
        </>
      ) : null}
    </g>
  );
}

export function FocusableTreemapChart({ data, palette = PALETTE }: FocusableTreemapChartProps) {
  const [activeName, setActiveName] = useState<string | null>(null);
  const colors = palette.length > 0 ? palette : PALETTE;
  const chartData = data.map((item, index) => ({
    ...item,
    fill: item.fill ?? colors[index % colors.length],
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
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
              fontSize: 13,
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
