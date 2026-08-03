export type PeriodGranularity = 'month' | 'quarter' | 'year';

export type PeriodBucket = {
  key: string;
  label: string;
  sortKey: number;
};

export function getPeriodBucket(dateMs: number, granularity: PeriodGranularity): PeriodBucket {
  const date = new Date(dateMs);
  const year = date.getFullYear();
  const month = date.getMonth();

  if (granularity === 'year') {
    return {
      key: String(year),
      label: String(year),
      sortKey: year,
    };
  }

  if (granularity === 'quarter') {
    const quarter = Math.floor(month / 3) + 1;
    return {
      key: `${year}-Q${quarter}`,
      label: `Q${quarter} ${year}`,
      sortKey: year * 10 + quarter,
    };
  }

  const monthLabel = date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
  return {
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
    label: monthLabel.replace('.', ''),
    sortKey: year * 100 + month + 1,
  };
}
