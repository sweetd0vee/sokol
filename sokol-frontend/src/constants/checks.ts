import type { CheckStatus, CheckType, CheckView } from '../types/check';

export const CHECK_TYPE_OPTIONS: { value: CheckType; label: string }[] = [
  { value: 'planned', label: 'Плановая' },
  { value: 'unscheduled', label: 'Внеплановая' },
  { value: 'thematic', label: 'Контрольная' },
];

export const CHECK_QUARTER_OPTIONS = [
  { value: '1', label: 'Q1' },
  { value: '2', label: 'Q2' },
  { value: '3', label: 'Q3' },
  { value: '4', label: 'Q4' },
];

export const CHECK_STATUS_OPTIONS: { value: CheckStatus; label: string }[] = [
  { value: 'not_started', label: 'Запланировано' },
  { value: 'in_progress', label: 'В процессе' },
  { value: 'completed', label: 'Завершено' },
];

export function getCheckTypeLabel(value: CheckType) {
  return CHECK_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getCheckStatusLabel(value: CheckStatus) {
  return CHECK_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getCheckStatusBadgeClass(status: CheckStatus | string) {
  if (status === 'completed') {
    return 'bg-green-100';
  }
  if (status === 'in_progress') {
    return 'bg-yellow-100';
  }
  return 'bg-gray-200';
}

/** Хранится `check_kinds.label` — отображаем как есть. */
export function getCheckViewLabel(value: CheckView) {
  return value;
}
