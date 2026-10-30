import { parseDateValue, toIsoDate } from './dates';

export const CHECK_LIST_FILTERS_KEY = 'sokol.checks.listFilters';
export const RECOMMENDATION_LIST_FILTERS_KEY = 'sokol.recommendations.listFilters';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type CheckListFilters = {
  idFilter: string;
  keyFilter: string;
  nameFilter: string;
  checkTypes: string[];
  checkViews: string[];
  statuses: string[];
  checkLeaders: string[];
  showOnlyMe: boolean;
  startDateFrom: Date | null;
  startDateTo: Date | null;
};

export type RecommendationListFilters = {
  idFilter: string;
  keyFilter: string;
  nameFilter: string;
  additionalIndicators: string[];
  auditObjects: string[];
  indicators: string[];
  checkViews: string[];
  materialityLevels: string[];
  auditors: string[];
  managers: string[];
  showOnlyMe: boolean;
  deadlineFrom: Date | null;
  deadlineTo: Date | null;
};

export const EMPTY_CHECK_LIST_FILTERS: CheckListFilters = {
  idFilter: '',
  keyFilter: '',
  nameFilter: '',
  checkTypes: [],
  checkViews: [],
  statuses: [],
  checkLeaders: [],
  showOnlyMe: false,
  startDateFrom: null,
  startDateTo: null,
};

export const EMPTY_RECOMMENDATION_LIST_FILTERS: RecommendationListFilters = {
  idFilter: '',
  keyFilter: '',
  nameFilter: '',
  additionalIndicators: [],
  auditObjects: [],
  indicators: [],
  checkViews: [],
  materialityLevels: [],
  auditors: [],
  managers: [],
  showOnlyMe: false,
  deadlineFrom: null,
  deadlineTo: null,
};

type StoredDates<T, K extends keyof T> = Omit<T, K> & Record<K, string | null>;

export type StoredCheckListFilters = StoredDates<CheckListFilters, 'startDateFrom' | 'startDateTo'>;
export type StoredRecommendationListFilters = StoredDates<
  RecommendationListFilters,
  'deadlineFrom' | 'deadlineTo'
>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function readBoolean(value: unknown) {
  return value === true;
}

function readIsoDate(value: unknown) {
  return typeof value === 'string' && ISO_DATE.test(value) ? value : null;
}

export function isoToLocalDate(value: string | null) {
  if (!value) {
    return null;
  }
  const ms = parseDateValue(value);
  return ms === null ? null : new Date(ms);
}

export function localDateToIso(value: Date | null) {
  return toIsoDate(value) ?? null;
}

export function parseStoredCheckListFilters(value: unknown): CheckListFilters {
  const raw = asRecord(value);
  if (!raw) {
    return EMPTY_CHECK_LIST_FILTERS;
  }
  return {
    idFilter: readString(raw.idFilter),
    keyFilter: readString(raw.keyFilter),
    nameFilter: readString(raw.nameFilter),
    checkTypes: readStringList(raw.checkTypes),
    checkViews: readStringList(raw.checkViews),
    statuses: readStringList(raw.statuses),
    checkLeaders: readStringList(raw.checkLeaders),
    showOnlyMe: readBoolean(raw.showOnlyMe),
    startDateFrom: isoToLocalDate(readIsoDate(raw.startDateFrom)),
    startDateTo: isoToLocalDate(readIsoDate(raw.startDateTo)),
  };
}

export function storeCheckListFilters(filters: CheckListFilters): StoredCheckListFilters {
  return {
    ...filters,
    startDateFrom: localDateToIso(filters.startDateFrom),
    startDateTo: localDateToIso(filters.startDateTo),
  };
}

export function parseStoredRecommendationListFilters(value: unknown): RecommendationListFilters {
  const raw = asRecord(value);
  if (!raw) {
    return EMPTY_RECOMMENDATION_LIST_FILTERS;
  }
  return {
    idFilter: readString(raw.idFilter),
    keyFilter: readString(raw.keyFilter),
    nameFilter: readString(raw.nameFilter),
    additionalIndicators: readStringList(raw.additionalIndicators),
    auditObjects: readStringList(raw.auditObjects),
    indicators: readStringList(raw.indicators),
    checkViews: readStringList(raw.checkViews),
    materialityLevels: readStringList(raw.materialityLevels),
    auditors: readStringList(raw.auditors),
    managers: readStringList(raw.managers),
    showOnlyMe: readBoolean(raw.showOnlyMe),
    deadlineFrom: isoToLocalDate(readIsoDate(raw.deadlineFrom)),
    deadlineTo: isoToLocalDate(readIsoDate(raw.deadlineTo)),
  };
}

export function storeRecommendationListFilters(
  filters: RecommendationListFilters,
): StoredRecommendationListFilters {
  return {
    ...filters,
    deadlineFrom: localDateToIso(filters.deadlineFrom),
    deadlineTo: localDateToIso(filters.deadlineTo),
  };
}

export function readSessionJson(key: string): unknown {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function writeSessionJson(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or a full quota should not block the list.
  }
}
