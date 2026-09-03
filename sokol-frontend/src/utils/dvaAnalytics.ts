export const DVA_AUDITOR_BAR_LIMIT = 12;

export function rankAuditorRows<T extends { name: string }>(
  rows: T[],
  metric: (row: T) => number,
  options?: { limit?: number; direction?: 'asc' | 'desc'; includeZeros?: boolean },
): T[] {
  const direction = options?.direction ?? 'desc';
  const limit = options?.limit ?? DVA_AUDITOR_BAR_LIMIT;
  const includeZeros = options?.includeZeros ?? false;

  return [...rows]
    .filter((row) => includeZeros || metric(row) > 0)
    .sort((left, right) => {
      const diff =
        direction === 'desc' ? metric(right) - metric(left) : metric(left) - metric(right);
      return diff || left.name.localeCompare(right.name, 'ru');
    })
    .slice(0, limit);
}
