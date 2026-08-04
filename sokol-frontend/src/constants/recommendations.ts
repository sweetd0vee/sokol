import type {
  MaterialityLevel,
  RecommendationAdditionalStatus,
  RecommendationIndicator,
  RecommendationStatus,
} from '../types/recommendation';

export type ColoredSelectOption = {
  value: string;
  label: string;
  dotClassName: string;
};

export const RECOMMENDATION_STATUS_OPTIONS: { value: RecommendationStatus; label: string }[] = [
  { value: 'completed', label: 'Исполнено' },
  { value: 'unresolved', label: 'Не решено' },
  { value: 'on_control', label: 'На контроле' },
  { value: 'in_progress', label: 'В процессе' },
];

export const RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS: {
  value: RecommendationAdditionalStatus;
  label: string;
}[] = [
  { value: 'on_time', label: 'В срок' },
  { value: 'deadline_violated', label: 'Срок нарушен' },
  { value: 'on_control', label: 'На контроле' },
];

export function getRecommendationStatusLabel(value: RecommendationStatus) {
  return RECOMMENDATION_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getRecommendationAdditionalStatusLabel(value: RecommendationAdditionalStatus) {
  return (
    RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

export function getRecommendationStatusBadgeClass(value: RecommendationStatus | '' | null | undefined) {
  switch (value) {
    case 'completed':
      return 'bg-green-100 text-gray-800';
    case 'unresolved':
      return 'bg-red-100 text-gray-800';
    case 'on_control':
      return 'bg-gray-200 text-gray-800';
    case 'in_progress':
      return 'bg-yellow-100 text-gray-800';
    default:
      return 'bg-white text-gray-900';
  }
}

export function getRecommendationAdditionalStatusBadgeClass(
  value: RecommendationAdditionalStatus | '' | null | undefined,
) {
  switch (value) {
    case 'on_time':
      return 'bg-green-100 text-gray-800';
    case 'deadline_violated':
      return 'bg-red-100 text-gray-800';
    case 'on_control':
      return 'bg-gray-200 text-gray-800';
    default:
      return 'bg-white text-gray-900';
  }
}

/** Same table badge colors for form selects (inline — native <select> ignores many Tailwind bg utilities). */
export function getRecommendationStatusFieldStyle(
  value: RecommendationStatus | '' | null | undefined,
): { backgroundColor: string } | undefined {
  switch (value) {
    case 'completed':
      return { backgroundColor: '#dcfce7' };
    case 'unresolved':
      return { backgroundColor: '#fee2e2' };
    case 'on_control':
      return { backgroundColor: '#e5e7eb' };
    case 'in_progress':
      return { backgroundColor: '#fef9c3' };
    default:
      return undefined;
  }
}

export function getRecommendationAdditionalStatusFieldStyle(
  value: RecommendationAdditionalStatus | '' | null | undefined,
): { backgroundColor: string } | undefined {
  switch (value) {
    case 'on_time':
      return { backgroundColor: '#dcfce7' };
    case 'deadline_violated':
      return { backgroundColor: '#fee2e2' };
    case 'on_control':
      return { backgroundColor: '#e5e7eb' };
    default:
      return undefined;
  }
}

export function normalizeRecommendationStatus(value: string | null | undefined): RecommendationStatus {
  switch (value) {
    case 'completed':
      return 'completed';
    case 'unresolved':
    case 'overdue':
      return 'unresolved';
    case 'on_control':
    case 'not_started':
      return 'on_control';
    case 'in_progress':
      return 'in_progress';
    default:
      return 'on_control';
  }
}

export function normalizeRecommendationAdditionalStatus(
  value: string | null | undefined,
): RecommendationAdditionalStatus {
  switch (value) {
    case 'on_time':
      return 'on_time';
    case 'deadline_violated':
      return 'deadline_violated';
    case 'on_control':
    case 'pending_review':
      return 'on_control';
    case 'removed_control':
    case 'none':
      return 'on_time';
    default:
      return 'on_control';
  }
}

export const INDICATOR_OPTIONS: {
  value: RecommendationIndicator;
  label: string;
  dotClassName: string;
}[] = [
  { value: 'не указан', label: 'Не указан', dotClassName: 'bg-transparent border border-gray-300' },
  { value: 'в процессе', label: 'В процессе', dotClassName: 'bg-[#FBEB8D]' },
  { value: 'ожидает', label: 'Ожидает', dotClassName: 'bg-gray-200' },
  { value: 'не решено', label: 'Не решено', dotClassName: 'bg-[#FF4347]' },
  { value: 'исполнено', label: 'Исполнено', dotClassName: 'bg-[#A9D18E]' },
];

export function getIndicatorLabel(value: RecommendationIndicator | '' | null | undefined) {
  return INDICATOR_OPTIONS.find((option) => option.value === value)?.label ?? 'Не указан';
}

export function normalizeRecommendationIndicator(
  value: string | null | undefined,
): RecommendationIndicator {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'в процессе':
    case 'в работе':
      return 'в процессе';
    case 'ожидает':
      return 'ожидает';
    case 'не решено':
    case 'риск / просрочка':
    case 'риск/просрочка':
    case 'красный':
      return 'не решено';
    case 'исполнено':
    case 'закрыто':
    case 'зелёный':
    case 'зеленый':
      return 'исполнено';
    case 'жёлтый':
    case 'желтый':
      return 'ожидает';
    case 'не указан':
    case '':
    default:
      return 'не указан';
  }
}

export const MATERIALITY_LEVEL_OPTIONS: {
  value: MaterialityLevel;
  label: string;
  dotClassName: string;
}[] = [
  { value: 'низкий', label: 'Низкий', dotClassName: 'bg-[#A9D18E]' },
  { value: 'средний', label: 'Средний', dotClassName: 'bg-[#FBEB8D]' },
  { value: 'высокий', label: 'Высокий', dotClassName: 'bg-[#FF4347]' },
];

export function getMaterialityLevelLabel(value: MaterialityLevel) {
  return MATERIALITY_LEVEL_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getMaterialityDotClassName(value: MaterialityLevel) {
  return (
    MATERIALITY_LEVEL_OPTIONS.find((option) => option.value === value)?.dotClassName ?? 'bg-gray-300'
  );
}

export function normalizeMaterialityLevel(value: string | null | undefined): MaterialityLevel {
  if (value === 'низкий' || value === 'средний' || value === 'высокий') {
    return value;
  }
  return 'средний';
}
