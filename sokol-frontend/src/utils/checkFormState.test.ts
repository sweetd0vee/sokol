import { describe, expect, it } from 'vitest';
import type { Check } from '../types/check';
import {
  applyStartDateChange,
  deriveCheckStatus,
  getMissingCheckKeyFieldLabels,
  isCheckKeySourceChanged,
  resolveInitialCheckFormFields,
} from './checkFormState';

const now = new Date(2026, 8, 4);

function check(overrides: Partial<Check> = {}): Check {
  return {
    id: '1',
    serial_number: 'П-1',
    check_name: 'Проверка',
    check_type: 'planned',
    check_view: 'ИТ',
    check_quarter: 1,
    start_date: '2026-09-10',
    check_leader: 'Иванов И.И.',
    status: 'not_started',
    created_at: '2026-09-01',
    ...overrides,
  };
}

describe('deriveCheckStatus', () => {
  it('keeps existing status when start date is empty', () => {
    expect(deriveCheckStatus(null, null, 'in_progress', now)).toBe('in_progress');
    expect(deriveCheckStatus(null, null, undefined, now)).toBe('');
  });

  it('marks completed when end date is before today', () => {
    expect(deriveCheckStatus(new Date(2026, 7, 1), new Date(2026, 8, 1), 'in_progress', now)).toBe(
      'completed',
    );
  });

  it('marks not_started when start is after today', () => {
    expect(deriveCheckStatus(new Date(2026, 8, 10), null, '', now)).toBe('not_started');
  });

  it('marks in_progress when start is today or earlier and not completed', () => {
    expect(deriveCheckStatus(new Date(2026, 8, 4), null, '', now)).toBe('in_progress');
    expect(deriveCheckStatus(new Date(2026, 8, 1), new Date(2026, 8, 10), '', now)).toBe(
      'in_progress',
    );
  });
});

describe('getMissingCheckKeyFieldLabels', () => {
  it('lists empty key sources in the original order', () => {
    expect(getMissingCheckKeyFieldLabels(null, '', '', '')).toEqual([
      'дату начала',
      'квартал проверки',
      'руководителя',
      'тип',
    ]);
    expect(getMissingCheckKeyFieldLabels(now, '1', 'Иванов', 'planned')).toEqual([]);
  });
});

describe('isCheckKeySourceChanged', () => {
  it('is false without an existing serial number', () => {
    expect(
      isCheckKeySourceChanged(check({ serial_number: '' }), {
        checkType: 'unscheduled',
        checkLeader: 'Петров',
        checkQuarter: '2',
        startDate: new Date(2026, 0, 1),
      }),
    ).toBe(false);
  });

  it('detects type, leader, quarter and start date changes', () => {
    const existing = check();
    expect(
      isCheckKeySourceChanged(existing, {
        checkType: 'planned',
        checkLeader: 'Иванов И.И.',
        checkQuarter: '1',
        startDate: new Date(2026, 8, 10),
      }),
    ).toBe(false);
    expect(
      isCheckKeySourceChanged(existing, {
        checkType: 'unscheduled',
        checkLeader: 'Иванов И.И.',
        checkQuarter: '1',
        startDate: new Date(2026, 8, 10),
      }),
    ).toBe(true);
  });
});

describe('resolveInitialCheckFormFields', () => {
  it('prefers restored draft strings and treats empty restored dates as null', () => {
    const fields = resolveInitialCheckFormFields(
      {
        checkName: 'Черновик',
        shortName: '',
        checkType: 'thematic',
        checkView: 'ИТ',
        checkLeader: 'Петров',
        checkQuarter: '2',
        startDate: null,
        endDate: null,
        orderDocumentNumber: '',
        orderDocumentDate: null,
        programDocumentNumber: '',
        programDocumentDate: null,
        azDocumentNumber: '',
        azDocumentDate: null,
        dzDocumentNumber: '',
        dzDocumentDate: null,
        processEffectiveness: '',
        svkEffectiveness: '',
        surEffectiveness: '',
        svikEffectiveness: '',
      },
      check(),
    );

    expect(fields.checkName).toBe('Черновик');
    expect(fields.checkType).toBe('thematic');
    expect(fields.startDate).toBeNull();
    expect(fields.endDate).toBeNull();
  });
});

describe('applyStartDateChange', () => {
  it('pulls end date forward when it would precede the new start', () => {
    const start = new Date(2026, 8, 10);
    const next = applyStartDateChange(
      {
        ...resolveInitialCheckFormFields(undefined, undefined),
        endDate: new Date(2026, 8, 1),
      },
      start,
    );
    expect(next.startDate).toBe(start);
    expect(next.endDate).toBe(start);
  });
});
