export type PeriodGranularity = 'month' | 'quarter' | 'year';

export type PeriodBucket = {
  key: string;
  label: string;
  sortKey: number;
};

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

/** First calendar day of the period, e.g. 01.03.2025 */
export function formatPeriodFirstDay(year: number, monthIndex: number) {
  return `01.${pad2(monthIndex + 1)}.${year}`;
}

export function getPeriodBucket(dateMs: number, granularity: PeriodGranularity): PeriodBucket {
  const date = new Date(dateMs);
  const year = date.getFullYear();
  const month = date.getMonth();

  if (granularity === 'year') {
    return {
      key: String(year),
      label: formatPeriodFirstDay(year, 0),
      sortKey: year,
    };
  }

  if (granularity === 'quarter') {
    const quarter = Math.floor(month / 3) + 1;
    const quarterStartMonth = (quarter - 1) * 3;
    return {
      key: `${year}-Q${quarter}`,
      label: `${formatPeriodFirstDay(year, quarterStartMonth)} (Q${quarter})`,
      sortKey: year * 10 + quarter,
    };
  }

  return {
    key: `${year}-${pad2(month + 1)}`,
    label: formatPeriodFirstDay(year, month),
    sortKey: year * 100 + month + 1,
  };
}

export function collectPeriodOptions(
  dateMsList: Array<number | null>,
  granularity: PeriodGranularity,
): PeriodBucket[] {
  const map = new Map<string, PeriodBucket>();
  dateMsList.forEach((ms) => {
    if (ms === null) {
      return;
    }
    const bucket = getPeriodBucket(ms, granularity);
    map.set(bucket.key, bucket);
  });
  return [...map.values()].sort((a, b) => a.sortKey - b.sortKey);
}

export function isDateInSelectedPeriods(
  dateMs: number,
  granularity: PeriodGranularity,
  selectedPeriodKeys: string[],
): boolean {
  if (selectedPeriodKeys.length === 0) {
    return true;
  }
  return selectedPeriodKeys.includes(getPeriodBucket(dateMs, granularity).key);
}

export function periodGranularityHint(granularity: PeriodGranularity) {
  if (granularity === 'month') {
    return 'Отметьте месяцы (по 1-му числу)';
  }
  if (granularity === 'quarter') {
    return 'Отметьте кварталы (по 1-му числу)';
  }
  return 'Отметьте годы (по 1 января)';
}
