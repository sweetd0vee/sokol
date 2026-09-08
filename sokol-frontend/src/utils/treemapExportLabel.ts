export function formatTreemapExportLabel(
  name: string,
  value: number,
  materiality?: {
    низкий: number;
    средний: number;
    высокий: number;
  },
  views?: Array<{ name: string; value: number }>,
) {
  if (views && views.length > 0) {
    return [
      `${name}: ${value}`,
      ...views.map((view) => `${view.name}: ${view.value}`),
    ].join('\n');
  }
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
