import type { Check } from '../types/check';
import { parseDateValue } from './dates';

function getCheckYear(check: Check): number | null {
  const startMs = parseDateValue(check.start_date);
  if (startMs === null) {
    return null;
  }
  return new Date(startMs).getFullYear();
}

function formatYearlyId(year: number, yearlyNumber: number): string {
  return `${String(year).slice(-2)}-${yearlyNumber}`;
}

function compareChecksForYearlyNumber(a: Check, b: Check) {
  const dateA = parseDateValue(a.start_date) ?? 0;
  const dateB = parseDateValue(b.start_date) ?? 0;
  if (dateA !== dateB) {
    return dateA - dateB;
  }

  const idA = Number(a.id);
  const idB = Number(b.id);
  if (!Number.isNaN(idA) && !Number.isNaN(idB)) {
    return idA - idB;
  }

  return a.id.localeCompare(b.id, 'ru', { numeric: true, sensitivity: 'base' });
}

/** Порядковый номер проверки внутри календарного года (по дате начала). */
export function buildCheckYearlyNumbers(checks: Check[]): Map<string, number> {
  const byYear = new Map<number, Check[]>();

  for (const check of checks) {
    const year = getCheckYear(check);
    if (year === null) {
      continue;
    }
    const group = byYear.get(year) ?? [];
    group.push(check);
    byYear.set(year, group);
  }

  const result = new Map<string, number>();

  for (const group of byYear.values()) {
    const sorted = [...group].sort(compareChecksForYearlyNumber);
    sorted.forEach((check, index) => {
      result.set(check.id, index + 1);
    });
  }

  return result;
}

export function getCheckYearlyNumber(check: Check, yearlyNumbers: Map<string, number>): number | null {
  return yearlyNumbers.get(check.id) ?? null;
}

export function getCheckYearlyId(check: Check, yearlyNumbers: Map<string, number>): string | null {
  const year = getCheckYear(check);
  const yearlyNumber = getCheckYearlyNumber(check, yearlyNumbers);
  if (year === null || yearlyNumber === null) {
    return null;
  }

  return formatYearlyId(year, yearlyNumber);
}

export function getCheckYearlySortValue(check: Check, yearlyNumbers: Map<string, number>): number | null {
  const year = getCheckYear(check);
  const yearlyNumber = getCheckYearlyNumber(check, yearlyNumbers);
  if (year === null || yearlyNumber === null) {
    return null;
  }

  return year * 10000 + yearlyNumber;
}
