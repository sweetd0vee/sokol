import type { Check, CheckStatus, CheckType, CheckView } from '../types/check';
import type { Recommendation, RecommendationAdditionalStatus, RecommendationStatus } from '../types/recommendation';
import {
  normalizeMaterialityLevel,
  normalizeRecommendationAdditionalStatus,
  normalizeRecommendationIndicator,
  normalizeRecommendationStatus,
} from '../constants/recommendations';
import { getRecommendationAuditObjects } from '../utils/auditObjects';

export type ApiCheck = {
  id: number;
  serial_number: string;
  check_name: string;
  short_name?: string | null;
  check_type: string;
  check_view: string;
  start_date: string;
  end_date?: string | null;
  check_leader: string;
  status: CheckStatus;
  created_at: string;
  description?: string | null;
  order_document_number?: string | null;
  order_document_date?: string | null;
  program_document_number?: string | null;
  program_document_date?: string | null;
  az_document_number?: string | null;
  az_document_date?: string | null;
  dz_document_number?: string | null;
  dz_document_date?: string | null;
  process_effectiveness?: string | null;
  svk_effectiveness?: string | null;
  sur_effectiveness?: string | null;
  svik_effectiveness?: string | null;
};

type ApiCheckWrite = Omit<ApiCheck, 'id' | 'serial_number'>;

export type ApiRecommendation = {
  id: number;
  serial_number: string;
  sequence_number: number;
  name: string;
  observation_name?: string | null;
  description: string;
  indicator: string;
  materiality_level: string;
  audit_object: string[] | string;
  deadline?: string | null;
  auditor: string;
  manager: string;
  status: RecommendationStatus;
  additional_status: RecommendationAdditionalStatus;
  created_at: string;
  actual_completion_date?: string | null;
  extension_1_reason?: string | null;
  extension_1_date?: string | null;
  extension_1_comment?: string | null;
  extension_2_reason?: string | null;
  extension_2_comment?: string | null;
  remove_from_control_reason?: string | null;
  remove_from_control_date?: string | null;
  remove_from_control_comment?: string | null;
  deadline_extensions?: { date?: string | null; comment?: string | null }[] | null;
  control_removals?: { date?: string | null; comment?: string | null }[] | null;
  closure_verification_status?: string | null;
  closure_information?: string | null;
};

function optionalDate(value?: string | null) {
  return value ?? undefined;
}

export function mapCheckFromApi(api: ApiCheck): Check {
  return {
    id: String(api.id),
    serial_number: api.serial_number,
    check_name: api.check_name,
    short_name: api.short_name ?? undefined,
    check_type: api.check_type as CheckType,
    check_view: api.check_view as CheckView,
    start_date: api.start_date,
    end_date: optionalDate(api.end_date),
    check_leader: api.check_leader,
    status: api.status,
    created_at: api.created_at,
    description: api.description ?? undefined,
    order_document_number: optionalDate(api.order_document_number),
    order_document_date: optionalDate(api.order_document_date),
    program_document_number: optionalDate(api.program_document_number),
    program_document_date: optionalDate(api.program_document_date),
    az_document_number: optionalDate(api.az_document_number),
    az_document_date: optionalDate(api.az_document_date),
    dz_document_number: optionalDate(api.dz_document_number),
    dz_document_date: optionalDate(api.dz_document_date),
    process_effectiveness: api.process_effectiveness ?? undefined,
    svk_effectiveness: api.svk_effectiveness ?? undefined,
    sur_effectiveness: api.sur_effectiveness ?? undefined,
    svik_effectiveness: api.svik_effectiveness ?? undefined,
  };
}

export function mapCheckToCreate(check: Check): ApiCheckWrite {
  return {
    check_name: check.check_name,
    short_name: check.short_name ?? null,
    check_type: check.check_type,
    check_view: check.check_view,
    start_date: check.start_date,
    end_date: check.end_date ?? null,
    check_leader: check.check_leader,
    status: check.status,
    created_at: check.created_at,
    description: check.description ?? null,
    order_document_number: check.order_document_number ?? null,
    order_document_date: check.order_document_date ?? null,
    program_document_number: check.program_document_number ?? null,
    program_document_date: check.program_document_date ?? null,
    az_document_number: check.az_document_number ?? null,
    az_document_date: check.az_document_date ?? null,
    dz_document_number: check.dz_document_number ?? null,
    dz_document_date: check.dz_document_date ?? null,
    process_effectiveness: check.process_effectiveness ?? null,
    svk_effectiveness: check.svk_effectiveness ?? null,
    sur_effectiveness: check.sur_effectiveness ?? null,
    svik_effectiveness: check.svik_effectiveness ?? null,
  };
}

export function mapCheckToUpdate(check: Check): Partial<ApiCheckWrite> {
  return mapCheckToCreate(check);
}

export function mapRecommendationFromApi(api: ApiRecommendation): Recommendation {
  return {
    id: String(api.id),
    serial_number: api.serial_number,
    sequence_number: api.sequence_number ?? 1,
    name: api.name,
    observation_name: api.observation_name ?? undefined,
    description: api.description ?? api.name,
    indicator: normalizeRecommendationIndicator(api.indicator),
    materiality_level: normalizeMaterialityLevel(api.materiality_level),
    audit_object: getRecommendationAuditObjects(api.audit_object),
    deadline: api.deadline ?? '',
    auditor: api.auditor,
    manager: api.manager,
    status: normalizeRecommendationStatus(api.status),
    additional_status: normalizeRecommendationAdditionalStatus(api.additional_status),
    created_at: api.created_at,
    actual_completion_date: api.actual_completion_date ?? undefined,
    extension_1_reason: api.extension_1_reason ?? undefined,
    extension_1_date: api.extension_1_date ?? undefined,
    extension_1_comment: api.extension_1_comment ?? undefined,
    extension_2_reason: api.extension_2_reason ?? undefined,
    extension_2_comment: api.extension_2_comment ?? undefined,
    remove_from_control_reason: api.remove_from_control_reason ?? undefined,
    remove_from_control_date: api.remove_from_control_date ?? undefined,
    remove_from_control_comment: api.remove_from_control_comment ?? undefined,
    deadline_extensions: api.deadline_extensions ?? undefined,
    control_removals: api.control_removals ?? undefined,
    closure_verification_status: api.closure_verification_status ?? undefined,
    closure_information: api.closure_information ?? undefined,
  };
}

export function mapRecommendationToCreate(
  recommendation: Recommendation,
): Omit<ApiRecommendation, 'id' | 'sequence_number'> {
  return {
    serial_number: recommendation.serial_number,
    name: recommendation.name,
    observation_name: recommendation.observation_name || null,
    description: recommendation.description,
    indicator: recommendation.indicator,
    materiality_level: recommendation.materiality_level,
    audit_object: recommendation.audit_object,
    deadline: recommendation.deadline || null,
    auditor: recommendation.auditor,
    manager: recommendation.manager,
    status: recommendation.status,
    additional_status: recommendation.additional_status,
    created_at: recommendation.created_at ?? new Date().toISOString().slice(0, 10),
    actual_completion_date: recommendation.actual_completion_date || null,
    extension_1_reason: recommendation.extension_1_reason || null,
    extension_1_date: recommendation.extension_1_date || null,
    extension_1_comment: recommendation.extension_1_comment || null,
    extension_2_reason: recommendation.extension_2_reason || null,
    extension_2_comment: recommendation.extension_2_comment || null,
    remove_from_control_reason: recommendation.remove_from_control_reason || null,
    remove_from_control_date: recommendation.remove_from_control_date || null,
    remove_from_control_comment: recommendation.remove_from_control_comment || null,
    deadline_extensions: recommendation.deadline_extensions ?? [],
    control_removals: recommendation.control_removals ?? [],
    closure_verification_status: recommendation.closure_verification_status || null,
    closure_information: recommendation.closure_information || null,
  };
}

export function mapRecommendationToUpdate(
  recommendation: Recommendation,
): Partial<Omit<ApiRecommendation, 'id'>> {
  return mapRecommendationToCreate(recommendation);
}
