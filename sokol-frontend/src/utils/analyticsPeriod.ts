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
function formatPeriodFirstDay(year: number, monthIndex: number) {
  return `01.${pad2(monthIndex + 1)}.${year}`;
}

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

export function labelFromPeriodKey(key: string, granularity: PeriodGranularity) {
  if (granularity === 'year') {
    const year = Number(key);
    return Number.isFinite(year) ? String(year) : key;
  }

  if (granularity === 'quarter') {
    const [yearValue, quarterValue] = key.split('-Q');
    const year = Number(yearValue);
    const quarter = Number(quarterValue);
    if (Number.isFinite(year) && Number.isFinite(quarter)) {
      const quarterStartMonth = (quarter - 1) * 3;
      return `${formatPeriodFirstDay(year, quarterStartMonth)} (Q${quarter})`;
    }
    return key;
  }

  const [yearValue, monthValue] = key.split('-');
  const year = Number(yearValue);
  const month = Number(monthValue);
  return Number.isFinite(year) && Number.isFinite(month) ? formatPeriodFirstDay(year, month - 1) : key;
}

function collectPeriodOptions(
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
  const matches: boolean[] = [];

  // Empty slice means "not used", not "match all" — otherwise selecting only years
  // would always pass via empty quarters/months (OR with true).
  if (selections.years.length > 0) {
    matches.push(isDateInSelectedPeriods(dateMs, 'year', selections.years));
  }
  if (selections.quarters.length > 0) {
    matches.push(isDateInSelectedPeriods(dateMs, 'quarter', selections.quarters));
  }
  if (selections.months.length > 0) {
    matches.push(isDateInSelectedPeriods(dateMs, 'month', selections.months));
  }

  if (matches.length === 0) {
    return true;
  }

  return matches.some(Boolean);
}

/** Map UI labels (e.g. «2025» or «01.01.2025 (Q1)») to period keys used by filters. */
export function periodKeysFromLabels(
  dateMsList: Array<number | null>,
  granularity: PeriodGranularity,
  labels: string[],
): string[] {
  if (labels.length === 0) {
    return [];
  }
  return collectCalendarPeriodOptions(dateMsList, granularity)
    .filter((item) => labels.includes(item.label))
    .map((item) => item.key);
}
