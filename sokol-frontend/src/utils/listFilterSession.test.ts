import { describe, expect, it } from 'vitest';
import {
  EMPTY_CHECK_LIST_FILTERS,
  EMPTY_RECOMMENDATION_LIST_FILTERS,
  parseStoredCheckListFilters,
  parseStoredRecommendationListFilters,
  storeCheckListFilters,
  storeRecommendationListFilters,
} from './listFilterSession';

describe('list filter session', () => {
  it('restores check filters, including the date range, and drops broken values', () => {
    const restored = parseStoredCheckListFilters({
      idFilter: '26-1',
      keyFilter: 12,
      nameFilter: 'казна',
      checkTypes: ['planned', 1],
      checkViews: ['ИТ'],
      statuses: 'completed',
      checkLeaders: ['Иванов И.И.'],
      showOnlyMe: true,
      startDateFrom: '2026-01-10',
      startDateTo: 'not-a-date',
    });

    expect(restored.idFilter).toBe('26-1');
    expect(restored.keyFilter).toBe('');
    expect(restored.checkTypes).toEqual(['planned']);
    expect(restored.statuses).toEqual([]);
    expect(restored.showOnlyMe).toBe(true);
    expect(restored.startDateFrom).toEqual(new Date(2026, 0, 10));
    expect(restored.startDateTo).toBeNull();
  });

  it('stores check dates as calendar days and reads them back', () => {
    const stored = storeCheckListFilters({
      ...EMPTY_CHECK_LIST_FILTERS,
      nameFilter: 'аудит',
      startDateFrom: new Date(2026, 1, 2),
      startDateTo: new Date(2026, 1, 20),
    });
    expect(stored.startDateFrom).toBe('2026-02-02');
    expect(parseStoredCheckListFilters(stored).startDateTo).toEqual(new Date(2026, 1, 20));
  });

  it('restores recommendation filters and ignores a non-object payload', () => {
    expect(parseStoredRecommendationListFilters(null)).toEqual(EMPTY_RECOMMENDATION_LIST_FILTERS);
    const stored = storeRecommendationListFilters({
      ...EMPTY_RECOMMENDATION_LIST_FILTERS,
      indicators: ['исполнено в ходе аудита'],
      deadlineFrom: new Date(2026, 9, 1),
    });
    expect(parseStoredRecommendationListFilters(stored)).toMatchObject({
      indicators: ['исполнено в ходе аудита'],
      deadlineFrom: new Date(2026, 9, 1),
      deadlineTo: null,
    });
  });
});
