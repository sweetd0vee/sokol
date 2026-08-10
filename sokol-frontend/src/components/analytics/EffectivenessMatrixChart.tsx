import { useState } from 'react';
import {
  EFFECTIVENESS_LEGEND,
  EFFECTIVENESS_MATRIX_COLUMNS,
  getEffectivenessToneColor,
  type EffectivenessMatrixRow,
} from '../../utils/checkAnalytics';

type EffectivenessMatrixChartProps = {
  rows: EffectivenessMatrixRow[];
};

export function EffectivenessMatrixChart({ rows }: EffectivenessMatrixChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const hoveredRow = rows.find((row) => row.key === hoveredKey) ?? null;

  return (
    <div data-export-html className="flex h-full min-h-[13rem] flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-100 dark:border-slate-700">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[40%]" />
            {EFFECTIVENESS_MATRIX_COLUMNS.map((column) => (
              <col key={column.key} className="w-[11%]" />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-white dark:bg-slate-800">
            <tr className="border-b border-gray-100 dark:border-slate-700">
              <th className="sticky left-0 z-[2] bg-white px-3 py-2 text-left font-semibold text-sber-dark dark:bg-slate-800 dark:text-sber-light">
                Ключ
              </th>
              <th className="bg-white px-3 py-2 text-left font-semibold text-sber-dark dark:bg-slate-800 dark:text-sber-light">
                Краткое название
              </th>
              {EFFECTIVENESS_MATRIX_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className="px-1 py-2 text-center font-semibold text-sber-dark dark:text-sber-light"
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
                className="border-b border-gray-50 dark:border-slate-700/80"
                onMouseEnter={() => setHoveredKey(row.key)}
                onMouseLeave={() => setHoveredKey((current) => (current === row.key ? null : current))}
              >
                <th
                  className="sticky left-0 bg-white px-3 py-1.5 text-left font-medium text-gray-700 dark:bg-slate-800 dark:text-slate-200"
                  title={row.name}
                >
                  <span className="cursor-default underline decoration-dotted decoration-gray-300 underline-offset-2">
                    {row.key}
                  </span>
                </th>
                <td
                  className="truncate px-3 py-1.5 text-left text-gray-700 dark:text-slate-200"
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
                      className="border border-white/40 py-2.5 dark:border-slate-800/60"
                      style={{ backgroundColor: color }}
                      title={`${column.label}: ${rating}`}
                      aria-label={`${column.label}: ${rating}`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hoveredRow ? (
        <p className="shrink-0 truncate text-[11px] text-gray-600 dark:text-slate-300" title={hoveredRow.name}>
          <span className="font-semibold text-sber-dark dark:text-sber-light">{hoveredRow.key}</span>
          {': '}
          {hoveredRow.name}
        </p>
      ) : (
        <p className="shrink-0 text-[11px] text-gray-400 dark:text-slate-500">
          Наведите на ключ проверки, чтобы увидеть название
        </p>
      )}

      <ul className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-gray-600 dark:text-slate-300">
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
  );
}
