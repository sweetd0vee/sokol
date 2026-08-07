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
};

type LabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  value?: number;
  percent?: number;
};

function DonutValueLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  value = 0,
  percent = 0,
}: LabelProps) {
  if (percent < 0.06 || value <= 0) {
    return null;
  }
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.52;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={13}
      fontWeight={700}
      style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(15, 23, 42, 0.35)' }}
    >
      {value}
    </text>
  );
}

export function FocusableDonutChart({ data, palette = PALETTE }: FocusableDonutChartProps) {
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
            label={DonutValueLabel}
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
            formatter={(value, name) => [value, name]}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
              fontSize: 12,
            }}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
