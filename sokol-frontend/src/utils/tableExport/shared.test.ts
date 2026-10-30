import { describe, expect, it } from 'vitest';
import type { Check } from '../../types/check';
import { CHECK_COLUMN_KEYS, formatCheckDate, toCheckRows } from './shared';

function check(overrides: Partial<Check> = {}): Check {
  return {
    id: '1',
    serial_number: '26IVA1P1',
    check_name: 'Проверка казначейства',
    short_name: 'Казначейство',
    check_type: 'planned',
    check_view: 'ИТ',
    check_quarter: 1,
    start_date: '2026-01-10',
    end_date: '2026-02-20',
    check_leader: 'Иванов И.И.',
    status: 'completed',
    created_at: '2026-01-01',
    order_document_number: 'ПР-1',
    order_document_date: '2026-01-05',
    program_document_number: 'ПГ-1',
    program_document_date: '2026-01-12',
    az_document_number: 'АЗ-1',
    az_document_date: '2026-02-01',
    dz_document_number: 'ДЗ-1',
    dz_document_date: '2026-02-15',
    process_effectiveness: 'эффективно',
    svk_effectiveness: 'частично',
    sur_effectiveness: 'неэффективно',
    svik_effectiveness: 'эффективно',
    ...overrides,
  };
}

describe('toCheckRows', () => {
  it('exports every card field, including documents and effectiveness ratings', () => {
    const [row] = toCheckRows([check()], new Map([['1', 7]]));
    expect(Object.keys(row ?? {})).toEqual([...CHECK_COLUMN_KEYS]);
    expect(row).toMatchObject({
      ID: '26-7',
      Ключ: '26IVA1P1',
      'Название проверки': 'Проверка казначейства',
      'Краткое название': 'Казначейство',
      'Тип проверки': 'Плановая',
      Вид: 'ИТ',
      'Квартал проверки': 1,
      'Дата начала': formatCheckDate('2026-01-10'),
      'Дата окончания': formatCheckDate('2026-02-20'),
      'Руководитель проверки': 'Иванов И.И.',
      Статус: 'Завершено',
      'Номер приказа': 'ПР-1',
      'Дата приказа': formatCheckDate('2026-01-05'),
      'Номер программы': 'ПГ-1',
      'Дата программы': formatCheckDate('2026-01-12'),
      'Номер АЗ': 'АЗ-1',
      'Дата АЗ': formatCheckDate('2026-02-01'),
      'Номер ДЗ': 'ДЗ-1',
      'Дата ДЗ': formatCheckDate('2026-02-15'),
      Процесс: 'эффективно',
      СВК: 'частично',
      СУР: 'неэффективно',
      СВИК: 'эффективно',
    });
  });
});
