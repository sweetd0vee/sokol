import { describe, expect, it } from 'vitest';
import { buildCheckKeySeeds, generateCheckSerialNumber } from './checkKey';

const LEADER = 'Голубицкая А.О.';

describe('generateCheckSerialNumber', () => {
  it('инкрементирует порядковый номер для одного руководителя и типа в пределах года', () => {
    const existing = buildCheckKeySeeds([
      {
        check_leader: LEADER,
        start_date: '2026-01-02',
        check_type: 'planned',
      },
    ]);

    const serial = generateCheckSerialNumber({
      startDate: new Date('2026-07-26'),
      checkLeader: LEADER,
      checkType: 'planned',
      existing,
    });

    expect(serial).toBe('26GAO07P2');
  });

  it('сбрасывает порядковый номер при смене года', () => {
    const existing = buildCheckKeySeeds([
      {
        check_leader: LEADER,
        start_date: '2025-12-15',
        check_type: 'planned',
      },
    ]);

    const serial = generateCheckSerialNumber({
      startDate: new Date('2026-01-02'),
      checkLeader: LEADER,
      checkType: 'planned',
      existing,
    });

    expect(serial).toBe('26GAO01P1');
  });

  it('не учитывает проверки другого типа или другого руководителя', () => {
    const existing = buildCheckKeySeeds([
      {
        check_leader: LEADER,
        start_date: '2026-03-01',
        check_type: 'unscheduled',
      },
      {
        check_leader: 'Вяжник Д.С.',
        start_date: '2026-04-01',
        check_type: 'planned',
      },
    ]);

    const serial = generateCheckSerialNumber({
      startDate: new Date('2026-06-01'),
      checkLeader: LEADER,
      checkType: 'planned',
      existing,
    });

    expect(serial).toBe('26GAO06P1');
  });
});
