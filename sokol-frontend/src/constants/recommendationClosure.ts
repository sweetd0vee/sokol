export const RECOMMENDATION_ATTACHMENT_SLOTS = [
  { id: 'recommendation_files', label: 'Вложения' },
] as const;

export const REMOVE_FROM_CONTROL_REASON_OPTIONS = [
  { value: '', label: 'Выберите причину' },
  { value: 'lost_relevance', label: 'Утратило актуальность' },
  { value: 'audit_object_refusal', label: 'Отказ объекта аудита' },
  { value: 'other', label: 'Иное' },
];

export type RecommendationClosureForm = {
  closureInformation: string;
  actualCompletionDate: string;
  extension1Reason: string;
  extension1Date: string;
  extension1Comment: string;
  extension2Reason: string;
  extension2Comment: string;
  removeFromControlReason: string;
  removeFromControlDate: string;
  removeFromControlComment: string;
};

export const EMPTY_RECOMMENDATION_CLOSURE: RecommendationClosureForm = {
  closureInformation: '',
  actualCompletionDate: '',
  extension1Reason: '',
  extension1Date: '',
  extension1Comment: '',
  extension2Reason: '',
  extension2Comment: '',
  removeFromControlReason: '',
  removeFromControlDate: '',
  removeFromControlComment: '',
};

export function closureFromRecommendation(
  source?: Partial<{
    closure_information?: string;
    actual_completion_date?: string;
    extension_1_reason?: string;
    extension_1_date?: string;
    extension_1_comment?: string;
    extension_2_reason?: string;
    extension_2_comment?: string;
    remove_from_control_reason?: string;
    remove_from_control_date?: string;
    remove_from_control_comment?: string;
  }>,
): RecommendationClosureForm {
  return {
    closureInformation: source?.closure_information ?? '',
    actualCompletionDate: source?.actual_completion_date ?? '',
    extension1Reason: source?.extension_1_reason ?? '',
    extension1Date: source?.extension_1_date ?? '',
    extension1Comment: source?.extension_1_comment ?? '',
    extension2Reason: source?.extension_2_reason ?? '',
    extension2Comment: source?.extension_2_comment ?? '',
    removeFromControlReason: source?.remove_from_control_reason ?? '',
    removeFromControlDate: source?.remove_from_control_date ?? '',
    removeFromControlComment: source?.remove_from_control_comment ?? '',
  };
}

export function closureToRecommendationFields(form: RecommendationClosureForm) {
  return {
    closure_information: form.closureInformation || undefined,
    actual_completion_date: form.actualCompletionDate || undefined,
    extension_1_reason: form.extension1Reason || undefined,
    extension_1_date: form.extension1Date || undefined,
    extension_1_comment: form.extension1Comment || undefined,
    extension_2_reason: form.extension2Reason || undefined,
    extension_2_comment: form.extension2Comment || undefined,
    remove_from_control_reason: form.removeFromControlReason || undefined,
    remove_from_control_date: form.removeFromControlDate || undefined,
    remove_from_control_comment: form.removeFromControlComment || undefined,
  };
}
