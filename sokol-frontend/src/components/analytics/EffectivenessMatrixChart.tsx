import { useMemo, useState } from 'react';
import {
  EFFECTIVENESS_LEGEND,
  EFFECTIVENESS_MATRIX_COLUMNS,
  buildEffectivenessColumnShares,
  formatEffectivenessChecksCount,
  getEffectivenessToneColor,
  type EffectivenessColumnShare,
  type EffectivenessMatrixRow,
} from '../../utils/checkAnalytics';

type EffectivenessMatrixChartProps = {
  rows: EffectivenessMatrixRow[];
};

function ColumnShareSquares({ shares }: { shares: EffectivenessColumnShare[] }) {
  if (shares.length === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  return (
    <ul className="mx-auto flex w-full flex-col items-center gap-1">
      {shares.map((share) => (
        <li key={share.tone} className="h-11 w-11">
          <span
            className="inline-flex h-11 w-11 flex-col items-center justify-center rounded-sm border-4 bg-white text-center leading-tight text-black"
            style={{
              borderColor: share.color,
            }}
            title={`${share.label}: ${share.percent}% (${share.count})`}
            aria-label={`${share.label}: ${share.percent}% (${share.count})`}
          >
            <span className="text-xs font-semibold tabular-nums">{share.percent}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EffectivenessMatrixChart({ rows }: EffectivenessMatrixChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const hoveredRow = rows.find((row) => row.key === hoveredKey) ?? null;
  const columnShares = useMemo(
    () =>
      Object.fromEntries(
        EFFECTIVENESS_MATRIX_COLUMNS.map((column) => [
          column.key,
          buildEffectivenessColumnShares(rows, column.key),
        ]),
      ) as Record<(typeof EFFECTIVENESS_MATRIX_COLUMNS)[number]['key'], EffectivenessColumnShare[]>,
    [rows],
  );

  return (
    <div data-export-html className="flex h-full min-h-[13rem] flex-col gap-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-100">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[34%]" />
              {EFFECTIVENESS_MATRIX_COLUMNS.map((column) => (
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
                {EFFECTIVENESS_MATRIX_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="px-1 py-2 text-center font-semibold text-sber-dark"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
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
                  {EFFECTIVENESS_MATRIX_COLUMNS.map((column) => {
                    const tone = row.tones[column.key];
                    const rating = row.ratings[column.key] || 'Не оценивалось';
                    const color = getEffectivenessToneColor(tone);
                    return (
                      <td
                        key={column.key}
                        className="px-1 py-2 text-center"
                        title={`${column.label}: ${rating}`}
                        aria-label={`${column.label}: ${rating}`}
                      >
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-sm border border-black/10"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot
              className="sticky bottom-0 z-[1] bg-gray-50/95"
              data-effectiveness-matrix-footer
            >
              <tr className="border-t border-gray-200">
                <th
                  colSpan={2}
                  className="sticky left-0 bg-gray-50/95 px-3 py-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-sber-dark"
                >
                  Доля оценок
                </th>
                {EFFECTIVENESS_MATRIX_COLUMNS.map((column) => (
                  <td key={column.key} className="px-1 py-3 text-center align-top">
                    <ColumnShareSquares shares={columnShares[column.key]} />
                  </td>
                ))}
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
        <p className="text-base font-medium text-gray-700" data-effectiveness-matrix-total>
          <span className="font-semibold text-sber-dark">Итого:</span>{' '}
          {formatEffectivenessChecksCount(rows.length)}
        </p>

        <ul
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-base text-gray-700"
          data-effectiveness-matrix-legend
        >
          {EFFECTIVENESS_LEGEND.map((item) => (
            <li key={item.tone} className="inline-flex items-center gap-1.5">
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
