import type {
  MaterialityLevel,
  Recommendation,
  RecommendationAdditionalIndicator,
  RecommendationIndicator,
} from '../types/recommendation';
import {
  normalizeRecommendationAdditionalStatus,
  normalizeRecommendationIndicator,
  normalizeRecommendationStatus,
  resolveRecommendationAdditionalIndicator,
} from '../constants/recommendations';
import {
  closureFromRecommendation,
  createEmptyRecommendationClosure,
  type RecommendationClosureForm,
} from '../constants/recommendationClosure';
import { formatRecommendationAuditObjects } from './auditObjects';
import { toInputDate } from './dates';

export type RecommendationFormFields = {
  serialNumber: string;
  observationName: string;
  description: string;
  auditObject: string;
  deadline: Date | null;
  executionDeadline: Date | null;
  auditor: string;
  checkLeader: string;
  manager: string;
  status: Recommendation['status'] | '';
  additionalStatus: Recommendation['additional_status'] | '';
  indicator: RecommendationIndicator;
  additionalIndicator: RecommendationAdditionalIndicator;
  materialityLevel: MaterialityLevel;
  closure: RecommendationClosureForm;
};

export type RecommendationFormPrefill = {
  serialNumber?: string;
  auditor?: string;
  checkLeader?: string;
};

export function emptyRecommendationFormFields(
  prefill: RecommendationFormPrefill = {},
): RecommendationFormFields {
  return {
    serialNumber: prefill.serialNumber ?? '',
    observationName: '',
    description: '',
    auditObject: '',
    deadline: null,
    executionDeadline: null,
    auditor: prefill.auditor ?? '',
    checkLeader: prefill.checkLeader ?? '',
    manager: '',
    status: '',
    additionalStatus: '',
    indicator: 'не указан',
    additionalIndicator: 'не указан',
    materialityLevel: 'средний',
    closure: createEmptyRecommendationClosure(),
  };
}

export function recommendationFormFieldsFromSource(
  source: Recommendation,
  checkLeader = '',
): RecommendationFormFields {
  return {
    serialNumber: source.serial_number,
    observationName: source.observation_name ?? '',
    description: source.description || source.name,
    auditObject: formatRecommendationAuditObjects(source.audit_object),
    deadline: toInputDate(source.deadline),
    executionDeadline: toInputDate(source.execution_deadline),
    auditor: source.auditor,
    checkLeader,
    manager: source.manager,
    status: normalizeRecommendationStatus(source.status),
    additionalStatus: normalizeRecommendationAdditionalStatus(source.additional_status),
    indicator: normalizeRecommendationIndicator(source.indicator),
    additionalIndicator: resolveRecommendationAdditionalIndicator(
      source.additional_status,
      source.additional_indicator,
    ),
    materialityLevel: source.materiality_level ?? 'средний',
    closure: closureFromRecommendation(source),
  };
}

export function recommendationFormPrefillFromNavigation(navigation: {
  serialNumber?: string;
  auditor?: string;
  checkLeader?: string;
  checkFormDraft?: { checkLeader?: string } | null;
}): RecommendationFormPrefill {
  return {
    serialNumber: navigation.serialNumber,
    auditor: navigation.auditor,
    checkLeader: navigation.checkLeader || navigation.checkFormDraft?.checkLeader || '',
  };
}
