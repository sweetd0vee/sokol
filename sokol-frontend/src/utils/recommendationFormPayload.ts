import { closureToRecommendationFields, type RecommendationClosureForm } from '../constants/recommendationClosure';
import type { MaterialityLevel, Recommendation, RecommendationIndicator } from '../types/recommendation';
import { toIsoDate } from './dates';

export type RecommendationRequiredFieldErrors = {
  description: boolean;
  auditObject: boolean;
  deadline: boolean;
  auditor: boolean;
  manager: boolean;
  indicator: boolean;
  closureInformation: boolean;
  actualCompletionDate: boolean;
  extensions: boolean;
  removals: boolean;
  hasErrors: boolean;
};

export type RecommendationFormPayloadInput = {
  isEditMode: boolean;
  source?: Recommendation;
  serialNumber: string;
  sequenceNumber: number;
  description: string;
  observationName: string;
  auditObject: string;
  deadline: Date | null;
  auditor: string;
  checkLeader: string;
  navigationAuditor?: string;
  manager: string;
  status: string;
  additionalStatus: string;
  indicator: RecommendationIndicator;
  materialityLevel: MaterialityLevel;
  closure: RecommendationClosureForm;
  now?: Date;
};

type RecommendationRequiredFieldInput = Pick<
  RecommendationFormPayloadInput,
  'description' | 'auditObject' | 'deadline' | 'auditor' | 'checkLeader' | 'manager' | 'indicator' | 'closure'
> & {
  hasIncompleteClosureRows: (rows: RecommendationClosureForm['extensions']) => boolean;
};

export function buildRecommendationName(description: string, sequenceNumber: number) {
  const firstLine = description
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (firstLine) {
    return firstLine.slice(0, 500);
  }
  return `Рекомендация ${sequenceNumber}`;
}

export function getRecommendationRequiredFieldErrors({
  description,
  auditObject,
  deadline,
  auditor,
  checkLeader,
  manager,
  indicator,
  closure,
  hasIncompleteClosureRows,
}: RecommendationRequiredFieldInput): RecommendationRequiredFieldErrors {
  const errors = {
    description: !description.trim(),
    auditObject: !auditObject,
    deadline: !deadline,
    auditor: !(auditor || checkLeader),
    manager: !manager,
    indicator: !indicator || indicator === 'не указан',
    closureInformation: !closure.closureInformation.trim(),
    actualCompletionDate: !closure.actualCompletionDate,
    extensions: hasIncompleteClosureRows(closure.extensions),
    removals: hasIncompleteClosureRows(closure.removals),
  };
  return {
    ...errors,
    hasErrors: Object.values(errors).some(Boolean),
  };
}

export function buildRecommendationPayload({
  isEditMode,
  source,
  serialNumber,
  sequenceNumber,
  description,
  observationName,
  auditObject,
  deadline,
  auditor,
  checkLeader,
  navigationAuditor,
  manager,
  status,
  additionalStatus,
  indicator,
  materialityLevel,
  closure,
  now = new Date(),
}: RecommendationFormPayloadInput): Recommendation {
  const trimmedDescription = description.trim();
  const resolvedAuditor = auditor || checkLeader || navigationAuditor || '';
  const resolvedAuditObject = auditObject || 'Не указан';
  const resolvedSequenceNumber =
    isEditMode && source?.sequence_number ? source.sequence_number : sequenceNumber;

  return {
    id: isEditMode ? (source?.id ?? '0') : '0',
    serial_number: serialNumber,
    sequence_number: resolvedSequenceNumber,
    name: buildRecommendationName(trimmedDescription, resolvedSequenceNumber),
    observation_name: observationName.trim() || undefined,
    description: trimmedDescription,
    indicator,
    materiality_level: materialityLevel,
    audit_object: resolvedAuditObject,
    deadline: toIsoDate(deadline) ?? '',
    auditor: resolvedAuditor,
    manager,
    status: status as Recommendation['status'],
    additional_status: additionalStatus as Recommendation['additional_status'],
    created_at: isEditMode && source?.created_at ? source.created_at : now.toISOString().slice(0, 10),
    ...closureToRecommendationFields(closure),
  };
}
