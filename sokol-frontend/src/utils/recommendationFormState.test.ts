import { describe, expect, it } from 'vitest';
import type { Recommendation } from '../types/recommendation';
import {
  applyLinkedCheckLeader,
  emptyRecommendationFormFields,
  recommendationFormFieldsFromSource,
  recommendationFormPrefillFromNavigation,
} from './recommendationFormState';

function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: '1',
    serial_number: 'П-1',
    sequence_number: 1,
    name: 'Исправить контроль',
    description: 'Подробный текст',
    indicator: 'в работе',
    additional_indicator: 'в срок',
    materiality_level: 'высокий',
    audit_object: ['ИТ'],
    deadline: '2026-09-10',
    auditor: 'Петров П.П.',
    manager: 'Сидоров С.С.',
    status: 'in_progress',
    additional_status: 'on_time',
    created_at: '2026-09-01',
    ...overrides,
  };
}

describe('recommendationFormState', () => {
  it('fills empty fields from navigation prefill', () => {
    const fields = emptyRecommendationFormFields({
      serialNumber: 'П-2',
      auditor: 'Иванов',
      checkLeader: 'Лидер',
    });
    expect(fields.serialNumber).toBe('П-2');
    expect(fields.auditor).toBe('Иванов');
    expect(fields.checkLeader).toBe('Лидер');
    expect(fields.description).toBe('');
    expect(fields.closure.closureInformation).toBe('');
    expect(fields.closure.actualCompletionDate).toBe('');
    expect(fields.closure.extensions).toHaveLength(1);
    expect(fields.closure.removals).toHaveLength(1);
  });

  it('hydrates fields from a saved recommendation', () => {
    const fields = recommendationFormFieldsFromSource(recommendation(), 'Лидер');
    expect(fields.serialNumber).toBe('П-1');
    expect(fields.description).toBe('Подробный текст');
    expect(fields.auditObject).toBe('ИТ');
    expect(fields.checkLeader).toBe('Лидер');
    expect(fields.status).toBe('in_progress');
    expect(fields.materialityLevel).toBe('высокий');
  });

  it('falls back to name when description is empty', () => {
    const fields = recommendationFormFieldsFromSource(
      recommendation({ description: '', name: 'Исправить контроль' }),
    );
    expect(fields.description).toBe('Исправить контроль');
  });

  it('reads check leader from the check form draft', () => {
    expect(
      recommendationFormPrefillFromNavigation({
        serialNumber: 'П-3',
        checkFormDraft: { checkLeader: 'Черновик' },
      }),
    ).toEqual({
      serialNumber: 'П-3',
      auditor: 'Черновик',
      checkLeader: 'Черновик',
    });
  });

  it('оставляет выбранного аудитора, если он уже заполнен', () => {
    expect(
      recommendationFormPrefillFromNavigation({
        serialNumber: 'П-3',
        auditor: 'Иванов И.И.',
        checkLeader: 'Важник Д.С.',
      }),
    ).toEqual({
      serialNumber: 'П-3',
      auditor: 'Иванов И.И.',
      checkLeader: 'Важник Д.С.',
    });
  });

  it('подставляет руководителя проверки, если аудитор в рекомендации пустой', () => {
    const fields = recommendationFormFieldsFromSource(
      recommendation({ auditor: '' }),
      'Важник Д.С.',
    );
    expect(fields.auditor).toBe('Важник Д.С.');
    expect(fields.checkLeader).toBe('Важник Д.С.');
  });

  it('подставляет руководителя проверки вместо «Не указан»', () => {
    const empty = emptyRecommendationFormFields({ checkLeader: 'Важник Д.С.', auditor: 'Не указан' });
    expect(applyLinkedCheckLeader(empty, 'Важник Д.С.').auditor).toBe('Важник Д.С.');
  });
});
