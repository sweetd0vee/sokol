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

const PHASE_STATUS = {
  on_control: 'on_control',
  in_progress: 'in_progress',
} as const satisfies Record<'on_control' | 'in_progress', RecommendationStatus>;

const PHASE_ADDITIONAL_STATUS = {
  on_control: 'on_control',
  in_progress: 'in_progress',
} as const satisfies Record<'on_control' | 'in_progress', RecommendationAdditionalStatus>;

const PHASE_STATUS_INDICATOR = {
  on_control: 'на контроле',
  in_progress: 'в процессе',
} as const satisfies Record<'on_control' | 'in_progress', RecommendationIndicator>;

const PHASE_ADDITIONAL_INDICATOR = {
  on_control: 'на контроле',
  in_progress: 'в процессе',
} as const satisfies Record<'on_control' | 'in_progress', RecommendationAdditionalIndicator>;

const COMPLETED_DURING_AUDIT_INDICATOR = 'исполнено в ходе аудита';
const COMPLETED_INDICATOR = 'исполнено';
const UNRESOLVED_INDICATOR = 'не решено';
const ON_TIME_INDICATOR = 'в срок';
const DEADLINE_VIOLATED_INDICATOR = 'срок нарушен';

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
  executionDate,
  removedFromControl,
  currentIndicator,
  completedDuringAudit,
  today = moscowTodayIso(),
}: {
  controlDeadline?: Date | string | null;
  executionDate?: Date | string | null;
  removedFromControl?: boolean;
  currentStatus?: RecommendationStatus | '' | null;
  currentAdditionalStatus?: RecommendationAdditionalStatus | '' | null;
  currentIndicator?: string | null;
  completedDuringAudit?: boolean;
  today?: string;
}): Partial<RecommendationAutoStatusFields> {
  if (removedFromControl) {
    return {
      status: 'unresolved',
      indicator: UNRESOLVED_INDICATOR,
      additionalStatus: 'deadline_violated',
      additionalIndicator: DEADLINE_VIOLATED_INDICATOR,
    };
  }
  if (isCompletedDuringAudit(completedDuringAudit, currentIndicator)) {
    return {
      status: 'completed',
      indicator: COMPLETED_DURING_AUDIT_INDICATOR,
      additionalStatus: 'on_time',
      additionalIndicator: ON_TIME_INDICATOR,
    };
  }

  const controlIso = toDateIso(controlDeadline);
  const executionIso = toDateIso(executionDate);
  if (executionIso && controlIso) {
    const late = executionIso > controlIso;
    return {
      status: 'completed',
      indicator: COMPLETED_INDICATOR,
      additionalStatus: late ? 'deadline_violated' : 'on_time',
      additionalIndicator: late ? DEADLINE_VIOLATED_INDICATOR : ON_TIME_INDICATOR,
    };
  }

  const updates: Partial<RecommendationAutoStatusFields> = {};
  const statusPhase = phase(controlIso, today);
  if (statusPhase) {
    updates.status = PHASE_STATUS[statusPhase];
    updates.indicator = PHASE_STATUS_INDICATOR[statusPhase];
    updates.additionalStatus = PHASE_ADDITIONAL_STATUS[statusPhase];
    updates.additionalIndicator = PHASE_ADDITIONAL_INDICATOR[statusPhase];
  }
  return updates;
}
