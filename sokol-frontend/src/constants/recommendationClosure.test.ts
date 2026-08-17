import { describe, expect, it } from 'vitest';
import { getRecommendationExecutionInfo } from './recommendationClosure';

describe('getRecommendationExecutionInfo', () => {
  it('joins comments from execution deadline and control removal', () => {
    expect(
      getRecommendationExecutionInfo({
        closure_information: 'Подтверждены документы.',
        remove_from_control_comment: 'Снято после проверки.',
      }),
    ).toBe('Подтверждены документы.\n\nСнято после проверки.');
  });

  it('uses control_removals comments and skips empty rows', () => {
    expect(
      getRecommendationExecutionInfo({
        control_removals: [
          { date: '2026-01-10', comment: 'Первое снятие' },
          { date: null, comment: '  ' },
          { comment: 'Второе снятие' },
        ],
      }),
    ).toBe('Первое снятие\n\nВторое снятие');
  });

  it('returns empty string when there is no execution info', () => {
    expect(getRecommendationExecutionInfo({})).toBe('');
  });
});
