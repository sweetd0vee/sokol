import { useEffect, useMemo, useRef, useState } from 'react';
import { Pin, X } from 'lucide-react';
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
  CHART_TOOLTIP_STYLE,
  ChartRechartsSquareLegend,
} from './AnalyticsChartPrimitives';
import { MONITORING_STATUS_COLORS } from './analyticsPalette';

const RIGHT_MARGIN = 108;
const HIDE_DELAY_MS = 220;

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
    <aside
      className="absolute right-1 top-1 z-20 flex max-h-[calc(100%-0.5rem)] w-[min(100%-0.5rem,20rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
      style={CHART_TOOLTIP_STYLE}
      onMouseEnter={onKeepOpen}
      onMouseLeave={pinned ? undefined : onRequestHide}
    >
      <div className="flex shrink-0 items-start gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-sber-dark">{row.name}</p>
          <p className="text-sm text-slate-700">
            Не решено: {row.unresolved} из {row.total} ({formatUnresolvedShare(row.unresolved, row.total)})
          </p>
        </div>
        <button
          type="button"
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${
            pinned
              ? 'bg-sber-dark/10 text-sber-dark'
              : 'text-slate-500 hover:bg-slate-100 hover:text-sber-dark'
          }`}
          aria-label={pinned ? 'Открепить список проверок' : 'Закрепить список проверок'}
          aria-pressed={pinned}
          title={pinned ? 'Открепить' : 'Закрепить'}
          onClick={onPinToggle}
        >
          <Pin className="h-3.5 w-3.5" fill={pinned ? 'currentColor' : 'none'} />
        </button>
        {pinned ? (
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-sber-dark"
            aria-label="Закрыть список проверок"
            title="Закрыть"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2" onPointerDown={onPin}>
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
      </div>
      <p className="shrink-0 border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500">
        {pinned ? 'Закреплено — можно прокрутить весь список' : 'Нажмите столбец или кнопку, чтобы закрепить'}
      </p>
    </aside>
  );
}

export function AuditorUnresolvedBarChart({
  data,
  categoryWidth = 128,
}: {
  data: DvaAuditorExecutionRow[];
  categoryWidth?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [pinnedName, setPinnedName] = useState<string | null>(null);

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

  const visibleName = pinnedName ?? activeName;
  const visibleRow = visibleName ? (rowsByName.get(visibleName) ?? null) : null;
  const visibleChecks = visibleName ? (checksByName.get(visibleName) ?? []) : [];

  const cancelHide = () => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const requestHide = () => {
    if (pinnedName) {
      return;
    }
    cancelHide();
    hideTimerRef.current = window.setTimeout(() => {
      setActiveName(null);
    }, HIDE_DELAY_MS);
  };

  const pinVisible = () => {
    if (!visibleName) {
      return;
    }
    cancelHide();
    setPinnedName(visibleName);
    setActiveName(visibleName);
  };

  const closePanel = () => {
    cancelHide();
    setPinnedName(null);
    setActiveName(null);
  };

  useEffect(() => {
    return () => cancelHide();
  }, []);

  useEffect(() => {
    if (!pinnedName) {
      return undefined;
    }
    const handlePointer = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      setPinnedName(null);
      setActiveName(null);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPinnedName(null);
        setActiveName(null);
      }
    };
    window.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [pinnedName]);

  return (
    <div ref={rootRef} className="relative h-full min-h-[13rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: RIGHT_MARGIN, left: 8, bottom: 0 }}
          onMouseMove={(state) => {
            if (pinnedName) {
              return;
            }
            const name = nameFromChartState(state);
            if (!name) {
              return;
            }
            cancelHide();
            setActiveName((current) => (current === name ? current : name));
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
            fill={MONITORING_STATUS_COLORS.unresolved}
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(item) => {
              const name = nameFromBarClick(item);
              if (!name) {
                return;
              }
              cancelHide();
              setActiveName(name);
              setPinnedName((current) => (current === name ? null : name));
            }}
          >
            {chartData.map((row) => (
              <Cell
                key={row.name}
                fill={MONITORING_STATUS_COLORS.unresolved}
                fillOpacity={visibleName && visibleName !== row.name ? 0.35 : 1}
              />
            ))}
            <LabelList dataKey="label" position="right" fill="#111827" fontSize={13} fontWeight={700} />
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
              setPinnedName(null);
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
