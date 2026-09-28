import type {
  RecommendationAdditionalIndicator,
  RecommendationAdditionalStatus,
  RecommendationIndicator,
  RecommendationStatus,
} from '../types/recommendation';
import { toIsoDate } from './dates';

const MOSCOW_TZ = 'Europe/Moscow';
const COMPLETED_DURING_AUDIT_INDICATOR = 'исполнено в ходе аудита';

export type RecommendationAutoStatusFields = {
  status: RecommendationStatus;
  indicator: RecommendationIndicator;
  additionalStatus: RecommendationAdditionalStatus;
  additionalIndicator: RecommendationAdditionalIndicator;
};

export type RecommendationAutoStatusInput = {
  controlDeadline?: Date | string | null;
  executionDate?: Date | string | null;
  removedFromControl?: boolean;
  currentIndicator?: string | null;
  completedDuringAudit?: boolean;
  today?: string;
  /** Ignored: kept so callers from older code still type-check. */
  currentStatus?: RecommendationStatus | '' | null;
  currentAdditionalStatus?: RecommendationAdditionalStatus | '' | null;
};

type OpenPhase = 'on_control' | 'in_progress';

const REMOVED_FROM_CONTROL = {
  status: 'unresolved',
  indicator: 'не решено',
  additionalStatus: 'deadline_violated',
  additionalIndicator: 'срок нарушен',
} as const satisfies RecommendationAutoStatusFields;

const COMPLETED_DURING_AUDIT = {
  status: 'completed',
  indicator: COMPLETED_DURING_AUDIT_INDICATOR,
  additionalStatus: 'on_time',
  additionalIndicator: 'в срок',
} as const satisfies RecommendationAutoStatusFields;

const EXECUTED_ON_TIME = {
  status: 'completed',
  indicator: 'исполнено',
  additionalStatus: 'on_time',
  additionalIndicator: 'в срок',
} as const satisfies RecommendationAutoStatusFields;

const EXECUTED_LATE = {
  status: 'completed',
  indicator: 'исполнено',
  additionalStatus: 'deadline_violated',
  additionalIndicator: 'срок нарушен',
} as const satisfies RecommendationAutoStatusFields;

const OPEN_ON_CONTROL = {
  status: 'on_control',
  indicator: 'на контроле',
  additionalStatus: 'on_control',
  additionalIndicator: 'на контроле',
} as const satisfies RecommendationAutoStatusFields;

const OPEN_IN_PROGRESS = {
  status: 'in_progress',
  indicator: 'в процессе',
  additionalStatus: 'in_progress',
  additionalIndicator: 'в процессе',
} as const satisfies RecommendationAutoStatusFields;

const OPEN_PHASE_PAIR: Record<OpenPhase, RecommendationAutoStatusFields> = {
  on_control: OPEN_ON_CONTROL,
  in_progress: OPEN_IN_PROGRESS,
};

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

function openPhase(anchor: string | null, today: string): OpenPhase | null {
  if (!anchor) {
    return null;
  }
  return today < anchor ? 'on_control' : 'in_progress';
}

function isCompletedDuringAudit(flag?: boolean, currentIndicator?: string | null): boolean {
  if (flag) {
    return true;
  }
  return (currentIndicator ?? '').trim().toLowerCase() === COMPLETED_DURING_AUDIT_INDICATOR;
}

/**
 * Приоритет: снятие с контроля → исполнено в ходе аудита → срок исполнения vs срок контроля
 * → открытая пара от срока контроля vs сегодня (Москва).
 */
export function computeRecommendationAutoStatus({
  controlDeadline,
  executionDate,
  removedFromControl,
  currentIndicator,
  completedDuringAudit,
  today = moscowTodayIso(),
}: RecommendationAutoStatusInput): Partial<RecommendationAutoStatusFields> {
  if (removedFromControl) {
    return REMOVED_FROM_CONTROL;
  }
  if (isCompletedDuringAudit(completedDuringAudit, currentIndicator)) {
    return COMPLETED_DURING_AUDIT;
  }

  const controlIso = toDateIso(controlDeadline);
  const executionIso = toDateIso(executionDate);
  if (executionIso && controlIso) {
    return executionIso > controlIso ? EXECUTED_LATE : EXECUTED_ON_TIME;
  }

  const phase = openPhase(controlIso, today);
  return phase ? OPEN_PHASE_PAIR[phase] : {};
}
