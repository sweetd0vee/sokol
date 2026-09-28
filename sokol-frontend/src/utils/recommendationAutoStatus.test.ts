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

  it('для снятия с контроля ставит красный треугольник и красный колокольчик', () => {
    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-12-01',
        executionDate: '2026-09-09',
        removedFromControl: true,
        today: TODAY,
      }),
    ).toMatchObject({
      status: 'unresolved',
      indicator: 'не решено',
      additionalStatus: 'deadline_violated',
      additionalIndicator: 'срок нарушен',
    });
  });

  it('для срока исполнения не позже срока контроля ставит исполнено и «в срок»', () => {
    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-09-10',
        executionDate: '2026-09-09',
        today: TODAY,
      }),
    ).toMatchObject({
      status: 'completed',
      indicator: 'исполнено',
      additionalStatus: 'on_time',
      additionalIndicator: 'в срок',
    });

    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-09-10',
        executionDate: '2026-09-10',
        today: TODAY,
      }),
    ).toMatchObject({
      additionalStatus: 'on_time',
      additionalIndicator: 'в срок',
    });
  });

  it('для срока исполнения позже срока контроля ставит исполнено и «срок нарушен»', () => {
    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-09-01',
        executionDate: '2026-09-15',
        currentStatus: 'on_control',
        today: TODAY,
      }),
    ).toMatchObject({
      status: 'completed',
      indicator: 'исполнено',
      additionalStatus: 'deadline_violated',
      additionalIndicator: 'срок нарушен',
    });
  });

  it('для «исполнено в ходе аудита» ставит синюю звезду и зелёный «в срок»', () => {
    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-08-01',
        executionDate: '2026-09-15',
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

  it('пересчитывает открытую пару, даже если статус был «исполнено»', () => {
    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-08-01',
        currentStatus: 'completed',
        currentAdditionalStatus: 'on_time',
        today: TODAY,
      }),
    ).toMatchObject({
      status: 'in_progress',
      indicator: 'в процессе',
      additionalStatus: 'in_progress',
      additionalIndicator: 'в процессе',
    });
  });

  it('возвращает открытую пару «на контроле», если срок контроля снова в будущем', () => {
    expect(
      computeRecommendationAutoStatus({
        controlDeadline: '2026-12-01',
        currentStatus: 'in_progress',
        currentAdditionalStatus: 'in_progress',
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
