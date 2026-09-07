import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DvaAuditorExecutionRow, DvaCheckCountRef } from '../../api/analytics';
import {
  formatUnresolvedBarLabel,
  formatUnresolvedCheckLine,
  formatUnresolvedShare,
} from '../../utils/dvaAnalytics';
import {
  CHART_AXIS_TICK,
  CHART_CATEGORY_AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  ChartRechartsSquareLegend,
} from './AnalyticsChartPrimitives';
import { MONITORING_STATUS_COLORS } from './analyticsPalette';

const RIGHT_MARGIN = 108;

type ChartRow = {
  name: string;
  unresolved: number;
  total: number;
  label: string;
};

function UnresolvedChecksTooltip({
  active,
  label,
  payload,
  checksByName,
}: {
  active?: boolean;
  label?: string;
  payload?: ReadonlyArray<{ payload?: ChartRow }>;
  checksByName: Map<string, DvaCheckCountRef[]>;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  const checks = checksByName.get(String(label ?? row.name)) ?? [];
  return (
    <div
      className="max-h-72 max-w-sm overflow-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-lg"
      style={CHART_TOOLTIP_STYLE}
    >
      <p className="mb-1 text-sm font-semibold text-sber-dark">{row.name}</p>
      <p className="mb-2 text-sm text-slate-700">
        Не решено: {row.unresolved} из {row.total} ({formatUnresolvedShare(row.unresolved, row.total)})
      </p>
      {checks.length === 0 ? (
        <p className="text-sm text-slate-500">Нет данных по проверкам</p>
      ) : (
        <>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Проверки
          </p>
          <ul className="space-y-1">
            {checks.map((item) => (
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

export function AuditorUnresolvedBarChart({
  data,
  categoryWidth = 128,
}: {
  data: DvaAuditorExecutionRow[];
  categoryWidth?: number;
}) {
  const checksByName = useMemo(
    () => new Map(data.map((row) => [row.name, row.unresolved_checks ?? []])),
    [data],
  );
  const chartData = useMemo<ChartRow[]>(
    () =>
      data.map((row) => ({
        name: row.name,
        unresolved: row.unresolved,
        total: row.total,
        label: formatUnresolvedBarLabel(row.unresolved, row.total),
      })),
    [data],
  );

  return (
    <div className="h-full min-h-[13rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: RIGHT_MARGIN, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
          <YAxis type="category" dataKey="name" width={categoryWidth} tick={CHART_CATEGORY_AXIS_TICK} />
          <Tooltip
            content={(props) => (
              <UnresolvedChecksTooltip
                active={props.active}
                label={typeof props.label === 'string' ? props.label : undefined}
                payload={props.payload as ReadonlyArray<{ payload?: ChartRow }> | undefined}
                checksByName={checksByName}
              />
            )}
          />
          <Legend content={<ChartRechartsSquareLegend />} />
          <Bar
            dataKey="unresolved"
            name="Не решено"
            fill={MONITORING_STATUS_COLORS.unresolved}
            radius={[0, 4, 4, 0]}
          >
            <LabelList
              dataKey="label"
              position="right"
              fill="#111827"
              fontSize={13}
              fontWeight={700}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
