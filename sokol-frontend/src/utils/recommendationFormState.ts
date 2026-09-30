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
  getLatestDeadlineExtensionDate,
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

const UNSPECIFIED_AUDITOR_RE = /^не\s+указан$/i;

export function resolveRecommendationAuditor(
  auditor: string | null | undefined,
  checkLeader: string | null | undefined,
): string {
  const trimmedAuditor = (auditor ?? '').trim();
  if (trimmedAuditor && !UNSPECIFIED_AUDITOR_RE.test(trimmedAuditor)) {
    return trimmedAuditor;
  }
  return (checkLeader ?? '').trim();
}

export function applyLinkedCheckLeader(
  fields: RecommendationFormFields,
  checkLeader: string,
): RecommendationFormFields {
  const leader = checkLeader.trim();
  if (!leader) {
    return fields;
  }
  const auditor = resolveRecommendationAuditor(fields.auditor, leader);
  if (fields.checkLeader === leader && fields.auditor === auditor) {
    return fields;
  }
  return { ...fields, checkLeader: leader, auditor };
}

export function emptyRecommendationFormFields(
  prefill: RecommendationFormPrefill = {},
): RecommendationFormFields {
  return {
    serialNumber: prefill.serialNumber ?? '',
    observationName: '',
    description: '',
    auditObject: '',
    deadline: null,
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
    deadline: toInputDate(getLatestDeadlineExtensionDate(source) ?? source.deadline),
    auditor: resolveRecommendationAuditor(source.auditor, checkLeader),
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
  const checkLeader = navigation.checkLeader || navigation.checkFormDraft?.checkLeader || '';
  return {
    serialNumber: navigation.serialNumber,
    auditor: resolveRecommendationAuditor(navigation.auditor, checkLeader),
    checkLeader,
  };
}
