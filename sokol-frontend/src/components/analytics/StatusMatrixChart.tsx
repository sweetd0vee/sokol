import { useEffect, useMemo, useState } from 'react';
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
import { MONITORING_STATUS_COLORS } from './analyticsPalette';
import { MatrixChartShell, MatrixCountSortHeader, MatrixLegendFooter } from './matrixChartChrome';

type StatusMatrixChartProps = {
  rows: StatusMatrixRow[];
  onSortConfigChange?: (sortConfig: StatusMatrixCountSortConfig) => void;
  scrollBody?: boolean;
};

const MONITORING_STATUS_MATRIX_LEGEND = STATUS_MATRIX_LEGEND.map((item) => ({
  ...item,
  color: MONITORING_STATUS_COLORS[item.status],
}));

export function StatusMatrixChart({ rows, onSortConfigChange, scrollBody = true }: StatusMatrixChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<StatusMatrixCountSortConfig>(
    DEFAULT_STATUS_MATRIX_COUNT_SORT,
  );
  const hoveredRow = rows.find((row) => row.key === hoveredKey) ?? null;
  const totals = useMemo(() => buildStatusMatrixColumnTotals(rows), [rows]);
  const grandTotal = useMemo(() => statusMatrixGrandTotal(rows), [rows]);
  const sortedRows = useMemo(
    () => sortStatusMatrixRows(rows, sortConfig),
    [rows, sortConfig],
  );

  useEffect(() => {
    onSortConfigChange?.(sortConfig);
  }, [onSortConfigChange, sortConfig]);

  return (
    <MatrixChartShell
      hoveredRow={hoveredRow}
      scrollBody={scrollBody}
      footer={(
        <MatrixLegendFooter
          totalText={formatStatusChecksCount(rows.length)}
          legend={MONITORING_STATUS_MATRIX_LEGEND}
        />
      )}
    >
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
              <MatrixCountSortHeader
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
        <tfoot className={scrollBody ? 'sticky bottom-0 z-[1] bg-gray-50/95' : 'bg-gray-50/95'}>
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
    </MatrixChartShell>
  );
}
