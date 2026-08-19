import type { Check } from '../types/check';
import { getCheckTypeLabel, getCheckViewLabel } from '../constants/checks';
import { getCheckYearlyId, getCheckYearlySortValue } from './checkYearlyNumber';
import { parseDateValue } from './dates';
import { matchesDateRange, matchesSelected } from './listTable';

export type CheckSortKey =
  | 'id'
  | 'serial_number'
  | 'check_name'
  | 'check_type'
  | 'check_view'
  | 'start_date'
  | 'check_leader'
  | 'status';

const CHECK_STATUS_ORDER: Record<string, number> = {
  not_started: 0,
  in_progress: 1,
  completed: 2,
};

export function getCheckSortValue(
  check: Check,
  key: CheckSortKey,
  yearlyNumbers: Map<string, number>,
) {
  switch (key) {
    case 'id':
      return getCheckYearlySortValue(check, yearlyNumbers);
    case 'serial_number':
      return check.serial_number;
    case 'check_name':
      return check.check_name;
    case 'check_type':
      return getCheckTypeLabel(check.check_type);
    case 'check_view':
      return getCheckViewLabel(check.check_view);
    case 'start_date':
      return parseDateValue(check.start_date);
    case 'check_leader':
      return check.check_leader;
    case 'status':
      return CHECK_STATUS_ORDER[check.status] ?? 999;
    default:
      return '';
  }
}

export type CheckListFilters = {
  idFilter: string;
  keyFilter: string;
  nameFilter: string;
  checkTypes: string[];
  checkViews: string[];
  statuses: string[];
  checkLeaders: string[];
  showOnlyMe: boolean;
  normalizedMyName: string;
  startDateFrom: Date | null;
  startDateTo: Date | null;
};

export function filterChecks(
  checks: Check[],
  yearlyNumbers: Map<string, number>,
  filters: CheckListFilters,
) {
  return checks.filter((check) => {
    if (filters.idFilter) {
      const yearlyId = getCheckYearlyId(check, yearlyNumbers) ?? '';
      if (!yearlyId.includes(filters.idFilter.trim())) {
        return false;
      }
    }
    if (filters.keyFilter && !check.serial_number.toLowerCase().includes(filters.keyFilter.trim().toLowerCase())) {
      return false;
    }
    if (filters.nameFilter && !check.check_name.toLowerCase().includes(filters.nameFilter.trim().toLowerCase())) {
      return false;
    }
    if (!matchesSelected(filters.checkTypes, check.check_type)) {
      return false;
    }
    if (!matchesSelected(filters.checkViews, check.check_view)) {
      return false;
    }
    if (!matchesSelected(filters.statuses, check.status)) {
      return false;
    }
    if (!matchesSelected(filters.checkLeaders, check.check_leader)) {
      return false;
    }
    if (filters.showOnlyMe) {
      if (!filters.normalizedMyName) {
        return false;
      }
      if (check.check_leader.toLowerCase() !== filters.normalizedMyName) {
        return false;
      }
    }
    return matchesDateRange(parseDateValue(check.start_date), filters.startDateFrom, filters.startDateTo);
  });
}
