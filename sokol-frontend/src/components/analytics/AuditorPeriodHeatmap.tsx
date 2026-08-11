import { useMemo, useState } from 'react';
import type { PeriodBucket } from '../../utils/analyticsPeriod';

export type HeatmapCellDetail = {
  checks: number;
  recommendations: number;
};

export type HeatmapRow = {
  auditor: string;
  total: number;
  byPeriod: Record<string, HeatmapCellDetail>;
};

type AuditorPeriodHeatmapProps = {
  periods: PeriodBucket[];
  rows: HeatmapRow[];
  checksLabel?: string;
  recommendationsLabel?: string;
  emptyMessage?: string;
};

function cellTotal(cell?: HeatmapCellDetail) {
  return (cell?.checks ?? 0) + (cell?.recommendations ?? 0);
}

function heatStyle(value: number, max: number) {
  if (value <= 0) {
    return { backgroundColor: '#F8FAFC', color: '#94A3B8' };
  }
  const t = max > 0 ? value / max : 0;
  const r = Math.round(219 + (30 - 219) * t);
  const g = Math.round(234 + (58 - 234) * t);
  const b = Math.round(254 + (138 - 254) * t);
  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: t > 0.55 ? '#FFFFFF' : '#0F172A',
  };
}

function formatCellValue(value: number) {
  return value > 0 ? String(value) : '—';
}

function pluralWorks(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return 'работа';
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return 'работы';
  }
  return 'работ';
}

export function AuditorPeriodHeatmap({
  periods,
  rows,
  checksLabel = 'проверок',
  recommendationsLabel = 'рекомендаций',
  emptyMessage = 'Нет данных для выбранных фильтров',
}: AuditorPeriodHeatmapProps) {
  const [hovered, setHovered] = useState<{
    auditor: string;
    periodLabel: string;
    cell: HeatmapCellDetail;
  } | null>(null);

  const maxValue = useMemo(() => {
    let max = 0;
    rows.forEach((row) => {
      periods.forEach((period) => {
        max = Math.max(max, cellTotal(row.byPeriod[period.key]));
      });
    });
    return max;
  }, [periods, rows]);

  if (periods.length === 0 || rows.length === 0) {
    return (
      <div className="flex h-full min-h-[13rem] items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-500 dark:border-slate-700 dark:text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[13rem] flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-100 dark:border-slate-700">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/80">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                Аудитор
              </th>
              {periods.map((period) => (
                <th
                  key={period.key}
                  className="min-w-[4.5rem] px-2 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-300"
                  title={period.label}
                >
                  {period.label}
                </th>
              ))}
              <th className="min-w-[3.5rem] px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Итого
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.auditor} className="border-b border-gray-100 dark:border-slate-700">
                <th
                  className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  title={row.auditor}
                >
                  {row.auditor}
                </th>
                {periods.map((period) => {
                  const cell = row.byPeriod[period.key] ?? { checks: 0, recommendations: 0 };
                  const value = cellTotal(cell);
                  const style = heatStyle(value, maxValue);
                  return (
                    <td
                      key={period.key}
                      className="px-2 py-2 text-center font-semibold tabular-nums transition-opacity hover:opacity-90"
                      style={style}
                      onMouseEnter={() =>
                        setHovered({ auditor: row.auditor, periodLabel: period.label, cell })
                      }
                      onMouseLeave={() => setHovered(null)}
                    >
                      {formatCellValue(value)}
                    </td>
                  );
                })}
                <td className="bg-slate-50 px-2 py-2 text-center font-bold tabular-nums text-slate-800 dark:bg-slate-800/50 dark:text-slate-100">
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span>Мало</span>
          <div
            className="h-2.5 w-28 rounded-full"
            style={{
              background: 'linear-gradient(to right, #F8FAFC, #DBEAFE, #60A5FA, #1E3A8A)',
            }}
          />
          <span>Много</span>
          {maxValue > 0 ? <span className="text-slate-500">(макс. {maxValue})</span> : null}
        </div>
        {hovered ? (
          <div className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <span className="font-semibold">{hovered.auditor}</span>
            <span className="mx-1">·</span>
            <span>{hovered.periodLabel}</span>
            <span className="mx-1">—</span>
            <span>
              {cellTotal(hovered.cell)} {pluralWorks(cellTotal(hovered.cell))}
              {hovered.cell.checks > 0 || hovered.cell.recommendations > 0 ? (
                <>
                  {' '}
                  ({hovered.cell.checks} {checksLabel}, {hovered.cell.recommendations}{' '}
                  {recommendationsLabel})
                </>
              ) : null}
            </span>
          </div>
        ) : (
          <span>Наведите на ячейку, чтобы увидеть детали</span>
        )}
      </div>
    </div>
  );
}
