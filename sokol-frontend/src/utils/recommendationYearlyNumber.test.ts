import { describe, expect, it } from 'vitest';
import type { Recommendation } from '../types/recommendation';
import {
  buildRecommendationYearlyNumbers,
  getRecommendationYearlyId,
  getRecommendationYearlySortValue,
  resolveRecommendationYearlyDisplayNumber,
} from './recommendationYearlyNumber';

function makeRecommendation(id: string, deadline: string, serialNumber = `key-${id}`): Recommendation {
  return {
    id,
    serial_number: serialNumber,
    sequence_number: 1,
    name: `Recommendation ${id}`,
    description: '',
    indicator: 'не указан',
    materiality_level: 'средний',
    audit_object: ['Object'],
    deadline,
    auditor: 'Auditor',
    manager: 'Manager',
    status: 'unresolved',
    additional_status: 'on_time',
  };
}

describe('buildRecommendationYearlyNumbers', () => {
  it('нумерует рекомендации внутри года по сроку исполнения', () => {
    const recommendations = [
      makeRecommendation('3', '2026-03-01'),
      makeRecommendation('1', '2026-01-02'),
      makeRecommendation('2', '2026-02-01'),
    ];

    const numbers = buildRecommendationYearlyNumbers(recommendations);

    expect(numbers.get('1')).toBe(1);
    expect(numbers.get('2')).toBe(2);
    expect(numbers.get('3')).toBe(3);
  });

  it('форматирует ID как последние две цифры года и номер внутри года', () => {
    const recommendations = [
      makeRecommendation('25', '2025-11-01'),
      makeRecommendation('26', '2026-01-02'),
      makeRecommendation('27', '2026-08-01'),
    ];
    const numbers = buildRecommendationYearlyNumbers(recommendations);

    expect(getRecommendationYearlyId(recommendations[0], numbers)).toBe('25-1');
    expect(getRecommendationYearlyId(recommendations[1], numbers)).toBe('26-1');
    expect(getRecommendationYearlyId(recommendations[2], numbers)).toBe('26-2');
  });

  it('сортирует ID сначала по году, потом по номеру внутри года', () => {
    const recommendations = [
      makeRecommendation('12', '2026-12-01'),
      makeRecommendation('1', '2025-01-01'),
      makeRecommendation('2', '2026-01-01'),
    ];
    const numbers = buildRecommendationYearlyNumbers(recommendations);

    expect(getRecommendationYearlySortValue(recommendations[0], numbers)).toBe(20260002);
    expect(getRecommendationYearlySortValue(recommendations[1], numbers)).toBe(20250001);
    expect(getRecommendationYearlySortValue(recommendations[2], numbers)).toBe(20260001);
  });

  it('берёт год из ключа проверки, если срока исполнения нет', () => {
    const recommendations = [
      makeRecommendation('1', '2026-01-01', '26KVS08P1'),
      makeRecommendation('2', '', '26KVS08P1'),
    ];
    const numbers = buildRecommendationYearlyNumbers(recommendations);

    expect(getRecommendationYearlyId(recommendations[0], numbers)).toBe('26-1');
    expect(getRecommendationYearlyId(recommendations[1], numbers)).toBe('26-2');
  });
});

describe('resolveRecommendationYearlyDisplayNumber', () => {
  it('возвращает номер внутри года для существующей рекомендации', () => {
    const recommendations = [
      makeRecommendation('1', '2026-01-02'),
      makeRecommendation('2', '2026-08-01'),
    ];

    expect(
      resolveRecommendationYearlyDisplayNumber(recommendations, {
        recommendationId: '2',
        fallback: recommendations[1],
      }),
    ).toBe(2);
  });

  it('прогнозирует номер для новой рекомендации по сроку исполнения', () => {
    const recommendations = [makeRecommendation('1', '2026-01-02')];

    expect(
      resolveRecommendationYearlyDisplayNumber(recommendations, {
        deadline: '2026-12-31',
      }),
    ).toBe(2);
  });

  it('прогнозирует номер по ключу проверки без срока исполнения', () => {
    const recommendations = [makeRecommendation('1', '2026-01-02', '26KVS08P1')];

    expect(
      resolveRecommendationYearlyDisplayNumber(recommendations, {
        serialNumber: '26KVS08P1',
      }),
    ).toBe(2);
  });
});
