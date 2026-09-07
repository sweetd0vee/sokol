import { describe, expect, it } from 'vitest';
import type { Check } from '../types/check';
import type { Recommendation } from '../types/recommendation';
import {
  buildCheckViewBySerial,
  filterRecommendations,
  getRecommendationCheckView,
  getRecommendationSortValue,
  type RecommendationListFilters,
} from './recommendationList';

function makeRecommendation(
  overrides: Partial<Recommendation> & Pick<Recommendation, 'id' | 'serial_number'>,
): Recommendation {
  return {
    sequence_number: 1,
    name: `Рек ${overrides.id}`,
    description: '',
    indicator: 'не указан',
    materiality_level: 'средний',
    audit_object: ['Департамент А'],
    deadline: '2026-01-15',
    auditor: 'Аудитор 1',
    manager: 'Менеджер 1',
    status: 'in_progress',
    additional_status: 'on_time',
    ...overrides,
  };
}

function makeCheck(
  overrides: Partial<Check> & Pick<Check, 'id' | 'serial_number' | 'check_view'>,
): Check {
  return {
    check_name: `Проверка ${overrides.id}`,
    check_type: 'planned',
    check_quarter: 1,
    start_date: '2026-01-01',
    check_leader: 'Лидер 1',
    status: 'in_progress',
    created_at: '2026-01-01',
    ...overrides,
  };
}

const emptyFilters: RecommendationListFilters = {
  idFilter: '',
  keyFilter: '',
  nameFilter: '',
  statuses: [],
  additionalIndicators: [],
  auditObjects: [],
  indicators: [],
  checkViews: [],
  materialityLevels: [],
  auditors: [],
  managers: [],
  showOnlyMe: false,
  trimmedMyName: '',
  deadlineFrom: null,
  deadlineTo: null,
};

describe('recommendation check view from check key', () => {
  it('resolves вид проверки by recommendation serial_number', () => {
    const checks = [
      makeCheck({ id: '1', serial_number: '26KVS3P1', check_view: 'ИТ' }),
      makeCheck({ id: '2', serial_number: '26KVS3P2', check_view: 'Корпо' }),
    ];
    const bySerial = buildCheckViewBySerial(checks);
    const recommendation = makeRecommendation({ id: '10', serial_number: '26KVS3P1' });

    expect(getRecommendationCheckView(recommendation, bySerial)).toBe('ИТ');
    expect(getRecommendationSortValue(recommendation, 'check_view', new Map(), bySerial)).toBe('ИТ');
  });

  it('filters recommendations by linked check view', () => {
    const bySerial = buildCheckViewBySerial([
      makeCheck({ id: '1', serial_number: 'CHK-1', check_view: 'ИТ' }),
      makeCheck({ id: '2', serial_number: 'CHK-2', check_view: 'Корпо' }),
    ]);
    const recommendations = [
      makeRecommendation({ id: '1', serial_number: 'CHK-1' }),
      makeRecommendation({ id: '2', serial_number: 'CHK-2' }),
      makeRecommendation({ id: '3', serial_number: 'MISSING' }),
    ];

    const filtered = filterRecommendations(
      recommendations,
      new Map(),
      { ...emptyFilters, checkViews: ['ИТ'] },
      bySerial,
    );

    expect(filtered.map((item) => item.id)).toEqual(['1']);
  });
});
