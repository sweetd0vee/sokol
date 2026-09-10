import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Pin, X } from 'lucide-react';
import type { PlanningHighMaterialityDepartmentRow } from '../../api/analytics';
import {
  formatLifecycleChecksCount,
  formatUnresolvedCheckLine,
  formatUnresolvedShare,
} from '../../utils/dvaAnalytics';
import type { SortDirection } from '../../utils/listTable';
import {
  CHART_AXIS_TICK,
  CHART_CATEGORY_AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  CHART_VALUE_LABEL_SIZE,
  CHART_VALUE_LABEL_WEIGHT,
  ChartLegend,
} from './AnalyticsChartPrimitives';
import {
  cycleHighMaterialitySort,
  DEFAULT_HIGH_MATERIALITY_SORT,
  highMaterialityMetric,
  highMaterialityShare,
  highMaterialitySortInsight,
  sortHighMaterialityRows,
} from './highMaterialityRanking';

const HIDE_DELAY_MS = 220;
export const PLANNING_HIGH_MATERIALITY_COLOR = '#FF4347';
const SHARE_TRACK_COLOR = '#FCA5A5';
const GRID_COLUMNS = 'minmax(10.5rem, 0.32fr) minmax(0, 1fr) 3.6rem 4.4rem';

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

function MetricSortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  const sortLabel = active
    ? direction === 'desc'
      ? `Сортировать по возрастанию: ${label}`
      : `Сортировать по убыванию: ${label}`
    : `Сортировать по убыванию: ${label}`;
  return (
    <button
      type="button"
      className={`inline-flex w-full items-center justify-end gap-0.5 text-right text-xs font-semibold leading-tight transition ${
        active ? 'text-sber-dark' : 'text-slate-500 hover:text-sber-dark'
      }`}
      title={sortLabel}
      aria-label={sortLabel}
      aria-pressed={active}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <span>{label}</span>
      {active ? (
        direction === 'asc' ? (
          <ArrowUp size={13} aria-hidden />
        ) : (
          <ArrowDown size={13} aria-hidden />
        )
      ) : (
        <ChevronsUpDown size={13} className="text-slate-400" aria-hidden />
      )}
    </button>
  );
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
  const [sort, setSort] = useState(DEFAULT_HIGH_MATERIALITY_SORT);

  const chartData = useMemo(
    () => sortHighMaterialityRows(
      data.filter((row) => row.value > 0),
      sort,
    ),
    [data, sort],
  );
  const rowsByName = useMemo(() => new Map(chartData.map((row) => [row.name, row])), [chartData]);
  const maxCount = useMemo(
    () => Math.max(1, ...chartData.map((row) => row.value)),
    [chartData],
  );
  const maxMetric = useMemo(
    () => niceMax(Math.max(0, ...chartData.map((row) => highMaterialityMetric(row, sort.key)))),
    [chartData, sort.key],
  );
  const ticks = useMemo(() => axisTicks(maxMetric), [maxMetric]);

  const visibleName = pinnedName ?? activeName;
  const visibleRow = visibleName ? (rowsByName.get(visibleName) ?? null) : null;

  const rankLegend =
    sort.key === 'share' ? 'Доля красных' : sort.key === 'checks' ? 'Проверки' : 'Количество красных';
  const contextLegend =
    sort.key === 'share' ? 'Количество красных' : 'Доля от рекомендаций департамента';

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
        <div
          className="sticky top-0 z-10 grid items-end gap-x-4 bg-white pb-1 pt-0.5"
          style={{ gridTemplateColumns: GRID_COLUMNS }}
        >
          <div className="flex flex-col items-end text-right">
            <p className="text-xs font-semibold text-sber-dark">Департамент</p>
            <MetricSortButton
              label="Проверки"
              active={sort.key === 'checks'}
              direction={sort.direction}
              onClick={() => setSort((prev) => cycleHighMaterialitySort(prev, 'checks'))}
            />
          </div>
          <div />
          <MetricSortButton
            label="Кол-во"
            active={sort.key === 'value'}
            direction={sort.direction}
            onClick={() => setSort((prev) => cycleHighMaterialitySort(prev, 'value'))}
          />
          <MetricSortButton
            label="Доля"
            active={sort.key === 'share'}
            direction={sort.direction}
            onClick={() => setSort((prev) => cycleHighMaterialitySort(prev, 'share'))}
          />
        </div>
        <div className="flex flex-col">
          {chartData.map((row, index) => {
            const isActive = visibleName === row.name;
            const muted = Boolean(visibleName) && !isActive;
            const rankWidth = `${(highMaterialityMetric(row, sort.key) / maxMetric) * 100}%`;
            const contextWidth =
              sort.key === 'share'
                ? `${(row.value / maxCount) * 100}%`
                : `${Math.max(0, Math.min(100, highMaterialityShare(row)))}%`;
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
                  className={`relative flex min-h-[2.75rem] flex-col justify-center gap-1 border-b border-l border-slate-200/80 ${
                    index === 0 ? 'border-t' : ''
                  } ${isActive ? 'bg-slate-100/90' : 'bg-slate-50/80'}`}
                >
                  <PlotGrid ticks={ticks} max={maxMetric} />
                  <div
                    className="relative z-[1] h-6 rounded-r-md"
                    style={{
                      width: rankWidth,
                      backgroundColor: PLANNING_HIGH_MATERIALITY_COLOR,
                      opacity: muted ? 0.35 : 1,
                    }}
                  />
                  <div
                    className="relative z-[1] h-1.5 overflow-hidden rounded-full bg-slate-200/90"
                    style={{ opacity: muted ? 0.35 : 1 }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: contextWidth, backgroundColor: SHARE_TRACK_COLOR }}
                    />
                  </div>
                </div>
                <p
                  className={`flex items-center justify-end border-b border-slate-200/80 tabular-nums ${
                    index === 0 ? 'border-t' : ''
                  } ${isActive ? 'bg-slate-100/90' : ''} ${
                    sort.key === 'value' ? 'text-sber-dark' : 'text-slate-600'
                  }`}
                  style={{
                    fontSize: CHART_VALUE_LABEL_SIZE,
                    fontWeight: sort.key === 'value' ? 600 : CHART_VALUE_LABEL_WEIGHT,
                    opacity: muted ? 0.45 : 1,
                  }}
                >
                  {row.value}
                </p>
                <p
                  className={`flex items-center justify-end border-b border-slate-200/80 tabular-nums ${
                    index === 0 ? 'border-t' : ''
                  } ${isActive ? 'bg-slate-100/90' : ''} ${
                    sort.key === 'share' ? 'text-sber-dark' : 'text-slate-500'
                  }`}
                  style={{
                    fontSize: CHART_VALUE_LABEL_SIZE,
                    fontWeight: sort.key === 'share' ? 600 : CHART_VALUE_LABEL_WEIGHT,
                    opacity: muted ? 0.45 : 1,
                  }}
                >
                  {formatUnresolvedShare(row.value, row.total)}
                </p>
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
        <div className="relative h-6">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute top-0 -translate-x-1/2 text-slate-500 first:translate-x-0 last:translate-x-[-100%]"
              style={{ left: `${(tick / maxMetric) * 100}%`, fontSize: CHART_AXIS_TICK.fontSize }}
            >
              {sort.key === 'share' ? `${tick}%` : tick}
            </span>
          ))}
        </div>
        <div />
        <div />
      </div>
      <div className="shrink-0 px-4 pb-1">
        <ChartLegend
          layout="row"
          items={[
            { key: 'rank', color: PLANNING_HIGH_MATERIALITY_COLOR, label: rankLegend },
            { key: 'context', color: SHARE_TRACK_COLOR, label: contextLegend },
          ]}
        />
        <p className="pb-1 text-center text-xs text-slate-500">{highMaterialitySortInsight(sort)}</p>
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
