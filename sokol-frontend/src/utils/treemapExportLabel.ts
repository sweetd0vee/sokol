export function formatTreemapExportLabel(
  name: string,
  value: number,
  materiality?: {
    низкий: number;
    средний: number;
    высокий: number;
  },
) {
  if (!materiality) {
    return `${name}: ${value}`;
  }
  return [
    `${name}: ${value}`,
    `Высокий: ${materiality.высокий}`,
    `Средний: ${materiality.средний}`,
    `Низкий: ${materiality.низкий}`,
  ].join('\n');
}
