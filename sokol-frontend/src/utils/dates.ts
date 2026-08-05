export function parseDateValue(value?: string): number | null {
  if (!value) {return null;}
  const [year, month, day] = value.split('-').map(Number);
  if (year && month && day) {
    return new Date(year, month - 1, day).getTime();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function toStartOfDayMs(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function toEndOfDayMs(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

export function formatRuDate(value?: string) {
  const parsed = parseDateValue(value);
  if (parsed === null) {return '—';}
  return new Date(parsed).toLocaleDateString('ru-RU');
}

export function toIsoDate(date: Date | null): string | undefined {
  if (!date) {
    return undefined;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse an ISO/date string into a local Date for date pickers, or null if empty/invalid. */
export function toInputDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
