import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DvaAuditorDocumentRow, DvaMissingCheckRef } from '../../api/analytics';
import { CHART_TOOLTIP_STYLE } from './AnalyticsChartPrimitives';
import { DVA_VALUE_SCALE, getValueBasedColors } from './analyticsPalette';
import { MatrixChartShell, MatrixCountSortHeader, MatrixLegendFooter } from './matrixChartChrome';
import type { SortDirection } from '../../utils/listTable';

const DOCUMENT_COLUMNS = [
  { key: 'order_filled', missingKey: 'missing_order', label: 'Приказ' },
  { key: 'program_filled', missingKey: 'missing_program', label: 'Программа' },
  { key: 'az_filled', missingKey: 'missing_az', label: 'АЗ' },
  { key: 'dz_filled', missingKey: 'missing_dz', label: 'ДЗ' },
] as const;

type DocumentColumnKey = (typeof DOCUMENT_COLUMNS)[number]['key'];
type SortKey = DocumentColumnKey | 'readiness' | 'checks';

function percentFor(filled: number, total: number) {
  return total > 0 ? Math.round((filled / total) * 100) : 0;
}

function colorForPercent(percent: number) {
  return getValueBasedColors([0, percent, 100], DVA_VALUE_SCALE)[1] ?? DVA_VALUE_SCALE[0];
}

function ReadinessValue({
  percent,
  filled,
  total,
}: {
  percent: number;
  filled: number;
  total: number;
}) {
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className="text-sm font-normal tabular-nums" style={{ color: colorForPercent(percent) }}>
        {percent}%
      </span>
      <span className="text-xs font-normal tabular-nums text-gray-500">
        {filled}/{total}
      </span>
    </div>
  );
}

function MissingChecksHover({
  documentLabel,
  missing,
  children,
}: {
  documentLabel: string;
  missing: DvaMissingCheckRef[];
  children: ReactNode;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  if (missing.length === 0) {
    return children;
  }

  const estimatedHeight = 52 + missing.length * 22;
  const showAbove = Boolean(
    anchor && anchor.bottom + 8 + estimatedHeight > window.innerHeight,
  );

  return (
    <div
      className="relative cursor-help"
      onMouseEnter={(event) => setAnchor(event.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setAnchor(null)}
    >
      {children}
      {anchor
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[80] max-h-72 max-w-sm overflow-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-lg"
              style={{
                ...CHART_TOOLTIP_STYLE,
                left: Math.min(Math.max(12, anchor.left + anchor.width / 2 - 160), window.innerWidth - 332),
                top: showAbove ? undefined : anchor.bottom + 8,
                bottom: showAbove ? window.innerHeight - anchor.top + 8 : undefined,
              }}
            >
              <p className="mb-1.5 text-xs font-semibold text-sber-dark">
                Нет документа «{documentLabel}»
              </p>
              <ul className="space-y-1">
                {missing.map((item) => (
                  <li key={item.key} className="text-sm leading-snug text-slate-700">
                    <span className="font-semibold text-sber-dark">{item.key}</span>
                    {item.short_name ? (
                      <>
                        {' — '}
                        {item.short_name}
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
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

export function AuditorDocumentsMatrixChart({
  rows,
  scrollBody = true,
}: {
  rows: DvaAuditorDocumentRow[];
  scrollBody?: boolean;
}) {
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
      scrollBody={scrollBody}
      footer={(
        <MatrixLegendFooter
          totalText={`${rows.length} ${rows.length === 1 ? 'сотрудник' : 'сотрудников'}`}
          legend={[
            { key: 'low', label: 'Низкая готовность', color: DVA_VALUE_SCALE[0] },
            { key: 'high', label: 'Полный комплект', color: DVA_VALUE_SCALE[DVA_VALUE_SCALE.length - 1] },
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
                const missing = row[column.missingKey] ?? [];
                return (
                  <td key={column.key} className="px-1 py-2 text-center">
                    <MissingChecksHover documentLabel={column.label} missing={missing}>
                      <ReadinessValue
                        percent={percentFor(filled, row.checks)}
                        filled={filled}
                        total={row.checks}
                      />
                    </MissingChecksHover>
                  </td>
                );
              })}
              <td className="px-1 py-2 text-center">
                <ReadinessValue
                  percent={row.readiness}
                  filled={row.order_filled + row.program_filled + row.az_filled + row.dz_filled}
                  total={row.checks * 4}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </MatrixChartShell>
  );
}
