export function completeNamedDistribution<T extends string>(
  items: Array<{ name: string; value: number }>,
  options: ReadonlyArray<{ value: T; label: string }>,
  colorForValue: (value: T) => string,
): Array<{ name: string; value: number; color: string }> {
  const byName = new Map<string, number>();
  for (const item of items) {
    byName.set(item.name, (byName.get(item.name) ?? 0) + item.value);
  }
  return options.map((option) => ({
    name: option.label,
    value: byName.get(option.label) ?? 0,
    color: colorForValue(option.value),
  }));
}

export function distributionHasValues(items: Array<{ value: number }>) {
  return items.some((item) => item.value > 0);
}

/** Top-N items by `value` descending (no "Прочие" bucket). */
export function topByValue<T extends { value: number }>(items: T[], limit = 10): T[] {
  return [...items].sort((left, right) => right.value - left.value).slice(0, limit);
}

export function buildTopNamedDistribution(
  items: Array<{ name: string; value: number }>,
  options?: { topN?: number; othersLabel?: string },
): Array<{ name: string; value: number }> {
  const topN = options?.topN ?? 8;
  const othersLabel = options?.othersLabel ?? 'Прочие';
  const positive = items.filter((item) => item.value > 0);

  if (positive.length === 0) {
    return [];
  }

  const sorted = [...positive].sort(
    (left, right) => right.value - left.value || left.name.localeCompare(right.name, 'ru'),
  );
  const top = sorted.slice(0, topN);
  const othersTotal = sorted.slice(topN).reduce((sum, item) => sum + item.value, 0);

  if (othersTotal > 0) {
    return [...top, { name: othersLabel, value: othersTotal }];
  }

  return top;
}
