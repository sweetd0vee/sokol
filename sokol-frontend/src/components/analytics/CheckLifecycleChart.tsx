import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { DvaCheckLifecycleRow } from '../../api/analytics';
import { formatRuDate } from '../../utils/dates';
import {
  averageLifecycleDurationDays,
  buildCheckLifecycleChartModel,
  formatDurationDays,
  formatLifecycleChecksByCount,
  formatLifecycleChecksCount,
  sortCheckLifecycleRows,
  type CheckLifecyclePoint,
  type CheckLifecycleSegment,
  type CheckLifecycleSortKey,
  type CheckLifecycleViewRow,
} from '../../utils/dvaAnalytics';
import { VALUE_BLUE_SCALE, VALUE_TEAL_SCALE } from './analyticsPalette';
import { CHART_TOOLTIP_STYLE } from './AnalyticsChartPrimitives';
import { MatrixCountSortHeader, MatrixLegendFooter } from './matrixChartChrome';
import { cycleSortConfig, type SortConfig } from '../../utils/listTable';

/** Same stops as Checks type donut (VALUE_BLUE_SCALE); center keeps signature teal. */
const SEGMENT_STYLE = {
  order_to_program: VALUE_BLUE_SCALE[0], // #93C5FD — light sky
  program_to_az: VALUE_TEAL_SCALE[5], // #0E7490 — signature teal
  az_to_dz: VALUE_BLUE_SCALE[5], // #002B55 — deep navy
} as const;

const POINT_COLOR: Record<string, string> = {
  order: VALUE_BLUE_SCALE[0],
  program: VALUE_TEAL_SCALE[5],
  az: VALUE_TEAL_SCALE[5],
  dz: VALUE_BLUE_SCALE[5],
};

const LEGEND = [
  { key: 'order_to_program', label: 'Приказ → Программа', color: SEGMENT_STYLE.order_to_program },
  { key: 'program_to_az', label: 'Программа → АЗ', color: SEGMENT_STYLE.program_to_az },
  { key: 'az_to_dz', label: 'АЗ → ДЗ', color: SEGMENT_STYLE.az_to_dz },
];

const COL_KEY_PX = 120;
const COL_NAME_PX = 176;
const COL_AUDITOR_PX = 160;
const COL_TOTAL_PX = 120;
/** Minimum horizontal space per month tick so labels stay readable; table scrolls when needed. */
const MONTH_TICK_MIN_PX = 44;
const TIMELINE_SIDE_PAD_PX = 32;
const TIMELINE_MIN_PX = 360;

const STICKY_KEY_CLASS =
  'sticky left-0 z-[5] bg-white group-hover:bg-gray-50';
const STICKY_NAME_CLASS =
  'sticky left-[120px] z-[4] bg-white group-hover:bg-gray-50';
const STICKY_AUDITOR_CLASS =
  'sticky left-[296px] z-[3] bg-white shadow-[2px_0_6px_-2px_rgba(15,23,42,0.14)] group-hover:bg-gray-50';
const STICKY_TOTAL_CLASS =
  'sticky right-0 z-[3] bg-white shadow-[-2px_0_6px_-2px_rgba(15,23,42,0.14)] group-hover:bg-gray-50';

function FloatingTooltip({
  anchor,
  children,
}: {
  anchor: DOMRect;
  children: ReactNode;
}) {
  const showAbove = anchor.bottom + 96 > window.innerHeight;
  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[80] max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-left"
      style={{
        ...CHART_TOOLTIP_STYLE,
        left: Math.min(Math.max(12, anchor.left + anchor.width / 2 - 110), window.innerWidth - 240),
        top: showAbove ? undefined : anchor.bottom + 8,
        bottom: showAbove ? window.innerHeight - anchor.top + 8 : undefined,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

function SegmentTooltip({ segment }: { segment: CheckLifecycleSegment }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold text-sber-dark">{segment.label}</p>
      <p className="text-sm font-normal tabular-nums text-slate-800">{formatDurationDays(segment.days)}</p>
      <p className="text-xs text-slate-500">
        {formatRuDate(segment.startDate)} — {formatRuDate(segment.endDate)}
      </p>
    </div>
  );
}

function PointTooltip({ point }: { point: CheckLifecyclePoint }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold text-sber-dark">{point.label}</p>
      <p className="text-sm tabular-nums text-slate-800">{formatRuDate(point.date)}</p>
    </div>
  );
}

function TimelineTrack({
  row,
  ticks,
}: {
  row: CheckLifecycleViewRow;
  ticks: Array<{ percent: number }>;
}) {
  const [tooltip, setTooltip] = useState<{ anchor: DOMRect; node: ReactNode } | null>(null);

  if (row.points.length === 0) {
    return (
      <div className="flex h-11 items-center px-2">
        <span className="text-xs text-gray-400">даты не указаны</span>
      </div>
    );
  }

  return (
    <div className="relative h-11">
      <div className="absolute inset-y-0 left-3 right-3">
        {ticks.map((tick) => (
          <span
            key={tick.percent}
            className="pointer-events-none absolute top-1.5 bottom-1.5 w-px bg-gray-100"
            style={{ left: `${tick.percent}%` }}
            aria-hidden
          />
        ))}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gray-100" />
        {row.segments.map((segment) => {
          const fill = SEGMENT_STYLE[segment.key as keyof typeof SEGMENT_STYLE] ?? SEGMENT_STYLE.program_to_az;
          return (
            <button
              key={segment.key}
              type="button"
              className="absolute top-1/2 z-[1] h-3.5 -translate-y-1/2 cursor-help rounded-full border-0 p-0"
              style={{
                left: `${segment.leftPercent}%`,
                width: `${Math.max(segment.widthPercent, 0.35)}%`,
                backgroundColor: fill,
              }}
              aria-label={`${segment.label}: ${formatDurationDays(segment.days)}`}
              onMouseEnter={(event) =>
                setTooltip({
                  anchor: event.currentTarget.getBoundingClientRect(),
                  node: <SegmentTooltip segment={segment} />,
                })
              }
              onMouseLeave={() => setTooltip(null)}
              onFocus={(event) =>
                setTooltip({
                  anchor: event.currentTarget.getBoundingClientRect(),
                  node: <SegmentTooltip segment={segment} />,
                })
              }
              onBlur={() => setTooltip(null)}
            />
          );
        })}
        {row.points.map((point) => (
          <button
            key={point.key}
            type="button"
            className="absolute top-1/2 z-[2] h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-help rounded-full border-2 border-white p-0"
            style={{ left: `${point.percent}%`, backgroundColor: POINT_COLOR[point.key] }}
            aria-label={`${point.label}: ${formatRuDate(point.date)}`}
            onMouseEnter={(event) =>
              setTooltip({
                anchor: event.currentTarget.getBoundingClientRect(),
                node: <PointTooltip point={point} />,
              })
            }
            onMouseLeave={() => setTooltip(null)}
            onFocus={(event) =>
              setTooltip({
                anchor: event.currentTarget.getBoundingClientRect(),
                node: <PointTooltip point={point} />,
              })
            }
            onBlur={() => setTooltip(null)}
          />
        ))}
      </div>
      {tooltip ? <FloatingTooltip anchor={tooltip.anchor}>{tooltip.node}</FloatingTooltip> : null}
    </div>
  );
}

export function CheckLifecycleChart({ rows }: { rows: DvaCheckLifecycleRow[] }) {
  const model = useMemo(() => buildCheckLifecycleChartModel(rows), [rows]);
  const [sortConfig, setSortConfig] = useState<SortConfig<CheckLifecycleSortKey>>({
    key: 'totalDays',
    direction: 'desc',
  });
  const sortedRows = useMemo(
    () => sortCheckLifecycleRows(model.rows, sortConfig),
    [model.rows, sortConfig],
  );
  const averageLifecycle = useMemo(
    () => averageLifecycleDurationDays(model.rows),
    [model.rows],
  );
  const timelineMinWidthPx = useMemo(() => {
    const fromTicks = model.ticks.length * MONTH_TICK_MIN_PX + TIMELINE_SIDE_PAD_PX;
    return Math.max(fromTicks, TIMELINE_MIN_PX);
  }, [model.ticks.length]);
  const tableMinWidthPx =
    COL_KEY_PX + COL_NAME_PX + COL_AUDITOR_PX + COL_TOTAL_PX + timelineMinWidthPx;
  const cycleSort = (key: CheckLifecycleSortKey) => {
    setSortConfig((prev) => cycleSortConfig(prev, key));
  };

  return (
    <div data-export-html className="flex min-h-[13rem] min-w-0 flex-col gap-2">
      <div className="min-w-0 w-full overflow-x-auto overscroll-x-contain rounded-lg border border-gray-100">
        <table
          className="border-separate border-spacing-0 text-sm"
          style={{ width: tableMinWidthPx, minWidth: tableMinWidthPx, tableLayout: 'fixed' }}
        >
          <colgroup>
            <col style={{ width: COL_KEY_PX }} />
            <col style={{ width: COL_NAME_PX }} />
            <col style={{ width: COL_AUDITOR_PX }} />
            <col style={{ width: timelineMinWidthPx }} />
            <col style={{ width: COL_TOTAL_PX }} />
          </colgroup>
          <thead>
            <tr className="group border-b border-gray-100">
              <MatrixCountSortHeader
                label="Ключ"
                align="left"
                className={STICKY_KEY_CLASS}
                active={sortConfig.key === 'key'}
                direction={sortConfig.direction}
                onClick={() => cycleSort('key')}
              />
              <MatrixCountSortHeader
                label="Краткое название"
                align="left"
                className={STICKY_NAME_CLASS}
                active={sortConfig.key === 'shortName'}
                direction={sortConfig.direction}
                onClick={() => cycleSort('shortName')}
              />
              <MatrixCountSortHeader
                label="Аудитор"
                align="left"
                className={STICKY_AUDITOR_CLASS}
                active={sortConfig.key === 'auditor'}
                direction={sortConfig.direction}
                onClick={() => cycleSort('auditor')}
              />
              <th
                className="bg-white px-3 py-2 text-left font-semibold text-sber-dark"
                style={{ width: timelineMinWidthPx, minWidth: timelineMinWidthPx }}
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sber-dark transition hover:text-sber"
                  title={
                    sortConfig.key !== 'start'
                      ? 'Сортировать по убыванию: сроки'
                      : sortConfig.direction === 'desc'
                        ? 'Сортировать по возрастанию: сроки'
                        : 'Сбросить сортировку: сроки'
                  }
                  aria-label={
                    sortConfig.key !== 'start'
                      ? 'Сортировать по убыванию: сроки'
                      : sortConfig.direction === 'desc'
                        ? 'Сортировать по возрастанию: сроки'
                        : 'Сбросить сортировку: сроки'
                  }
                  aria-sort={
                    sortConfig.key === 'start'
                      ? sortConfig.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  onClick={() => cycleSort('start')}
                >
                  <span>Сроки</span>
                  {sortConfig.key === 'start' ? (
                    sortConfig.direction === 'asc' ? (
                      <ArrowUp size={14} aria-hidden />
                    ) : (
                      <ArrowDown size={14} aria-hidden />
                    )
                  ) : (
                    <ChevronsUpDown size={14} className="text-gray-400" aria-hidden />
                  )}
                </button>
              </th>
              <MatrixCountSortHeader
                label="Итого"
                align="right"
                className={STICKY_TOTAL_CLASS}
                active={sortConfig.key === 'totalDays'}
                direction={sortConfig.direction}
                onClick={() => cycleSort('totalDays')}
              />
            </tr>
            <tr className="group border-b border-gray-100">
              <th className={`${STICKY_KEY_CLASS} p-0`} aria-hidden />
              <th className={`${STICKY_NAME_CLASS} p-0`} aria-hidden />
              <th className={`${STICKY_AUDITOR_CLASS} p-0`} aria-hidden />
              <th
                className="bg-white px-2 pb-2 pt-0"
                style={{ width: timelineMinWidthPx, minWidth: timelineMinWidthPx }}
              >
                <div className="relative h-3.5" style={{ width: timelineMinWidthPx, minWidth: timelineMinWidthPx }}>
                  <div className="absolute inset-y-0 left-3 right-3">
                    {model.ticks.map((tick) => (
                      <span
                        key={`${tick.ms}-${tick.percent}`}
                        className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium tabular-nums leading-none text-gray-500"
                        style={{ left: `${tick.percent}%` }}
                        title={tick.label}
                      >
                        {tick.label}
                      </span>
                    ))}
                  </div>
                </div>
              </th>
              <th className={`${STICKY_TOTAL_CLASS} p-0`} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.id} className="group border-b border-gray-50 last:border-b-0 hover:bg-gray-50">
                <td className={`${STICKY_KEY_CLASS} px-3 py-1.5 font-semibold tabular-nums text-sber-dark`}>
                  {row.key}
                </td>
                <td
                  className={`${STICKY_NAME_CLASS} truncate px-3 py-1.5 text-slate-700`}
                  title={row.shortName}
                >
                  {row.shortName || '—'}
                </td>
                <td
                  className={`${STICKY_AUDITOR_CLASS} truncate px-3 py-1.5 text-slate-700`}
                  title={row.auditor}
                >
                  {row.auditor}
                </td>
                <td className="px-2 py-0.5" style={{ width: timelineMinWidthPx, minWidth: timelineMinWidthPx }}>
                  <div style={{ width: timelineMinWidthPx, minWidth: timelineMinWidthPx }}>
                    <TimelineTrack row={row} ticks={model.ticks} />
                  </div>
                </td>
                <td className={`${STICKY_TOTAL_CLASS} whitespace-nowrap px-3 py-1.5 text-right font-normal tabular-nums text-sber-dark`}>
                  {row.totalDays === null ? '—' : formatDurationDays(row.totalDays)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MatrixLegendFooter
        totalText={
          <>
            {formatLifecycleChecksCount(model.rows.length)}
            {averageLifecycle ? (
              <>
                <span className="mx-2 text-gray-300" aria-hidden>
                  ·
                </span>
                <span className="font-semibold text-sber-dark">
                  Средняя продолжительность жизненного цикла:
                </span>{' '}
                {formatDurationDays(averageLifecycle.averageDays)}
                {averageLifecycle.sampleSize !== model.rows.length ? (
                  <span className="text-gray-500">
                    {' '}
                    ({formatLifecycleChecksByCount(averageLifecycle.sampleSize)})
                  </span>
                ) : null}
              </>
            ) : null}
          </>
        }
        legend={LEGEND}
      />
    </div>
  );
}
