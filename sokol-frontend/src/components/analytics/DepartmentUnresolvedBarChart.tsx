import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PlanningUnresolvedDepartmentRow } from '../../api/analytics';
import { formatUnresolvedCheckLine } from '../../utils/dvaAnalytics';
import {
  CHART_AXIS_TICK,
  CHART_CATEGORY_AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  CHART_VALUE_LABEL_SIZE,
  CHART_VALUE_LABEL_WEIGHT,
} from './AnalyticsChartPrimitives';
import { MONITORING_STATUS_COLORS } from './analyticsPalette';

const CATEGORY_WIDTH = 188;
const NAME_MAX_CHARS = 28;
const BAR_COLOR = MONITORING_STATUS_COLORS.unresolved;

function truncateDepartmentName(name: string) {
  if (name.length <= NAME_MAX_CHARS) {
    return name;
  }
  return `${name.slice(0, NAME_MAX_CHARS - 1)}…`;
}

function DepartmentAxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string };
}) {
  const full = String(payload?.value ?? '');
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text
        x={-4}
        dy={4}
        textAnchor="end"
        fill="#64748B"
        fontSize={CHART_CATEGORY_AXIS_TICK.fontSize}
      >
        {truncateDepartmentName(full)}
      </text>
    </g>
  );
}

function UnresolvedDepartmentTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: PlanningUnresolvedDepartmentRow }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  return (
    <div className="max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg" style={CHART_TOOLTIP_STYLE}>
      <p className="text-sm font-semibold text-sber-dark">{row.name}</p>
      <p className="mt-0.5 text-sm text-slate-700">Не решено: {row.value}</p>
      {row.checks.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Нет ключей проверок</p>
      ) : (
        <>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Проверки</p>
          <ul className="mt-1 max-h-44 space-y-1 overflow-auto">
            {row.checks.map((item) => (
              <li key={item.key} className="text-sm leading-snug text-slate-700">
                {formatUnresolvedCheckLine(item)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function DepartmentUnresolvedBarChart({
  data,
}: {
  data: PlanningUnresolvedDepartmentRow[];
}) {
  const chartData = useMemo(() => data.filter((row) => row.value > 0), [data]);

  return (
    <div className="h-full min-h-[13rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          barCategoryGap={6}
          maxBarSize={32}
          margin={{ top: 8, right: 36, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
          <YAxis
            type="category"
            dataKey="name"
            width={CATEGORY_WIDTH}
            interval={0}
            tick={<DepartmentAxisTick />}
          />
          <Tooltip
            cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
            content={<UnresolvedDepartmentTooltip />}
          />
          <Bar dataKey="value" name="Не решено" fill={BAR_COLOR} radius={[0, 6, 6, 0]}>
            <LabelList
              dataKey="value"
              position="right"
              fontSize={CHART_VALUE_LABEL_SIZE}
              fontWeight={CHART_VALUE_LABEL_WEIGHT}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
