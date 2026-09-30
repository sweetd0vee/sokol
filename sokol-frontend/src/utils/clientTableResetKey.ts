/** Stable reset key for `useClientTable` when filter deps change. */
export function buildClientTableResetKey(parts: Array<string | number | boolean | null | undefined>): string {
  return parts
    .map((part) => {
      if (part === null || part === undefined) {
        return '';
      }
      if (typeof part === 'boolean') {
        return part ? '1' : '0';
      }
      return String(part);
    })
    .join('\u0001');
}

/** Join multi-select filter values for inclusion in a reset key. */
export function joinFilterValues(values: readonly string[]): string {
  return values.join('\u0000');
}
