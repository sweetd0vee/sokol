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

const TERMINAL_STATUSES = new Set<RecommendationStatus>(['completed']);
const MANUAL_ADDITIONAL_STATUSES = new Set<RecommendationAdditionalStatus>(['on_time']);

const PHASE_STATUS = {
  on_control: 'on_control',
  overdue: 'unresolved',
} as const satisfies Record<'on_control' | 'overdue', RecommendationStatus>;

const PHASE_ADDITIONAL_STATUS = {
  on_control: 'on_control',
  overdue: 'deadline_violated',
} as const satisfies Record<'on_control' | 'overdue', RecommendationAdditionalStatus>;

const PHASE_STATUS_INDICATOR = {
  on_control: 'на контроле',
  overdue: 'не решено',
} as const satisfies Record<'on_control' | 'overdue', RecommendationIndicator>;

const PHASE_ADDITIONAL_INDICATOR = {
  on_control: 'на контроле',
  overdue: 'срок нарушен',
} as const satisfies Record<'on_control' | 'overdue', RecommendationAdditionalIndicator>;

const COMPLETED_DURING_AUDIT_INDICATOR = 'исполнено в ходе аудита';
const ON_TIME_INDICATOR = 'в срок';

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

function phase(anchor: string | null, today: string): 'on_control' | 'overdue' | null {
  if (!anchor) {
    return null;
  }
  return today < anchor ? 'on_control' : 'overdue';
}

function isCompletedDuringAudit(
  completedDuringAudit?: boolean,
  currentIndicator?: string | null,
): boolean {
  if (completedDuringAudit) {
    return true;
  }
  return (currentIndicator ?? '').trim().toLowerCase() === COMPLETED_DURING_AUDIT_INDICATOR;
}

export function computeRecommendationAutoStatus({
  controlDeadline,
  currentStatus,
  currentAdditionalStatus,
  currentIndicator,
  completedDuringAudit,
  today = moscowTodayIso(),
}: {
  controlDeadline?: Date | string | null;
  currentStatus?: RecommendationStatus | '' | null;
  currentAdditionalStatus?: RecommendationAdditionalStatus | '' | null;
  currentIndicator?: string | null;
  completedDuringAudit?: boolean;
  today?: string;
}): Partial<RecommendationAutoStatusFields> {
  if (isCompletedDuringAudit(completedDuringAudit, currentIndicator)) {
    return {
      status: 'completed',
      indicator: COMPLETED_DURING_AUDIT_INDICATOR,
      additionalStatus: 'on_time',
      additionalIndicator: ON_TIME_INDICATOR,
    };
  }
  const updates: Partial<RecommendationAutoStatusFields> = {};
  const controlIso = toDateIso(controlDeadline);
  const statusPhase = phase(controlIso, today);
  if (statusPhase && !TERMINAL_STATUSES.has(currentStatus as RecommendationStatus)) {
    updates.status = PHASE_STATUS[statusPhase];
    updates.indicator = PHASE_STATUS_INDICATOR[statusPhase];
  }
  if (
    statusPhase
    && !MANUAL_ADDITIONAL_STATUSES.has(currentAdditionalStatus as RecommendationAdditionalStatus)
  ) {
    updates.additionalStatus = PHASE_ADDITIONAL_STATUS[statusPhase];
    updates.additionalIndicator = PHASE_ADDITIONAL_INDICATOR[statusPhase];
  }
  return updates;
}
