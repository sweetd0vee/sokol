import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
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
  CHART_VALUE_LABEL_WEIGHT,
} from './chartTokens';
import { ChartRechartsSquareLegend } from './ChartLegend';
import { PinnedChartAside } from './PinnedChartAside';
import { usePinnedChartPanel } from './usePinnedChartPanel';

const BAR_COLOR = '#0E7490';
const RIGHT_MARGIN = 108;

type ChartRow = {
  name: string;
  unresolved: number;
  total: number;
  label: string;
};

function nameFromChartState(state: { activeLabel?: unknown } | null | undefined): string | null {
  return typeof state?.activeLabel === 'string' ? state.activeLabel : null;
}

function nameFromBarClick(item: { name?: unknown; payload?: { name?: unknown } }): string | null {
  if (typeof item.payload?.name === 'string') {
    return item.payload.name;
  }
  return typeof item.name === 'string' ? item.name : null;
}

function UnresolvedChecksPanel({
  row,
  checks,
  pinned,
  onPin,
  onPinToggle,
  onClose,
  onKeepOpen,
  onRequestHide,
}: {
  row: ChartRow;
  checks: DvaCheckCountRef[];
  pinned: boolean;
  onPin: () => void;
  onPinToggle: () => void;
  onClose: () => void;
  onKeepOpen: () => void;
  onRequestHide: () => void;
}) {
  return (
    <PinnedChartAside
      pinned={pinned}
      onPin={onPin}
      onPinToggle={onPinToggle}
      onClose={onClose}
      onKeepOpen={onKeepOpen}
      onRequestHide={onRequestHide}
      header={
        <>
          <p className="text-sm font-semibold text-sber-dark">{row.name}</p>
          <p className="text-sm text-slate-700">
            Не решено: {row.unresolved} из {row.total} ({formatUnresolvedShare(row.unresolved, row.total)})
          </p>
        </>
      }
    >
      {checks.length === 0 ? (
        <p className="text-sm text-slate-500">Нет данных по проверкам</p>
      ) : (
        <>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Проверки</p>
          <ul className="space-y-1">
            {checks.map((item) => (
              <li key={item.key} className="text-sm leading-snug text-slate-700">
                {formatUnresolvedCheckLine(item)}
              </li>
            ))}
          </ul>
        </>
      )}
    </PinnedChartAside>
  );
}

export function AuditorUnresolvedBarChart({
  data,
  categoryWidth = 128,
}: {
  data: DvaAuditorExecutionRow[];
  categoryWidth?: number;
}) {
  const {
    rootRef,
    pinnedName,
    visibleName,
    cancelHide,
    requestHide,
    pinVisible,
    unpin,
    closePanel,
    showRow,
    togglePinnedName,
  } = usePinnedChartPanel();

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
  const rowsByName = useMemo(() => new Map(chartData.map((row) => [row.name, row])), [chartData]);
  const visibleRow = visibleName ? (rowsByName.get(visibleName) ?? null) : null;
  const visibleChecks = visibleName ? (checksByName.get(visibleName) ?? []) : [];

  return (
    <div ref={rootRef} className="relative h-full min-h-[10rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          barCategoryGap={4}
          maxBarSize={36}
          margin={{ top: 4, right: RIGHT_MARGIN, left: 8, bottom: 0 }}
          onMouseMove={(state) => {
            const name = nameFromChartState(state);
            if (!name) {
              return;
            }
            showRow(name);
          }}
          onMouseLeave={requestHide}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
          <YAxis type="category" dataKey="name" width={categoryWidth} tick={CHART_CATEGORY_AXIS_TICK} />
          <Legend content={<ChartRechartsSquareLegend />} />
          <Bar
            dataKey="unresolved"
            name="Не решено"
            fill={BAR_COLOR}
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(item) => {
              const name = nameFromBarClick(item);
              if (!name) {
                return;
              }
              togglePinnedName(name);
            }}
          >
            {chartData.map((row) => (
              <Cell
                key={row.name}
                fill={BAR_COLOR}
                fillOpacity={visibleName && visibleName !== row.name ? 0.35 : 1}
              />
            ))}
            <LabelList
              dataKey="label"
              position="right"
              fill="#111827"
              fontSize={13}
              fontWeight={CHART_VALUE_LABEL_WEIGHT}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {visibleRow ? (
        <UnresolvedChecksPanel
          row={visibleRow}
          checks={visibleChecks}
          pinned={pinnedName === visibleRow.name}
          onPin={pinVisible}
          onPinToggle={() => {
            if (pinnedName === visibleRow.name) {
              unpin();
              return;
            }
            pinVisible();
          }}
          onClose={closePanel}
          onKeepOpen={cancelHide}
          onRequestHide={requestHide}
        />
      ) : null}
    </div>
  );
}
