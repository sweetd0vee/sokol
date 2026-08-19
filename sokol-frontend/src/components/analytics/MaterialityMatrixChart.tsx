import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { contrastLabelColor } from './chartContrast';
import { getMaterialityLevelColor } from '../../utils/recommendationAnalytics';
import type { SortDirection } from '../../utils/listTable';
import {
  MATERIALITY_MATRIX_COLUMNS,
  MATERIALITY_MATRIX_LEGEND,
  buildMaterialityMatrixColumnTotals,
  formatMaterialityChecksCount,
  getMaterialityMatrixCount,
  materialityMatrixGrandTotal,
  type MaterialityMatrixColumnKey,
  type MaterialityMatrixRow,
} from '../../utils/materialityMatrix';

type CountSortConfig = {
  key: MaterialityMatrixColumnKey | null;
  direction: SortDirection;
};

type MaterialityMatrixChartProps = {
  rows: MaterialityMatrixRow[];
};

function ColumnShareSquare({
  columnKey,
  count,
  percent,
}: {
  columnKey: MaterialityMatrixColumnKey;
  count: number;
  percent: number;
}) {
  const column = MATERIALITY_MATRIX_COLUMNS.find((item) => item.key === columnKey);
  if (!column) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  const color = getMaterialityLevelColor(column.level);

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="inline-flex h-11 w-11 flex-col items-center justify-center rounded-sm border-4 bg-white text-center leading-tight text-black"
        style={{ borderColor: color }}
        title={`${column.label}: ${percent}% (${count})`}
        aria-label={`${column.label}: ${percent}% (${count})`}
      >
        <span className="text-xs font-semibold tabular-nums">{percent}%</span>
      </span>
      <span className="text-xs tabular-nums text-gray-600">{count}</span>
    </div>
  );
}

function cycleCountSort(prev: CountSortConfig, key: MaterialityMatrixColumnKey): CountSortConfig {
  if (prev.key !== key) {
    return { key, direction: 'desc' };
  }
  if (prev.direction === 'desc') {
    return { key, direction: 'asc' };
  }
  return { key: null, direction: 'desc' };
}

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
        <span>{label}</span>
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

export function MaterialityMatrixChart({ rows }: MaterialityMatrixChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<CountSortConfig>({ key: null, direction: 'desc' });
  const hoveredRow = rows.find((row) => row.key === hoveredKey) ?? null;
  const totals = useMemo(() => buildMaterialityMatrixColumnTotals(rows), [rows]);
  const grandTotal = useMemo(() => materialityMatrixGrandTotal(rows), [rows]);
  const sortedRows = useMemo(() => {
    if (!sortConfig.key) {
      return rows;
    }
    const columnKey = sortConfig.key;
    const direction = sortConfig.direction === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => {
      const countDelta =
        (getMaterialityMatrixCount(left, columnKey) - getMaterialityMatrixCount(right, columnKey)) * direction;
      if (countDelta !== 0) {
        return countDelta;
      }
      return left.key.localeCompare(right.key, 'ru', { numeric: true, sensitivity: 'base' });
    });
  }, [rows, sortConfig]);

  return (
    <div data-export-html className="flex h-full min-h-[13rem] flex-col gap-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-100">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[47%]" />
              {MATERIALITY_MATRIX_COLUMNS.map((column) => (
                <col key={column.key} className="w-[13%]" />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-[1] bg-white">
              <tr className="border-b border-gray-100">
                <th className="sticky left-0 z-[2] bg-white px-3 py-2 text-left font-semibold text-sber-dark">
                  Ключ
                </th>
                <th className="bg-white px-3 py-2 text-left font-semibold text-sber-dark">
                  Краткое название проверки
                </th>
                {MATERIALITY_MATRIX_COLUMNS.map((column) => (
                  <CountSortHeader
                    key={column.key}
                    label={column.label}
                    active={sortConfig.key === column.key}
                    direction={sortConfig.direction}
                    onClick={() => setSortConfig((prev) => cycleCountSort(prev, column.key))}
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
                  {MATERIALITY_MATRIX_COLUMNS.map((column) => {
                    const count = getMaterialityMatrixCount(row, column.key);
                    const color = getMaterialityLevelColor(column.level);
                    return (
                      <td
                        key={column.key}
                        className="px-1 py-2 text-center"
                        title={`${column.label}: ${count}`}
                        aria-label={`${column.label}: ${count}`}
                      >
                        <span
                          className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-sm px-1.5 text-xs font-bold tabular-nums"
                          style={{
                            backgroundColor: color,
                            color: contrastLabelColor(color),
                            opacity: count === 0 ? 0.45 : 1,
                          }}
                        >
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
                {MATERIALITY_MATRIX_COLUMNS.map((column) => {
                  const count = totals[column.key];
                  const percent = grandTotal === 0 ? 0 : Math.round((count / grandTotal) * 100);
                  return (
                    <td key={column.key} className="px-1 py-3 text-center align-top">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-sm font-semibold text-sber-dark">{column.label}</span>
                        <ColumnShareSquare columnKey={column.key} count={count} percent={percent} />
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
          {formatMaterialityChecksCount(rows.length)}
        </p>

        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-base text-gray-700">
          {MATERIALITY_MATRIX_LEGEND.map((item) => (
            <li key={item.key} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-sm border border-black/10"
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
