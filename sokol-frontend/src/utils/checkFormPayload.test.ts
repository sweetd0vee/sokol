import { describe, expect, it } from 'vitest';
import type { Check } from '../types/check';
import { buildCheckPayload, getCheckRequiredFieldErrors } from './checkFormPayload';

describe('check form payload', () => {
  it('валидирует обязательные поля формы проверки', () => {
    expect(
      getCheckRequiredFieldErrors({
        checkName: '  ',
        checkType: '',
        checkView: '',
        checkLeader: '',
        checkQuarter: '',
        startDate: null,
      }),
    ).toEqual({
      checkName: true,
      checkType: true,
      checkView: true,
      checkLeader: true,
      checkQuarter: true,
      startDate: true,
      hasErrors: true,
    });

    expect(
      getCheckRequiredFieldErrors({
        checkName: 'Проверка',
        checkType: 'planned',
        checkView: 'ИТ',
        checkLeader: 'Иванов И.И.',
        checkQuarter: '1',
        startDate: new Date(2026, 0, 15),
      }).hasErrors,
    ).toBe(false);
  });

  it('собирает payload создания без клиентской генерации ключа проверки', () => {
    const payload = buildCheckPayload({
      checkName: '  Проверка ИТ  ',
      shortName: '  ИТ  ',
      checkType: 'planned',
      checkView: 'ИТ',
      checkLeader: 'Иванов И.И.',
      checkQuarter: '1',
      startDate: new Date(2026, 0, 15),
      endDate: null,
      status: 'not_started',
      orderDocumentNumber: '',
      orderDocumentDate: null,
      programDocumentNumber: 'П-1',
      programDocumentDate: new Date(2026, 0, 10),
      azDocumentNumber: '',
      azDocumentDate: null,
      dzDocumentNumber: '',
      dzDocumentDate: null,
      processEffectiveness: '',
      svkEffectiveness: 'Эффективно',
      surEffectiveness: '',
      svikEffectiveness: '',
      now: new Date('2026-08-12T12:00:00.000Z'),
    });

    expect(payload).toMatchObject({
      id: '0',
      serial_number: '',
      check_name: 'Проверка ИТ',
      short_name: 'ИТ',
      check_type: 'planned',
      check_view: 'ИТ',
      check_quarter: 1,
      start_date: '2026-01-15',
      end_date: undefined,
      check_leader: 'Иванов И.И.',
      status: 'not_started',
      created_at: '2026-08-12',
      order_document_number: undefined,
      program_document_number: 'П-1',
      program_document_date: '2026-01-10',
      svk_effectiveness: 'Эффективно',
    });
  });

  it('сохраняет серверные поля при редактировании проверки', () => {
    const existing: Check = {
      id: '42',
      serial_number: '26-7/ИТ',
      check_name: 'Old',
      check_type: 'planned',
      check_view: 'ИТ',
      check_quarter: 1,
      start_date: '2026-01-01',
      check_leader: 'Иванов И.И.',
      status: 'in_progress',
      created_at: '2026-01-02',
      description: 'server description',
    };

    const payload = buildCheckPayload({
      existing,
      checkName: 'Updated',
      shortName: '',
      checkType: 'thematic',
      checkView: 'Риски',
      checkLeader: 'Петров П.П.',
      checkQuarter: '2',
      startDate: new Date(2026, 4, 20),
      endDate: new Date(2026, 5, 20),
      status: '',
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
      now: new Date('2026-08-12T12:00:00.000Z'),
    });

    expect(payload.serial_number).toBe('26-7/ИТ');
    expect(payload.status).toBe('in_progress');
    expect(payload.created_at).toBe('2026-01-02');
    expect(payload.description).toBe('server description');
  });
});
