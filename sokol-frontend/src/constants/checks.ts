import type { CheckStatus, CheckType, CheckView } from '../types/check';

export const CHECK_TYPE_OPTIONS: { value: CheckType; label: string }[] = [
  { value: 'planned', label: 'Плановая' },
  { value: 'unscheduled', label: 'Внеплановая' },
  { value: 'thematic', label: 'Контрольная' },
];

export const CHECK_TYPE_PLURAL_LABELS: Record<CheckType, string> = {
  planned: 'Плановые',
  unscheduled: 'Внеплановые',
  thematic: 'Контрольные',
};

export const CHECK_STATUS_OPTIONS: { value: CheckStatus; label: string }[] = [
  { value: 'not_started', label: 'Запланировано' },
  { value: 'in_progress', label: 'В процессе' },
  { value: 'completed', label: 'Завершено' },
];

export const CHECK_VIEW_OPTIONS: { value: CheckView; label: string }[] = [
  { value: 'ИТ', label: 'ИТ' },
  { value: 'бизнес', label: 'бизнес' },
  { value: 'риски', label: 'риски' },
  { value: 'корпоуправление', label: 'корпоуправление' },
  { value: 'иные', label: 'иные' },
];

export function getCheckTypeLabel(value: CheckType) {
  return CHECK_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getCheckTypePluralLabel(value: CheckType) {
  return CHECK_TYPE_PLURAL_LABELS[value] ?? getCheckTypeLabel(value);
}

export function getCheckStatusLabel(value: CheckStatus) {
  return CHECK_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getCheckViewLabel(value: CheckView) {
  return CHECK_VIEW_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
