import { describe, expect, it } from 'vitest';
import type { Check } from '../types/check';
import { buildCheckYearlyNumbers } from './checkYearlyNumber';

function makeCheck(id: string, startDate: string): Check {
  return {
    id,
    serial_number: `key-${id}`,
    check_name: `Check ${id}`,
    check_type: 'planned',
    check_view: 'ИТ',
    start_date: startDate,
    check_leader: 'Leader',
    status: 'completed',
    created_at: startDate,
  };
}

describe('buildCheckYearlyNumbers', () => {
  it('нумерует проверки внутри года по дате начала', () => {
    const checks = [
      makeCheck('3', '2026-03-01'),
      makeCheck('1', '2026-01-02'),
      makeCheck('2', '2026-02-01'),
    ];

    const numbers = buildCheckYearlyNumbers(checks);

    expect(numbers.get('1')).toBe(1);
    expect(numbers.get('2')).toBe(2);
    expect(numbers.get('3')).toBe(3);
  });

  it('сбрасывает нумерацию с 1 при смене года', () => {
    const checks = [
      makeCheck('24', '2025-12-31'),
      makeCheck('25', '2025-11-01'),
      makeCheck('26', '2026-01-02'),
      makeCheck('27', '2026-08-01'),
    ];

    const numbers = buildCheckYearlyNumbers(checks);

    expect(numbers.get('25')).toBe(1);
    expect(numbers.get('24')).toBe(2);
    expect(numbers.get('26')).toBe(1);
    expect(numbers.get('27')).toBe(2);
  });
});
