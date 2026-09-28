import { describe, expect, it } from 'vitest';
import { createClosureDateCommentRow } from '../constants/recommendationClosure';
import { toIsoDate } from './dates';
import { applyRecommendationFormAutoStatus } from './recommendationFormAutoStatus';
import { emptyRecommendationFormFields } from './recommendationFormState';

describe('applyRecommendationFormAutoStatus', () => {
  it('переносит срок контроля на дату переноса и ставит «на контроле», если срок ещё впереди', () => {
    const fields = emptyRecommendationFormFields();
    fields.deadline = new Date(2026, 7, 1);
    fields.closure.extensions = [createClosureDateCommentRow({ date: '2099-01-01', comment: 'Перенос' })];

    const next = applyRecommendationFormAutoStatus(fields);
    expect(next.deadline && next.deadline.getFullYear()).toBe(2099);
    expect(next).toMatchObject({
      status: 'on_control',
      indicator: 'на контроле',
      additionalStatus: 'on_control',
      additionalIndicator: 'на контроле',
    });
  });

  it('при нескольких переносах ставит в срок контроля самую позднюю дату', () => {
    const fields = emptyRecommendationFormFields();
    fields.deadline = new Date(2026, 7, 1);
    fields.closure.extensions = [
      createClosureDateCommentRow({ date: '2026-12-01', comment: 'Первый' }),
      createClosureDateCommentRow({ date: '2099-03-15', comment: 'Самый поздний' }),
      createClosureDateCommentRow({ date: '2026-10-01', comment: 'Добавлен последним' }),
    ];

    const next = applyRecommendationFormAutoStatus(fields);
    expect(next.deadline && toIsoDate(next.deadline)).toBe('2099-03-15');
    expect(next).toMatchObject({
      status: 'on_control',
      indicator: 'на контроле',
      additionalStatus: 'on_control',
      additionalIndicator: 'на контроле',
    });
  });

  it('при снятии с контроля ставит красную пару даже если есть срок исполнения', () => {
    const fields = emptyRecommendationFormFields();
    fields.deadline = new Date(2026, 8, 10);
    fields.closure.actualCompletionDate = '2026-09-09';
    fields.closure.removals = [createClosureDateCommentRow({ date: '2026-09-15', comment: 'Снято' })];

    expect(applyRecommendationFormAutoStatus(fields)).toMatchObject({
      status: 'unresolved',
      indicator: 'не решено',
      additionalStatus: 'deadline_violated',
      additionalIndicator: 'срок нарушен',
    });
  });
});
