import { useEffect, useMemo, useState } from 'react';
import {
  cycleMaterialityMatrixCountSort,
  DEFAULT_MATERIALITY_MATRIX_COUNT_SORT,
  MATERIALITY_MATRIX_COLUMNS,
  MATERIALITY_MATRIX_LEGEND,
  MATERIALITY_MATRIX_TOTAL_COLUMN,
  buildMaterialityMatrixColumnTotals,
  formatMaterialityChecksCount,
  getMaterialityMatrixCount,
  materialityMatrixGrandTotal,
  sortMaterialityMatrixRows,
  type MaterialityMatrixColumnKey,
  type MaterialityMatrixCountSortConfig,
  type MaterialityMatrixRow,
} from '../../utils/materialityMatrix';
import { getMaterialityChartColor } from './analyticsPalette';
import { MatrixChartShell, MatrixCountSortHeader, MatrixLegendFooter } from './matrixChartChrome';

type MaterialityMatrixChartProps = {
  rows: MaterialityMatrixRow[];
  onSortConfigChange?: (sortConfig: MaterialityMatrixCountSortConfig) => void;
  scrollBody?: boolean;
};

function ColumnShareCircle({
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
  const color = getMaterialityChartColor(column.level);

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="inline-flex h-11 w-11 flex-col items-center justify-center rounded-full border-4 bg-white text-center leading-tight text-black"
        style={{ borderColor: color }}
        title={`${column.label}: ${percent}% (${count})`}
        aria-label={`${column.label}: ${percent}% (${count})`}
      >
        <span className="text-xs font-semibold tabular-nums">{percent}%</span>
      </span>
      <span className="text-sm font-medium tabular-nums text-gray-700">{count}</span>
    </div>
  );
}

export function MaterialityMatrixChart({
  rows,
  onSortConfigChange,
  scrollBody = true,
}: MaterialityMatrixChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<MaterialityMatrixCountSortConfig>(
    DEFAULT_MATERIALITY_MATRIX_COUNT_SORT,
  );
  const hoveredRow = rows.find((row) => row.key === hoveredKey) ?? null;
  const totals = useMemo(() => buildMaterialityMatrixColumnTotals(rows), [rows]);
  const grandTotal = useMemo(() => materialityMatrixGrandTotal(rows), [rows]);
  const sortedRows = useMemo(
    () => sortMaterialityMatrixRows(rows, sortConfig),
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
          totalText={formatMaterialityChecksCount(rows.length)}
          legend={MATERIALITY_MATRIX_LEGEND}
        />
      )}
    >
      <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[40%]" />
              {MATERIALITY_MATRIX_COLUMNS.map((column) => (
                <col key={column.key} className="w-[11%]" />
              ))}
              <col className="w-[15%]" />
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
                  <MatrixCountSortHeader
                    key={column.key}
                    label={column.label}
                    active={sortConfig.key === column.key}
                    direction={sortConfig.direction}
                    onClick={() => setSortConfig((prev) => cycleMaterialityMatrixCountSort(prev, column.key))}
                  />
                ))}
                <MatrixCountSortHeader
                  label={MATERIALITY_MATRIX_TOTAL_COLUMN.label}
                  active={sortConfig.key === MATERIALITY_MATRIX_TOTAL_COLUMN.key}
                  direction={sortConfig.direction}
                  onClick={() =>
                    setSortConfig((prev) =>
                      cycleMaterialityMatrixCountSort(prev, MATERIALITY_MATRIX_TOTAL_COLUMN.key),
                    )
                  }
                />
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
                    return (
                      <td
                        key={column.key}
                        className="px-1 py-2 text-center"
                        title={`${column.label}: ${count}`}
                        aria-label={`${column.label}: ${count}`}
                      >
                        <span className="text-sm font-bold tabular-nums text-slate-800">{count}</span>
                      </td>
                    );
                  })}
                  <td
                    className="px-1 py-2 text-center"
                    title={`${MATERIALITY_MATRIX_TOTAL_COLUMN.label}: ${row.total}`}
                    aria-label={`${MATERIALITY_MATRIX_TOTAL_COLUMN.label}: ${row.total}`}
                  >
                    <span className="text-sm font-bold tabular-nums text-slate-800">{row.total}</span>
                  </td>
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
                {MATERIALITY_MATRIX_COLUMNS.map((column) => {
                  const count = totals[column.key];
                  const percent = grandTotal === 0 ? 0 : Math.round((count / grandTotal) * 100);
                  return (
                    <td key={column.key} className="px-1 py-3 text-center align-top">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-sm font-semibold text-sber-dark">{column.label}</span>
                        <ColumnShareCircle columnKey={column.key} count={count} percent={percent} />
                      </div>
                    </td>
                  );
                })}
                <td className="px-1 py-3 text-center align-top">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-sm font-semibold text-sber-dark">Всего</span>
                    <span className="text-sm font-medium tabular-nums text-gray-700">{grandTotal}</span>
                  </div>
                </td>
              </tr>
            </tfoot>
      </table>
    </MatrixChartShell>
  );
}
