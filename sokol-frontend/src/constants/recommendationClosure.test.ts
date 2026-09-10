import { describe, expect, it } from 'vitest';
import { getControlZoneExecutionDate, getRecommendationExecutionInfo } from './recommendationClosure';

describe('getControlZoneExecutionDate', () => {
  it('takes actual completion date from the control zone first', () => {
    expect(
      getControlZoneExecutionDate({
        actual_completion_date: '2026-08-10',
        deadline_extensions: [{ date: '2026-12-01' }],
      }),
    ).toBe('2026-08-10');
  });

  it('falls back to the latest postponement when actual completion is empty', () => {
    expect(
      getControlZoneExecutionDate({
        deadline_extensions: [{ date: '2026-10-01' }, { date: '2026-12-15' }],
        extension_1_date: '2026-09-01',
      }),
    ).toBe('2026-12-15');
  });

  it('reads the same dates from the recommendation form closure', () => {
    expect(
      getControlZoneExecutionDate({
        actualCompletionDate: '',
        extensions: [{ date: '2026-11-02' }],
      }),
    ).toBe('2026-11-02');
  });

  it('returns undefined when the control zone has no execution date', () => {
    expect(getControlZoneExecutionDate({})).toBeUndefined();
  });
});

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
