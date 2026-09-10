export type ChartLegendLabelMode = 'value' | 'percent' | 'both' | 'name';

export function formatChartLegendText({
  name,
  value,
  percent,
  mode,
  percentFirst = false,
}: {
  name: string;
  value: number;
  percent: number;
  mode: ChartLegendLabelMode;
  percentFirst?: boolean;
}) {
  if (mode !== 'both') {
    return name;
  }

  return percentFirst
    ? `${name}: ${percent}% (${value})`
    : `${name}: ${value} (${percent}%)`;
}
