import { describe, expect, it } from 'vitest';
import { computeRecommendationAutoStatus } from './recommendationAutoStatus';

const TODAY = '2026-09-10';

describe('computeRecommendationAutoStatus', () => {
  it('ставит «на контроле» до срока контроля и просрочку начиная с этой даты', () => {
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
      status: 'unresolved',
      indicator: 'не решено',
      additionalStatus: 'deadline_violated',
      additionalIndicator: 'срок нарушен',
    });
  });

  it('считает оба индикатора только от срока контроля', () => {
    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-08-01',
        today: TODAY,
      }),
    ).toMatchObject({
      status: 'unresolved',
      indicator: 'не решено',
      additionalStatus: 'deadline_violated',
      additionalIndicator: 'срок нарушен',
    });
  });

  it('для «исполнено в ходе аудита» ставит синюю звезду и зелёный «в срок»', () => {
    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-08-01',
        currentStatus: 'on_control',
        currentAdditionalStatus: 'on_control',
        completedDuringAudit: true,
        today: TODAY,
      }),
    ).toMatchObject({
      status: 'completed',
      indicator: 'исполнено в ходе аудита',
      additionalStatus: 'on_time',
      additionalIndicator: 'в срок',
    });
  });

  it('не перезаписывает исполнено и в срок', () => {
    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-08-01',
        currentStatus: 'completed',
        currentAdditionalStatus: 'on_time',
        today: TODAY,
      }),
    ).toEqual({});
  });

  it('пересчитывает просроченную пару, если срок контроля снова в будущем', () => {
    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-12-01',
        currentStatus: 'unresolved',
        currentAdditionalStatus: 'deadline_violated',
        today: TODAY,
      }),
    ).toMatchObject({
      status: 'on_control',
      indicator: 'на контроле',
      additionalStatus: 'on_control',
      additionalIndicator: 'на контроле',
    });
  });
});
