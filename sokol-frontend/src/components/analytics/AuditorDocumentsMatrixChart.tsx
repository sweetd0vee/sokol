import { useMemo, useState } from 'react';
import type { DvaAuditorDocumentRow } from '../../api/analytics';
import { getValueBasedColors, VALUE_BLUE_SCALE } from './analyticsPalette';
import { MatrixChartShell, MatrixCountSortHeader, MatrixLegendFooter } from './matrixChartChrome';
import type { SortDirection } from '../../utils/listTable';

const DOCUMENT_COLUMNS = [
  { key: 'order_filled', label: 'Приказ' },
  { key: 'program_filled', label: 'Программа' },
  { key: 'az_filled', label: 'АЗ' },
  { key: 'dz_filled', label: 'ДЗ' },
] as const;

type DocumentColumnKey = (typeof DOCUMENT_COLUMNS)[number]['key'];
type SortKey = DocumentColumnKey | 'readiness' | 'checks';

function percentFor(filled: number, total: number) {
  return total > 0 ? Math.round((filled / total) * 100) : 0;
}

function colorForPercent(percent: number) {
  return getValueBasedColors([0, percent, 100], VALUE_BLUE_SCALE)[1] ?? VALUE_BLUE_SCALE[0];
}

function ReadinessMark({
  percent,
  filled,
  total,
}: {
  percent: number;
  filled: number;
  total: number;
}) {
  const color = colorForPercent(percent);
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="inline-flex h-11 w-11 flex-col items-center justify-center rounded-full border-4 bg-white text-center leading-tight text-black"
        style={{ borderColor: color }}
        title={`${percent}% (${filled} из ${total})`}
        aria-label={`${percent}% (${filled} из ${total})`}
      >
        <span className="text-xs font-semibold tabular-nums">{percent}%</span>
      </span>
      <span className="text-sm font-medium tabular-nums text-gray-700">
        {filled}/{total}
      </span>
    </div>
  );
}

function sortRows(rows: DvaAuditorDocumentRow[], key: SortKey | null, direction: SortDirection) {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = key ? left[key] : left.readiness;
    const rightValue = key ? right[key] : right.readiness;
    const diff = (leftValue - rightValue) * (key ? sign : 1);
    return diff || left.name.localeCompare(right.name, 'ru');
  });
}

export function AuditorDocumentsMatrixChart({ rows }: { rows: DvaAuditorDocumentRow[] }) {
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const hoveredRow = rows.find((row) => row.name === hoveredName) ?? null;
  const sortedRows = useMemo(
    () => sortRows(rows, sortKey, sortDirection),
    [rows, sortKey, sortDirection],
  );

  const cycleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection(key === 'readiness' ? 'asc' : 'desc');
      return;
    }
    if (sortDirection === 'desc') {
      setSortDirection('asc');
      return;
    }
    if (sortDirection === 'asc' && key !== 'readiness') {
      setSortDirection('desc');
      setSortKey(null);
      return;
    }
    setSortKey(null);
  };

  return (
    <MatrixChartShell
      hoveredRow={hoveredRow ? { key: hoveredRow.name, name: `${hoveredRow.checks} проверок` } : null}
      footer={(
        <MatrixLegendFooter
          totalText={`${rows.length} ${rows.length === 1 ? 'сотрудник' : 'сотрудников'}`}
          legend={[
            { key: 'low', label: 'Низкая готовность', color: VALUE_BLUE_SCALE[0] },
            { key: 'high', label: 'Полный комплект', color: VALUE_BLUE_SCALE[VALUE_BLUE_SCALE.length - 1] },
          ]}
        />
      )}
    >
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[22%]" />
          {DOCUMENT_COLUMNS.map((column) => (
            <col key={column.key} className="w-[14%]" />
          ))}
          <col className="w-[16%]" />
        </colgroup>
        <thead className="sticky top-0 z-[1] bg-white">
          <tr className="border-b border-gray-100">
            <th className="sticky left-0 z-[2] bg-white px-3 py-2 text-left font-semibold text-sber-dark">
              Сотрудник
            </th>
            {DOCUMENT_COLUMNS.map((column) => (
              <MatrixCountSortHeader
                key={column.key}
                label={column.label}
                active={sortKey === column.key}
                direction={sortDirection}
                onClick={() => cycleSort(column.key)}
              />
            ))}
            <MatrixCountSortHeader
              label="Готовность"
              active={sortKey === 'readiness'}
              direction={sortDirection}
              onClick={() => cycleSort('readiness')}
            />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={row.name}
              className="border-b border-gray-50 hover:bg-slate-50"
              onMouseEnter={() => setHoveredName(row.name)}
              onMouseLeave={() => setHoveredName(null)}
            >
              <td className="sticky left-0 z-[1] bg-white px-3 py-2 font-medium text-sber-dark">
                <div className="truncate" title={row.name}>
                  {row.name}
                </div>
                <div className="text-xs font-normal text-gray-500">{row.checks} проверок</div>
              </td>
              {DOCUMENT_COLUMNS.map((column) => {
                const filled = row[column.key];
                return (
                  <td key={column.key} className="px-1 py-2 text-center">
                    <ReadinessMark
                      percent={percentFor(filled, row.checks)}
                      filled={filled}
                      total={row.checks}
                    />
                  </td>
                );
              })}
              <td className="px-1 py-2 text-center">
                <ReadinessMark percent={row.readiness} filled={row.order_filled + row.program_filled + row.az_filled + row.dz_filled} total={row.checks * 4} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </MatrixChartShell>
  );
}
