import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import {
  EFFECTIVENESS_LEGEND,
  EFFECTIVENESS_MATRIX_COLUMNS,
  buildEffectivenessColumnShares,
  getEffectivenessToneColor,
  type EffectivenessColumnShare,
  type EffectivenessMatrixRow,
} from '../../utils/checkAnalytics';

type EffectivenessMatrixChartProps = {
  rows: EffectivenessMatrixRow[];
};

function ColumnSharePie({ shares }: { shares: EffectivenessColumnShare[] }) {
  const data = shares.map((share) => ({
    name: share.label,
    value: share.count,
    color: share.color,
    percent: share.percent,
  }));

  if (data.length === 0) {
    return <span className="text-xs text-gray-400 dark:text-slate-500">—</span>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <PieChart width={92} height={92}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={40}
          innerRadius={0}
          stroke="none"
          isAnimationActive={false}
        >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name, item) => {
              const percent = (item?.payload as { percent?: number } | undefined)?.percent ?? 0;
              return [`${value} (${percent}%)`, name];
            }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
              fontSize: 14,
            }}
          />
        </PieChart>
      <ul className="flex max-w-[7rem] flex-col gap-1 text-[11px] leading-tight text-gray-600 dark:text-slate-300">
        {shares.map((share) => (
          <li key={share.tone} className="inline-flex items-center justify-center gap-1.5">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-black/5"
              style={{ backgroundColor: share.color }}
              aria-hidden
            />
            <span className="font-semibold tabular-nums">{share.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-100 dark:border-slate-700">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse text-sm">
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
          </table>
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-gray-50/90 dark:border-slate-600 dark:bg-slate-900/60">
          <div className="flex w-full items-stretch">
            <div className="flex w-[56%] shrink-0 items-center px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Доля оценок
            </div>
            {EFFECTIVENESS_MATRIX_COLUMNS.map((column) => (
              <div key={column.key} className="flex w-[11%] items-center justify-center px-1 py-4">
                <ColumnSharePie shares={columnShares[column.key]} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {hoveredRow ? (
        <p className="shrink-0 truncate text-xs text-gray-600 dark:text-slate-300" title={hoveredRow.name}>
          <span className="font-semibold text-sber-dark dark:text-sber-light">{hoveredRow.key}</span>
          {': '}
          {hoveredRow.name}
        </p>
      ) : (
        <p className="shrink-0 text-xs text-gray-400 dark:text-slate-500">
          Наведите на ключ проверки, чтобы увидеть название
        </p>
      )}

      <ul className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-600 dark:text-slate-300">
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
