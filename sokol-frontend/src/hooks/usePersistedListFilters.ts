import { useEffect, useState, type SetStateAction } from 'react';
import {
  CHECK_LIST_FILTERS_KEY,
  EMPTY_CHECK_LIST_FILTERS,
  EMPTY_RECOMMENDATION_LIST_FILTERS,
  RECOMMENDATION_LIST_FILTERS_KEY,
  parseStoredCheckListFilters,
  parseStoredRecommendationListFilters,
  readSessionJson,
  storeCheckListFilters,
  storeRecommendationListFilters,
  writeSessionJson,
} from '../utils/listFilterSession';

function bindFilter<T extends object, K extends keyof T>(
  setState: (update: (current: T) => T) => void,
  key: K,
) {
  return (value: SetStateAction<T[K]>) => {
    setState((current) => ({
      ...current,
      [key]:
        typeof value === 'function'
          ? (value as (prev: T[K]) => T[K])(current[key])
          : value,
    }));
  };
}

function usePersistedFilters<T extends object>(
  storageKey: string,
  empty: T,
  parse: (value: unknown) => T,
  store: (value: T) => unknown,
) {
  const [filters, setFilters] = useState<T>(() => parse(readSessionJson(storageKey)) ?? empty);
  useEffect(() => {
    writeSessionJson(storageKey, store(filters));
  }, [filters, parse, storageKey, store]);
  return [filters, setFilters] as const;
}

export function useCheckListFilters() {
  const [filters, setFilters] = usePersistedFilters(
    CHECK_LIST_FILTERS_KEY,
    EMPTY_CHECK_LIST_FILTERS,
    parseStoredCheckListFilters,
    storeCheckListFilters,
  );
  return {
    ...filters,
    setIdFilter: bindFilter(setFilters, 'idFilter'),
    setKeyFilter: bindFilter(setFilters, 'keyFilter'),
    setNameFilter: bindFilter(setFilters, 'nameFilter'),
    setCheckTypes: bindFilter(setFilters, 'checkTypes'),
    setCheckViews: bindFilter(setFilters, 'checkViews'),
    setStatuses: bindFilter(setFilters, 'statuses'),
    setCheckLeaders: bindFilter(setFilters, 'checkLeaders'),
    setShowOnlyMe: bindFilter(setFilters, 'showOnlyMe'),
    setStartDateFrom: bindFilter(setFilters, 'startDateFrom'),
    setStartDateTo: bindFilter(setFilters, 'startDateTo'),
    resetFilters: () => setFilters(() => EMPTY_CHECK_LIST_FILTERS),
  };
}

export function useRecommendationListFilters() {
  const [filters, setFilters] = usePersistedFilters(
    RECOMMENDATION_LIST_FILTERS_KEY,
    EMPTY_RECOMMENDATION_LIST_FILTERS,
    parseStoredRecommendationListFilters,
    storeRecommendationListFilters,
  );
  return {
    ...filters,
    setIdFilter: bindFilter(setFilters, 'idFilter'),
    setKeyFilter: bindFilter(setFilters, 'keyFilter'),
    setNameFilter: bindFilter(setFilters, 'nameFilter'),
    setAdditionalIndicators: bindFilter(setFilters, 'additionalIndicators'),
    setAuditObjects: bindFilter(setFilters, 'auditObjects'),
    setIndicators: bindFilter(setFilters, 'indicators'),
    setCheckViews: bindFilter(setFilters, 'checkViews'),
    setMaterialityLevels: bindFilter(setFilters, 'materialityLevels'),
    setAuditors: bindFilter(setFilters, 'auditors'),
    setManagers: bindFilter(setFilters, 'managers'),
    setShowOnlyMe: bindFilter(setFilters, 'showOnlyMe'),
    setDeadlineFrom: bindFilter(setFilters, 'deadlineFrom'),
    setDeadlineTo: bindFilter(setFilters, 'deadlineTo'),
    resetFilters: () => setFilters(() => EMPTY_RECOMMENDATION_LIST_FILTERS),
  };
}
