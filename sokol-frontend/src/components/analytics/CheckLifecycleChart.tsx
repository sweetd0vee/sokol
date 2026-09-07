import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { DvaCheckLifecycleRow } from '../../api/analytics';
import { formatRuDate } from '../../utils/dates';
import {
  buildCheckLifecycleChartModel,
  formatDurationDays,
  formatLifecycleChecksCount,
  sortCheckLifecycleRows,
  type CheckLifecyclePoint,
  type CheckLifecycleSegment,
  type CheckLifecycleSortKey,
  type CheckLifecycleViewRow,
} from '../../utils/dvaAnalytics';
import { DVA_VALUE_SCALE } from './analyticsPalette';
import { CHART_TOOLTIP_STYLE } from './AnalyticsChartPrimitives';
import { MatrixCountSortHeader, MatrixLegendFooter } from './matrixChartChrome';
import { cycleSortConfig, type SortConfig } from '../../utils/listTable';

const SEGMENT_STYLE = {
  order_to_program: DVA_VALUE_SCALE[0],
  program_to_az: DVA_VALUE_SCALE[3],
  az_to_dz: DVA_VALUE_SCALE[5],
} as const;

const POINT_COLOR: Record<string, string> = {
  order: DVA_VALUE_SCALE[0],
  program: DVA_VALUE_SCALE[2],
  az: DVA_VALUE_SCALE[4],
  dz: DVA_VALUE_SCALE[5],
};

const LEGEND = [
  { key: 'order_to_program', label: 'Приказ → программа', color: SEGMENT_STYLE.order_to_program },
  { key: 'program_to_az', label: 'Программа → АЗ', color: SEGMENT_STYLE.program_to_az },
  { key: 'az_to_dz', label: 'АЗ → ДЗ', color: SEGMENT_STYLE.az_to_dz },
];

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
      <p className="text-sm font-semibold tabular-nums text-slate-800">{formatDurationDays(segment.days)}</p>
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
      {tooltip ? <FloatingTooltip anchor={tooltip.anchor}>{tooltip.node}</FloatingTooltip> : null}
    </div>
  );
}

export function CheckLifecycleChart({ rows }: { rows: DvaCheckLifecycleRow[] }) {
  const model = useMemo(() => buildCheckLifecycleChartModel(rows), [rows]);
  const [sortConfig, setSortConfig] = useState<SortConfig<CheckLifecycleSortKey>>({
    key: null,
    direction: 'asc',
  });
  const sortedRows = useMemo(
    () => sortCheckLifecycleRows(model.rows, sortConfig),
    [model.rows, sortConfig],
  );
  const cycleSort = (key: CheckLifecycleSortKey) => {
    setSortConfig((prev) => cycleSortConfig(prev, key));
  };

  return (
    <div data-export-html className="flex min-h-[13rem] flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full min-w-[58rem] border-collapse text-sm">
          <colgroup>
            <col className="w-[7.5rem]" />
            <col className="w-[16rem]" />
            <col className="w-[11rem]" />
            <col />
            <col className="w-[7.5rem]" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-100">
              <MatrixCountSortHeader
                label="Ключ"
                align="left"
                className="sticky left-0 z-[2] bg-white"
                active={sortConfig.key === 'key'}
                direction={sortConfig.direction}
                onClick={() => cycleSort('key')}
              />
              <MatrixCountSortHeader
                label="Краткое название"
                align="left"
                active={sortConfig.key === 'shortName'}
                direction={sortConfig.direction}
                onClick={() => cycleSort('shortName')}
              />
              <MatrixCountSortHeader
                label="Аудитор"
                align="left"
                active={sortConfig.key === 'auditor'}
                direction={sortConfig.direction}
                onClick={() => cycleSort('auditor')}
              />
              <th className="bg-white px-3 py-2 text-left font-semibold text-sber-dark">
                <div className="mb-1">
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
                </div>
                <div className="relative h-8">
                  {model.ticks.map((tick) => (
                    <span
                      key={`${tick.ms}-${tick.percent}`}
                      className="absolute top-0 text-[11px] font-medium tabular-nums text-gray-500"
                      style={{
                        left: `${tick.percent}%`,
                        transform:
                          tick.percent <= 1
                            ? 'translateX(0)'
                            : tick.percent >= 99
                              ? 'translateX(-100%)'
                              : 'translateX(-50%)',
                      }}
                    >
                      {tick.label}
                    </span>
                  ))}
                </div>
              </th>
              <MatrixCountSortHeader
                label="Итого"
                align="right"
                active={sortConfig.key === 'totalDays'}
                direction={sortConfig.direction}
                onClick={() => cycleSort('totalDays')}
              />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50">
                <td className="sticky left-0 z-[1] bg-white px-3 py-1.5 font-semibold tabular-nums text-sber-dark">
                  {row.key}
                </td>
                <td className="max-w-[16rem] truncate px-3 py-1.5 text-slate-700" title={row.shortName}>
                  {row.shortName || '—'}
                </td>
                <td className="max-w-[11rem] truncate px-3 py-1.5 text-slate-700" title={row.auditor}>
                  {row.auditor}
                </td>
                <td className="px-2 py-0.5">
                  <TimelineTrack row={row} ticks={model.ticks} />
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums text-sber-dark">
                  {row.totalDays === null ? '—' : formatDurationDays(row.totalDays)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MatrixLegendFooter totalText={formatLifecycleChecksCount(model.rows.length)} legend={LEGEND} />
    </div>
  );
}
