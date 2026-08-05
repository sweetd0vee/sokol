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

export function collectCalendarPeriodOptions(
  dateMsList: Array<number | null>,
  granularity: PeriodGranularity,
): PeriodBucket[] {
  const validDates = dateMsList.filter((value): value is number => value !== null);
  if (validDates.length === 0) {
    const currentYear = new Date().getFullYear();
    return granularity === 'year'
      ? [getPeriodBucket(new Date(currentYear, 0, 1).getTime(), 'year')]
      : collectPeriodOptions([new Date(currentYear, 0, 1).getTime()], granularity);
  }

  const minYear = new Date(Math.min(...validDates)).getFullYear();
  const maxYear = new Date(Math.max(...validDates)).getFullYear();
  const result: PeriodBucket[] = [];

  for (let year = minYear; year <= maxYear; year += 1) {
    if (granularity === 'year') {
      result.push(getPeriodBucket(new Date(year, 0, 1).getTime(), 'year'));
    } else if (granularity === 'quarter') {
      [0, 3, 6, 9].forEach((month) => {
        result.push(getPeriodBucket(new Date(year, month, 1).getTime(), 'quarter'));
      });
    } else {
      for (let month = 0; month < 12; month += 1) {
        result.push(getPeriodBucket(new Date(year, month, 1).getTime(), 'month'));
      }
    }
  }

  return result;
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

export function isDateInAnySelectedPeriods(
  dateMs: number,
  selections: {
    years: string[];
    quarters: string[];
    months: string[];
  },
): boolean {
  const hasSelection =
    selections.years.length > 0 || selections.quarters.length > 0 || selections.months.length > 0;
  if (!hasSelection) {
    return true;
  }

  return (
    isDateInSelectedPeriods(dateMs, 'year', selections.years)
    || isDateInSelectedPeriods(dateMs, 'quarter', selections.quarters)
    || isDateInSelectedPeriods(dateMs, 'month', selections.months)
  );
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
