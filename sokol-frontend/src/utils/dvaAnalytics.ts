export const DVA_AUDITOR_BAR_LIMIT = 12;

export function unresolvedSharePercent(unresolved: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((unresolved / total) * 1000) / 10;
}

export function formatUnresolvedShare(unresolved: number, total: number): string {
  return `${String(unresolvedSharePercent(unresolved, total)).replace('.', ',')}%`;
}

export function formatUnresolvedBarLabel(unresolved: number, total: number): string {
  return `${unresolved} · ${formatUnresolvedShare(unresolved, total)}`;
}

export function formatUnresolvedCheckLine(item: {
  key: string;
  short_name?: string;
  count?: number;
}): string {
  const title = item.short_name ? `${item.key} — ${item.short_name}` : item.key;
  const count = item.count ?? 0;
  return count > 0 ? `${title} (${count})` : title;
}

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
