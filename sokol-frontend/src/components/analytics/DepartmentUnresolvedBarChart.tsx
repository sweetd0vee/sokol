import { useEffect, useMemo, useRef, useState } from 'react';
import { Pin, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
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

const LABEL_SHARE = 0.55;
const MIN_CATEGORY_WIDTH = 280;
const MIN_PLOT_WIDTH = 140;
const CHART_LEFT_MARGIN = 4;
const CHART_RIGHT_MARGIN = 36;
const AVG_CHAR_PX = 8.2;
const NAME_MAX_LINES = 2;
const LABEL_LINE_HEIGHT = 15;
const HIDE_DELAY_MS = 220;
const BAR_COLOR = MONITORING_STATUS_COLORS.unresolved;

function categoryWidthFromContainer(containerWidth: number) {
  if (containerWidth <= 0) {
    return 360;
  }
  const reserved = CHART_LEFT_MARGIN + CHART_RIGHT_MARGIN + MIN_PLOT_WIDTH;
  const maxAllowed = Math.max(160, containerWidth - reserved);
  const byShare = Math.round(containerWidth * LABEL_SHARE);
  return Math.min(Math.max(byShare, Math.min(MIN_CATEGORY_WIDTH, maxAllowed)), maxAllowed);
}

function wrapDepartmentName(name: string, maxCharsPerLine: number, maxLines = NAME_MAX_LINES) {
  const limit = Math.max(8, maxCharsPerLine);
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  const pushWord = (word: string) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= limit) {
      current = next;
      return;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
  };

  words.forEach((word) => {
    if (word.length <= limit) {
      pushWord(word);
      return;
    }
    for (let start = 0; start < word.length; start += limit) {
      pushWord(word.slice(start, start + limit));
    }
  });

  if (current) {
    lines.push(current);
  }

  if (lines.length <= maxLines) {
    return lines.length > 0 ? lines : [name];
  }

  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1] ?? '';
  kept[maxLines - 1] = last.endsWith('…')
    ? last
    : `${last.slice(0, Math.max(1, limit - 1))}…`;
  return kept;
}

function nameFromChartState(state: { activeLabel?: unknown } | null | undefined): string | null {
  return typeof state?.activeLabel === 'string' ? state.activeLabel : null;
}

function nameFromBarClick(item: { name?: unknown; payload?: { name?: unknown } }): string | null {
  if (typeof item.payload?.name === 'string') {
    return item.payload.name;
  }
  return typeof item.name === 'string' ? item.name : null;
}

function DepartmentAxisTick({
  x = 0,
  y = 0,
  payload,
  maxCharsPerLine = 40,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string };
  maxCharsPerLine?: number;
}) {
  const full = String(payload?.value ?? '');
  const lines = wrapDepartmentName(full, maxCharsPerLine);
  const startDy = lines.length === 1 ? 4 : 4 - ((lines.length - 1) * LABEL_LINE_HEIGHT) / 2;

  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text
        x={-4}
        textAnchor="end"
        fill="#64748B"
        fontSize={CHART_CATEGORY_AXIS_TICK.fontSize}
      >
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={-4} dy={index === 0 ? startDy : LABEL_LINE_HEIGHT}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function UnresolvedChecksPanel({
  row,
  pinned,
  onPin,
  onPinToggle,
  onClose,
  onKeepOpen,
  onRequestHide,
}: {
  row: PlanningUnresolvedDepartmentRow;
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
          <p className="text-sm text-slate-700">Не решено: {row.value}</p>
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

export function DepartmentUnresolvedBarChart({
  data,
}: {
  data: PlanningUnresolvedDepartmentRow[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [pinnedName, setPinnedName] = useState<string | null>(null);

  const chartData = useMemo(() => data.filter((row) => row.value > 0), [data]);
  const rowsByName = useMemo(() => new Map(chartData.map((row) => [row.name, row])), [chartData]);
  const categoryWidth = categoryWidthFromContainer(containerWidth);
  const maxCharsPerLine = Math.max(12, Math.floor((categoryWidth - 12) / AVG_CHAR_PX));
  const chartHeight = Math.max(208, chartData.length * 44 + 16);

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

  useEffect(() => {
    return () => cancelHide();
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) {
      return undefined;
    }
    const update = () => setContainerWidth(node.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
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
      <div className="h-full overflow-auto">
        <div style={{ height: chartHeight, minHeight: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              barCategoryGap={8}
              maxBarSize={28}
              margin={{ top: 8, right: CHART_RIGHT_MARGIN, left: CHART_LEFT_MARGIN, bottom: 0 }}
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
              <YAxis
                type="category"
                dataKey="name"
                width={categoryWidth}
                interval={0}
                tick={(props) => <DepartmentAxisTick {...props} maxCharsPerLine={maxCharsPerLine} />}
              />
              <Bar
                dataKey="value"
                name="Не решено"
                fill={BAR_COLOR}
                radius={[0, 6, 6, 0]}
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
                    fill={BAR_COLOR}
                    fillOpacity={visibleName && visibleName !== row.name ? 0.35 : 1}
                  />
                ))}
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
      </div>
      {visibleRow ? (
        <UnresolvedChecksPanel
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
