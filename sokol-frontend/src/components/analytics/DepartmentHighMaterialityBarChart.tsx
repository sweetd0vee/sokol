import { useEffect, useMemo, useRef, useState } from 'react';
import { Pin, X } from 'lucide-react';
import type { PlanningHighMaterialityDepartmentRow } from '../../api/analytics';
import {
  formatLifecycleChecksCount,
  formatUnresolvedBarLabel,
  formatUnresolvedCheckLine,
  formatUnresolvedShare,
} from '../../utils/dvaAnalytics';
import {
  CHART_AXIS_TICK,
  CHART_CATEGORY_AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  CHART_VALUE_LABEL_SIZE,
  CHART_VALUE_LABEL_WEIGHT,
  ChartLegend,
} from './AnalyticsChartPrimitives';

const HIDE_DELAY_MS = 220;
export const PLANNING_HIGH_MATERIALITY_COLOR = '#FF4347';
const GRID_COLUMNS = 'minmax(10.5rem, 0.34fr) minmax(0, 1fr)';

function niceMax(value: number) {
  if (value <= 0) {
    return 5;
  }
  const step = value <= 10 ? 2 : 5;
  const rounded = Math.ceil(value / step) * step;
  return rounded === value ? rounded + step : rounded;
}

function axisTicks(max: number) {
  const step = max <= 10 ? 2 : 5;
  const ticks: number[] = [];
  for (let value = 0; value <= max; value += step) {
    ticks.push(value);
  }
  return ticks;
}

function HighMaterialityChecksPanel({
  row,
  pinned,
  onPin,
  onPinToggle,
  onClose,
  onKeepOpen,
  onRequestHide,
}: {
  row: PlanningHighMaterialityDepartmentRow;
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
            Красные: {row.value} из {row.total} ({formatUnresolvedShare(row.value, row.total)})
          </p>
          <p className="text-sm text-slate-500">{formatLifecycleChecksCount(row.checks.length)}</p>
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
        {row.checks.length === 0 ? (
          <p className="text-sm text-slate-500">Нет ключей проверок</p>
        ) : (
          <>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Проверки</p>
            <ul className="space-y-1">
              {row.checks.map((item) => (
                <li key={item.key} className="text-sm leading-snug text-slate-700">
                  {formatUnresolvedCheckLine(item)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}

function PlotGrid({ ticks, max }: { ticks: number[]; max: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {ticks.map((tick) =>
        tick === 0 ? null : (
          <div
            key={tick}
            className="absolute inset-y-0 w-px bg-slate-200/70"
            style={{ left: `${(tick / max) * 100}%` }}
          />
        ),
      )}
    </div>
  );
}

export function DepartmentHighMaterialityBarChart({
  data,
}: {
  data: PlanningHighMaterialityDepartmentRow[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [pinnedName, setPinnedName] = useState<string | null>(null);

  const chartData = useMemo(() => data.filter((row) => row.value > 0), [data]);
  const rowsByName = useMemo(() => new Map(chartData.map((row) => [row.name, row])), [chartData]);
  const maxValue = useMemo(
    () => niceMax(Math.max(0, ...chartData.map((row) => row.value))),
    [chartData],
  );
  const ticks = useMemo(() => axisTicks(maxValue), [maxValue]);

  const visibleName = pinnedName ?? activeName;
  const visibleRow = visibleName ? (rowsByName.get(visibleName) ?? null) : null;

  const cancelHide = () => {
    if (hideTimerRef.current !== null) {
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

  const showRow = (name: string) => {
    if (pinnedName) {
      return;
    }
    cancelHide();
    setActiveName((current) => (current === name ? current : name));
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
    <div ref={rootRef} className="relative flex h-full min-h-0 max-h-[22rem] flex-col lg:max-h-none">
      <div className="min-h-0 flex-1 overflow-y-auto px-4" onMouseLeave={requestHide}>
        <div className="flex flex-col">
          {chartData.map((row, index) => {
            const isActive = visibleName === row.name;
            const muted = Boolean(visibleName) && !isActive;
            const barWidth = `${(row.value / maxValue) * 100}%`;
            const shareWidth = `${Math.max(0, Math.min(100, (row.value / Math.max(row.total, 1)) * 100))}%`;
            return (
              <div
                key={row.name}
                className="grid cursor-pointer items-stretch gap-x-4"
                style={{ gridTemplateColumns: GRID_COLUMNS }}
                onMouseEnter={() => showRow(row.name)}
                onClick={() => {
                  cancelHide();
                  setActiveName(row.name);
                  setPinnedName((current) => (current === row.name ? null : row.name));
                }}
              >
                <div className="flex flex-col items-end justify-center py-1.5 text-right">
                  <p
                    className="leading-snug text-slate-600"
                    style={{ fontSize: CHART_CATEGORY_AXIS_TICK.fontSize }}
                  >
                    {row.name}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-slate-400">
                    {formatLifecycleChecksCount(row.checks.length)}
                  </p>
                </div>
                <div
                  className={`relative flex min-h-[2.75rem] flex-col justify-center gap-1 border-b border-l border-slate-200/80 pr-[5.75rem] ${
                    index === 0 ? 'border-t' : ''
                  } ${isActive ? 'bg-slate-100/90' : 'bg-slate-50/80'}`}
                >
                  <PlotGrid ticks={ticks} max={maxValue} />
                  <div
                    className="relative z-[1] h-6 rounded-r-md"
                    style={{
                      width: barWidth,
                      backgroundColor: PLANNING_HIGH_MATERIALITY_COLOR,
                      opacity: muted ? 0.35 : 1,
                    }}
                  />
                  <div
                    className="relative z-[1] h-1.5 overflow-hidden rounded-full bg-slate-200/90"
                    style={{ opacity: muted ? 0.35 : 1 }}
                  >
                    <div
                      className="h-full rounded-full bg-red-300"
                      style={{ width: shareWidth }}
                    />
                  </div>
                  <span
                    className="absolute z-[1] -translate-y-1/2 text-slate-700"
                    style={{
                      top: '50%',
                      right: 8,
                      fontSize: CHART_VALUE_LABEL_SIZE,
                      fontWeight: CHART_VALUE_LABEL_WEIGHT,
                    }}
                  >
                    {formatUnresolvedBarLabel(row.value, row.total)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        className="grid shrink-0 gap-x-4 px-4 pb-1 pt-0.5"
        style={{ gridTemplateColumns: GRID_COLUMNS }}
      >
        <div />
        <div className="relative h-6 pr-[5.75rem]">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute top-0 -translate-x-1/2 text-slate-500 first:translate-x-0 last:translate-x-[-100%]"
              style={{ left: `${(tick / maxValue) * 100}%`, fontSize: CHART_AXIS_TICK.fontSize }}
            >
              {tick}
            </span>
          ))}
        </div>
      </div>
      <div className="shrink-0 px-4 pb-1">
        <ChartLegend
          layout="row"
          items={[
            { key: 'count', color: PLANNING_HIGH_MATERIALITY_COLOR, label: 'Количество красных' },
            { key: 'share', color: '#FCA5A5', label: 'Доля от рекомендаций департамента' },
          ]}
        />
        <p className="pb-1 text-center text-xs text-slate-500">
          Подпись: количество · доля. Наведите на строку, чтобы увидеть проверки за период.
        </p>
      </div>
      {visibleRow ? (
        <HighMaterialityChecksPanel
          row={visibleRow}
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
