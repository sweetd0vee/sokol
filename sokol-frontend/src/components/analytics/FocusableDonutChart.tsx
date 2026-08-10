import { useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PALETTE } from './analyticsPalette';

export type DonutDatum = {
  name: string;
  value: number;
  color?: string;
};

type FocusableDonutChartProps = {
  data: DonutDatum[];
  palette?: readonly string[];
  showPercentInLabel?: boolean;
  /** When false, values appear only in the hover tooltip. */
  showValueLabels?: boolean;
};

type LabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  value?: number;
  percent?: number;
  showPercent?: boolean;
  fill?: string;
  payload?: DonutDatum;
};

function parseColor(color?: string): [number, number, number] | null {
  if (!color) {
    return null;
  }
  const normalized = color.trim();
  if (normalized.startsWith('#')) {
    const hex = normalized.slice(1);
    if (hex.length === 3) {
      return [
        Number.parseInt(hex[0] + hex[0], 16),
        Number.parseInt(hex[1] + hex[1], 16),
        Number.parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length === 6) {
      return [
        Number.parseInt(hex.slice(0, 2), 16),
        Number.parseInt(hex.slice(2, 4), 16),
        Number.parseInt(hex.slice(4, 6), 16),
      ];
    }
  }
  const rgbMatch = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }
  return null;
}

function isLightFill(color?: string) {
  const rgb = parseColor(color);
  if (!rgb) {
    return true;
  }
  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62;
}

function DonutValueLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  value = 0,
  percent = 0,
  showPercent = false,
  fill,
  payload,
}: LabelProps) {
  if (percent < 0.06 || value <= 0) {
    return null;
  }
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.52;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const segmentFill = payload?.color ?? fill;
  const lightBackground = isLightFill(segmentFill);
  const textColor = lightBackground ? '#1e293b' : '#ffffff';
  const percentLabel = `${Math.round(percent * 100)}%`;

  return (
    <g style={{ pointerEvents: 'none' }}>
      <text
        x={x}
        y={y}
        fill={textColor}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={showPercent ? 14 : 15}
        fontWeight={700}
      >
        {showPercent ? percentLabel : value}
      </text>
    </g>
  );
}

export function FocusableDonutChart({
  data,
  palette = PALETTE,
  showPercentInLabel = false,
  showValueLabels = true,
}: FocusableDonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const colors = palette.length > 0 ? palette : PALETTE;

  return (
    <div className="h-full min-h-[13rem]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="44%"
            innerRadius="48%"
            outerRadius="78%"
            paddingAngle={2.5}
            cornerRadius={4}
            stroke="#ffffff"
            strokeWidth={2}
            label={
              showValueLabels
                ? (props) => <DonutValueLabel {...props} showPercent={showPercentInLabel} />
                : false
            }
            labelLine={false}
            isAnimationActive={false}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((entry, index) => {
              const isDimmed = activeIndex !== null && activeIndex !== index;
              const isActive = activeIndex === index;
              return (
                <Cell
                  key={entry.name}
                  fill={entry.color ?? colors[index % colors.length]}
                  fillOpacity={isDimmed ? 0.32 : 1}
                  stroke={isActive ? '#0f172a' : '#ffffff'}
                  strokeWidth={isActive ? 2.5 : 2}
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
              const total = data.reduce((sum, entry) => sum + entry.value, 0);
              const percent = total > 0 ? Math.round((numericValue / total) * 100) : 0;
              const displayValue = showPercentInLabel ? `${numericValue} (${percent}%)` : numericValue;
              return [displayValue, payload?.name ?? name];
            }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
              fontSize: 13,
            }}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 13, paddingTop: 4 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
