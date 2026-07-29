/** Преобразует DD.MM.YYYY или ISO в YYYY-MM-DD для хранения. */
export function normalizeRecommendationDeadline(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const toIsoIfValid = (year: number, month: number, day: number) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return '';
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const dotted = trimmed.match(/^(\d{1,2})\.(\d{2})\.(\d{4})$/);
  if (dotted) {
    const [, day, month, year] = dotted;
    return toIsoIfValid(Number(year), Number(month), Number(day));
  }
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return toIsoIfValid(Number(year), Number(month), Number(day));
  }
  return '';
}
