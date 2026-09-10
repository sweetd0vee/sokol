import { CHART_LEGEND_STYLE } from './chartTokens';

export function ChartLegend({
  items,
  fontSize = CHART_LEGEND_STYLE.fontSize,
  fontWeight = CHART_LEGEND_STYLE.fontWeight,
  layout = 'column',
}: {
  items: Array<{ key?: string; color?: string; label: string }>;
  fontSize?: number;
  fontWeight?: number;
  layout?: 'column' | 'row';
}) {
  const isRow = layout === 'row';
  return (
    <ul
      className={
        isRow
          ? 'mx-auto flex w-fit max-w-full list-none flex-row flex-nowrap items-center justify-center gap-x-4 px-2 pb-1 pt-1'
          : 'mx-auto flex w-fit max-w-full list-none flex-col items-start gap-y-1 px-2 pb-1 pt-1'
      }
      style={{
        fontFamily: 'inherit',
        fontSize,
        fontWeight,
        color: CHART_LEGEND_STYLE.color,
      }}
    >
      {items.map((item, index) => (
        <li
          key={item.key ?? `${item.label}-${index}`}
          className="recharts-legend-item grid grid-cols-[14px_auto] items-center gap-x-2 whitespace-nowrap"
        >
          <span
            className="recharts-legend-icon box-border block h-3.5 w-3.5 shrink-0 rounded-sm"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="text-left leading-tight" style={{ color: CHART_LEGEND_STYLE.color }}>
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Recharts `Legend` content: black labels and square color swatches. */
export function ChartRechartsSquareLegend({
  payload,
}: {
  payload?: ReadonlyArray<{ value?: string; color?: string }>;
}) {
  return (
    <ChartLegend
      layout="row"
      items={(payload ?? []).map((entry, index) => ({
        key: `${entry.value ?? 'item'}-${index}`,
        color: entry.color,
        label: String(entry.value ?? ''),
      }))}
    />
  );
}
