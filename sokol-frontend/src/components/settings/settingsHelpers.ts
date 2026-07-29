function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function filterBySearch<T>(
  items: T[],
  search: string,
  toSearchText: (item: T) => string,
) {
  const normalized = normalizeSearch(search);
  if (!normalized) {return items;}
  return items.filter((item) => toSearchText(item).toLowerCase().includes(normalized));
}
