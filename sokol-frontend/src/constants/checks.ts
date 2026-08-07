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

/** Совпадает со seed `check_kinds` / Settings «Виды проверок». */
export const CHECK_VIEW_OPTIONS: { value: CheckView; label: string }[] = [
  { value: 'Корпо', label: 'Корпо' },
  { value: 'Розница', label: 'Розница' },
  { value: 'Стратегия и финансы', label: 'Стратегия и финансы' },
  { value: 'Риски', label: 'Риски' },
  { value: 'ИТ', label: 'ИТ' },
  { value: 'Безопасность', label: 'Безопасность' },
  { value: 'Комплаенс', label: 'Комплаенс' },
  { value: 'Процессинг, трансформация', label: 'Процессинг, трансформация' },
  { value: 'Маркетинг', label: 'Маркетинг' },
  { value: 'Управление делами', label: 'Управление делами' },
  { value: 'АХД', label: 'АХД' },
  { value: 'Кадры', label: 'Кадры' },
  { value: 'Мотивация', label: 'Мотивация' },
  { value: 'Юристы', label: 'Юристы' },
  { value: 'Холдинг', label: 'Холдинг' },
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
