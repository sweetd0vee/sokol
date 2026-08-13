import { describe, expect, it } from 'vitest';
import { createClosureDateCommentRow, type RecommendationClosureForm } from '../constants/recommendationClosure';
import type { Recommendation } from '../types/recommendation';
import {
  buildRecommendationName,
  buildRecommendationPayload,
  getRecommendationRequiredFieldErrors,
} from './recommendationFormPayload';

function filledClosure(): RecommendationClosureForm {
  return {
    closureInformation: 'Проверено',
    actualCompletionDate: '2026-08-10',
    extensions: [createClosureDateCommentRow()],
    removals: [createClosureDateCommentRow()],
  };
}

describe('recommendation form payload', () => {
  it('строит название рекомендации из первой непустой строки', () => {
    expect(buildRecommendationName('\n  Исправить контроль\nДетали', 3)).toBe('Исправить контроль');
    expect(buildRecommendationName('   ', 4)).toBe('Рекомендация 4');
    expect(buildRecommendationName('а'.repeat(520), 1)).toHaveLength(500);
  });

  it('валидирует обязательные поля формы рекомендации', () => {
    const closure: RecommendationClosureForm = {
      closureInformation: '',
      actualCompletionDate: '',
      extensions: [createClosureDateCommentRow({ date: '2026-08-01' })],
      removals: [createClosureDateCommentRow()],
    };

    const errors = getRecommendationRequiredFieldErrors({
      description: '',
      auditObject: '',
      deadline: null,
      auditor: '',
      checkLeader: '',
      manager: '',
      indicator: 'не указан',
      closure,
      hasIncompleteClosureRows: (rows) =>
        rows.some((row) => Boolean(row.date.trim()) !== Boolean(row.comment.trim())),
    });

    expect(errors).toMatchObject({
      description: true,
      auditObject: true,
      deadline: true,
      auditor: true,
      manager: true,
      indicator: true,
      closureInformation: true,
      actualCompletionDate: true,
      extensions: true,
      removals: false,
      hasErrors: true,
    });
  });

  it('собирает payload создания и подставляет аудитора из руководителя проверки', () => {
    const payload = buildRecommendationPayload({
      isEditMode: false,
      serialNumber: '26-7/ИТ',
      sequenceNumber: 2,
      description: '  Закрыть замечание\nПодробности  ',
      observationName: '  Наблюдение 1  ',
      auditObject: '',
      deadline: new Date(2026, 8, 30),
      auditor: '',
      checkLeader: 'Иванов И.И.',
      manager: 'Петров П.П.',
      status: 'in_progress',
      additionalStatus: 'on_control',
      indicator: 'в процессе',
      materialityLevel: 'высокий',
      closure: filledClosure(),
      now: new Date('2026-08-12T12:00:00.000Z'),
    });

    expect(payload).toMatchObject({
      id: '0',
      serial_number: '26-7/ИТ',
      sequence_number: 2,
      name: 'Закрыть замечание',
      observation_name: 'Наблюдение 1',
      description: 'Закрыть замечание\nПодробности',
      audit_object: ['Не указан'],
      deadline: '2026-09-30',
      auditor: 'Иванов И.И.',
      manager: 'Петров П.П.',
      status: 'in_progress',
      additional_status: 'on_control',
      indicator: 'в процессе',
      materiality_level: 'высокий',
      created_at: '2026-08-12',
      closure_information: 'Проверено',
      actual_completion_date: '2026-08-10',
    });
  });

  it('сохраняет id, sequence и дату создания при редактировании рекомендации', () => {
    const source: Recommendation = {
      id: '9',
      serial_number: '26-7/ИТ',
      sequence_number: 5,
      name: 'Old',
      description: 'Old',
      indicator: 'ожидает',
      materiality_level: 'средний',
      audit_object: ['ИТ'],
      deadline: '2026-09-01',
      auditor: 'Иванов И.И.',
      manager: 'Петров П.П.',
      status: 'unresolved',
      additional_status: 'on_time',
      created_at: '2026-01-10',
    };

    const payload = buildRecommendationPayload({
      isEditMode: true,
      source,
      serialNumber: '26-8/ИТ',
      sequenceNumber: 99,
      description: 'Новое описание',
      observationName: '',
      auditObject: 'Риски',
      deadline: new Date(2026, 9, 1),
      auditor: 'Сидоров С.С.',
      checkLeader: '',
      manager: 'Петров П.П.',
      status: 'completed',
      additionalStatus: 'on_time',
      indicator: 'исполнено',
      materialityLevel: 'низкий',
      closure: filledClosure(),
      now: new Date('2026-08-12T12:00:00.000Z'),
    });

    expect(payload.id).toBe('9');
    expect(payload.sequence_number).toBe(5);
    expect(payload.created_at).toBe('2026-01-10');
    expect(payload.serial_number).toBe('26-8/ИТ');
  });
});
