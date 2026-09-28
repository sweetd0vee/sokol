import type {
  RecommendationAdditionalIndicator,
  RecommendationAdditionalStatus,
  RecommendationIndicator,
  RecommendationStatus,
} from '../types/recommendation';
import { toIsoDate } from './dates';

const MOSCOW_TZ = 'Europe/Moscow';

export type RecommendationAutoStatusFields = {
  status: RecommendationStatus;
  indicator: RecommendationIndicator;
  additionalStatus: RecommendationAdditionalStatus;
  additionalIndicator: RecommendationAdditionalIndicator;
};

const TERMINAL_STATUSES = new Set<RecommendationStatus>(['completed', 'unresolved']);
const MANUAL_ADDITIONAL_STATUSES = new Set<RecommendationAdditionalStatus>([
  'on_time',
  'deadline_violated',
]);

function moscowTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function toDateIso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return toIsoDate(value) ?? null;
  }
  const trimmed = value.trim().slice(0, 10);
  return trimmed || null;
}

function phase(anchor: string | null, today: string): 'on_control' | 'in_progress' | null {
  if (!anchor) {
    return null;
  }
  return today < anchor ? 'on_control' : 'in_progress';
}

export function computeRecommendationAutoStatus({
  controlDeadline,
  currentStatus,
  currentAdditionalStatus,
  today = moscowTodayIso(),
}: {
  controlDeadline?: Date | string | null;
  currentStatus?: RecommendationStatus | '' | null;
  currentAdditionalStatus?: RecommendationAdditionalStatus | '' | null;
  today?: string;
}): Partial<RecommendationAutoStatusFields> {
  const updates: Partial<RecommendationAutoStatusFields> = {};
  const controlIso = toDateIso(controlDeadline);
  const statusPhase = phase(controlIso, today);
  if (statusPhase && !TERMINAL_STATUSES.has(currentStatus as RecommendationStatus)) {
    updates.status = statusPhase;
    updates.indicator = statusPhase === 'on_control' ? 'на контроле' : 'в процессе';
  }
  if (
    statusPhase
    && !MANUAL_ADDITIONAL_STATUSES.has(currentAdditionalStatus as RecommendationAdditionalStatus)
  ) {
    updates.additionalStatus = statusPhase;
    updates.additionalIndicator = statusPhase === 'on_control' ? 'на контроле' : 'в процессе';
  }
  return updates;
}
