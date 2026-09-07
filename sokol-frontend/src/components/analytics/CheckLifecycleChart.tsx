import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DvaCheckLifecycleRow } from '../../api/analytics';
import { formatRuDate } from '../../utils/dates';
import {
  buildCheckLifecycleChartModel,
  formatDurationDays,
  formatLifecycleChecksCount,
  type CheckLifecyclePoint,
  type CheckLifecycleSegment,
  type CheckLifecycleViewRow,
} from '../../utils/dvaAnalytics';
import { DVA_VALUE_SCALE } from './analyticsPalette';
import { CHART_TOOLTIP_STYLE } from './AnalyticsChartPrimitives';
import { MatrixLegendFooter } from './matrixChartChrome';

const SEGMENT_STYLE: Record<string, { fill: string; text: string }> = {
  order_to_program: { fill: DVA_VALUE_SCALE[0], text: DVA_VALUE_SCALE[5] },
  program_to_az: { fill: DVA_VALUE_SCALE[3], text: '#ffffff' },
  az_to_dz: { fill: DVA_VALUE_SCALE[5], text: '#ffffff' },
};

const POINT_COLOR: Record<string, string> = {
  order: DVA_VALUE_SCALE[0],
  program: DVA_VALUE_SCALE[2],
  az: DVA_VALUE_SCALE[4],
  dz: DVA_VALUE_SCALE[5],
};

const LEGEND = [
  { key: 'order_to_program', label: 'Приказ → программа', color: SEGMENT_STYLE.order_to_program.fill },
  { key: 'program_to_az', label: 'Программа → АЗ', color: SEGMENT_STYLE.program_to_az.fill },
  { key: 'az_to_dz', label: 'АЗ → ДЗ', color: SEGMENT_STYLE.az_to_dz.fill },
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
        const style = SEGMENT_STYLE[segment.key] ?? SEGMENT_STYLE.program_to_az;
        const showLabel = segment.widthPercent >= 7 && segment.days > 0;
        return (
          <button
            key={segment.key}
            type="button"
            className="absolute top-1/2 z-[1] flex h-3.5 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full"
            style={{
              left: `${segment.leftPercent}%`,
              width: `${Math.max(segment.widthPercent, 0.35)}%`,
              backgroundColor: style.fill,
              color: style.text,
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
          >
            {showLabel ? (
              <span className="px-1 text-[10px] font-semibold tabular-nums leading-none">
                {segment.days}
              </span>
            ) : null}
          </button>
        );
      })}
      {row.points.map((point) => (
        <button
          key={point.key}
          type="button"
          className="absolute top-1/2 z-[2] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
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

  return (
    <div data-export-html className="flex min-h-[13rem] flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <colgroup>
            <col className="w-[7.5rem]" />
            <col className="w-[16rem]" />
            <col className="w-[11rem]" />
            <col />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-100">
              <th className="sticky left-0 z-[2] bg-white px-3 py-2 text-left font-semibold text-sber-dark">
                Ключ
              </th>
              <th className="bg-white px-3 py-2 text-left font-semibold text-sber-dark">
                Краткое название
              </th>
              <th className="bg-white px-3 py-2 text-left font-semibold text-sber-dark">Аудитор</th>
              <th className="bg-white px-3 py-2 text-left font-semibold text-sber-dark">
                <div className="relative h-8">
                  {model.ticks.map((tick) => (
                    <span
                      key={`${tick.ms}-${tick.percent}`}
                      className="absolute top-0 -translate-x-1/2 text-[11px] font-medium tabular-nums text-gray-500"
                      style={{ left: `${tick.percent}%` }}
                    >
                      {tick.label}
                    </span>
                  ))}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50">
                <td className="sticky left-0 z-[1] bg-inherit px-3 py-1.5 font-semibold tabular-nums text-sber-dark">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MatrixLegendFooter totalText={formatLifecycleChecksCount(model.rows.length)} legend={LEGEND} />
    </div>
  );
}
