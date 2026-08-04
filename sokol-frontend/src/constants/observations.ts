import type { ObservationStatus } from '../types/observation';
import {
  MATERIALITY_LEVEL_OPTIONS,
  getMaterialityDotClassName,
  getMaterialityLevelLabel,
} from './recommendations';

export { MATERIALITY_LEVEL_OPTIONS, getMaterialityDotClassName, getMaterialityLevelLabel };

export const OBSERVATION_STATUS_OPTIONS: { value: ObservationStatus; label: string }[] = [
  { value: 'open', label: 'Открыто' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'closed', label: 'Закрыто' },
];

export function getObservationStatusLabel(value: ObservationStatus) {
  return OBSERVATION_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getObservationStatusBadgeClass(value: ObservationStatus | '' | null | undefined) {
  switch (value) {
    case 'closed':
      return 'bg-green-100 text-gray-800';
    case 'in_progress':
      return 'bg-yellow-100 text-gray-800';
    case 'open':
      return 'bg-gray-200 text-gray-800';
    default:
      return 'bg-white text-gray-900';
  }
}
