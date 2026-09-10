import { describe, expect, it } from 'vitest';
import { computeRecommendationAutoStatus } from './recommendationAutoStatus';

const TODAY = '2026-09-10';

describe('computeRecommendationAutoStatus', () => {
  it('ставит «на контроле» до срока контроля и «в процессе» начиная с этой даты', () => {
    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-09-11',
        today: TODAY,
      }),
    ).toMatchObject({
      status: 'on_control',
      indicator: 'на контроле',
      additionalStatus: 'on_control',
      additionalIndicator: 'на контроле',
    });

    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-09-10',
        today: TODAY,
      }),
    ).toMatchObject({
      status: 'in_progress',
      indicator: 'в процессе',
      additionalStatus: 'in_progress',
      additionalIndicator: 'в процессе',
    });
  });

  it('считает дополнительный статус от даты из контрольной зоны, если она задана', () => {
    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-08-01',
        executionDeadline: '2026-12-01',
        today: TODAY,
      }),
    ).toMatchObject({
      status: 'in_progress',
      additionalStatus: 'on_control',
    });
  });

  it('не перезаписывает исполнено / не решено и в срок / срок нарушен', () => {
    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-08-01',
        currentStatus: 'completed',
        currentAdditionalStatus: 'on_time',
        today: TODAY,
      }),
    ).toEqual({});
  });
});
