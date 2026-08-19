export function completeNamedDistribution<T extends string>(
  items: Array<{ name: string; value: number }>,
  options: ReadonlyArray<{ value: T; label: string }>,
  colorForValue: (value: T) => string,
): Array<{ name: string; value: number; color: string }> {
  const byName = new Map(items.map((item) => [item.name, item.value]));
  return options.map((option) => ({
    name: option.label,
    value: byName.get(option.label) ?? 0,
    color: colorForValue(option.value),
  }));
}

export function distributionHasValues(items: Array<{ value: number }>) {
  return items.some((item) => item.value > 0);
}
