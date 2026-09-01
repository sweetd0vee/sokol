import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { SortDirection } from '../../utils/listTable';
import {
  STATUS_MATRIX_COLUMNS,
  STATUS_MATRIX_LEGEND,
  buildStatusMatrixColumnTotals,
  cycleStatusMatrixCountSort,
  DEFAULT_STATUS_MATRIX_COUNT_SORT,
  formatStatusChecksCount,
  getStatusMatrixCount,
  sortStatusMatrixRows,
  statusMatrixGrandTotal,
  type StatusMatrixCountSortConfig,
  type StatusMatrixRow,
} from '../../utils/statusMatrix';
import { applyValueBasedColors } from './analyticsPalette';

type StatusMatrixChartProps = {
  rows: StatusMatrixRow[];
};

function CountSortHeader({
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
  const sortLabel = !active
    ? `Сортировать по убыванию: ${label}`
    : direction === 'desc'
      ? `Сортировать по возрастанию: ${label}`
      : `Сбросить сортировку: ${label}`;

  return (
    <th
      className="px-1 py-2 text-center font-semibold text-sber-dark"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex w-full items-center justify-center gap-1 text-sber-dark transition hover:text-sber"
        title={sortLabel}
        aria-label={sortLabel}
      >
        <span className="text-balance leading-tight">{label}</span>
        {active ? (
          direction === 'asc' ? (
            <ArrowUp size={14} aria-hidden />
          ) : (
            <ArrowDown size={14} aria-hidden />
          )
        ) : (
          <ChevronsUpDown size={14} className="text-gray-400" aria-hidden />
        )}
      </button>
    </th>
  );
}

export function StatusMatrixChart({ rows }: StatusMatrixChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<StatusMatrixCountSortConfig>(
    DEFAULT_STATUS_MATRIX_COUNT_SORT,
  );
  const hoveredRow = rows.find((row) => row.key === hoveredKey) ?? null;
  const totals = useMemo(() => buildStatusMatrixColumnTotals(rows), [rows]);
  const grandTotal = useMemo(() => statusMatrixGrandTotal(rows), [rows]);
  const legend = useMemo(
    () =>
      applyValueBasedColors(
        STATUS_MATRIX_LEGEND.map((item) => ({
          ...item,
          value: totals[item.key],
        })),
      ),
    [totals],
  );
  const sortedRows = useMemo(
    () => sortStatusMatrixRows(rows, sortConfig),
    [rows, sortConfig],
  );

  return (
    <div data-export-html className="flex h-full min-h-[13rem] flex-col gap-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-100">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[38%]" />
              {STATUS_MATRIX_COLUMNS.map((column) => (
                <col key={column.key} className="w-[12%]" />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-[1] bg-white">
              <tr className="border-b border-gray-100">
                <th className="sticky left-0 z-[2] bg-white px-3 py-2 text-left font-semibold text-sber-dark">
                  Ключ проверки
                </th>
                <th className="bg-white px-3 py-2 text-left font-semibold text-sber-dark">
                  Краткое название проверки
                </th>
                {STATUS_MATRIX_COLUMNS.map((column) => (
                  <CountSortHeader
                    key={column.key}
                    label={column.label}
                    active={sortConfig.key === column.key}
                    direction={sortConfig.direction}
                    onClick={() => setSortConfig((prev) => cycleStatusMatrixCountSort(prev, column.key))}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-50"
                  onMouseEnter={() => setHoveredKey(row.key)}
                  onMouseLeave={() => setHoveredKey((current) => (current === row.key ? null : current))}
                >
                  <th
                    className="sticky left-0 bg-white px-3 py-1.5 text-left font-medium text-gray-700"
                    title={row.name}
                  >
                    <span className="cursor-default underline decoration-dotted decoration-gray-300 underline-offset-2">
                      {row.key}
                    </span>
                  </th>
                  <td
                    className="truncate px-3 py-1.5 text-left text-gray-700"
                    title={row.shortName || row.name}
                  >
                    {row.shortName || '—'}
                  </td>
                  {STATUS_MATRIX_COLUMNS.map((column) => {
                    const count = getStatusMatrixCount(row, column.key);
                    return (
                      <td
                        key={column.key}
                        className="px-1 py-2 text-center"
                        title={`${column.label}: ${count}`}
                        aria-label={`${column.label}: ${count}`}
                      >
                        <span className="text-sm font-semibold tabular-nums text-slate-800">
                          {count}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-[1] bg-gray-50/95">
              <tr className="border-t border-gray-200">
                <th
                  colSpan={2}
                  className="sticky left-0 bg-gray-50/95 px-3 py-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-sber-dark"
                >
                  Доля рекомендаций
                </th>
                {STATUS_MATRIX_COLUMNS.map((column) => {
                  const count = totals[column.key];
                  const percent = grandTotal === 0 ? 0 : Math.round((count / grandTotal) * 100);
                  return (
                    <td key={column.key} className="px-1 py-3 text-center align-top">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-sm font-semibold text-sber-dark">{column.label}</span>
                        <span className="text-sm font-semibold tabular-nums text-slate-800">
                          {count}
                        </span>
                        <span className="text-sm font-medium tabular-nums text-gray-700">{percent}%</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {hoveredRow ? (
        <p className="shrink-0 truncate text-xs text-gray-600" title={hoveredRow.name}>
          <span className="font-semibold text-sber-dark">{hoveredRow.key}</span>
          {': '}
          {hoveredRow.name}
        </p>
      ) : null}

      <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-1.5">
        <p className="text-base font-medium text-gray-700">
          <span className="font-semibold text-sber-dark">Итого:</span>{' '}
          {formatStatusChecksCount(rows.length)}
        </p>

        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-base text-gray-700">
          {legend.map((item) => (
            <li key={item.key} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-full border border-black/10"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
