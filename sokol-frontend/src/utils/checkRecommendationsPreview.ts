import type { Recommendation } from '../types/recommendation';
import { getRecommendationAuditObjects } from './auditObjects';
import { indicatorFromRecommendationAdditionalStatus, indicatorFromRecommendationStatus } from '../constants/recommendations';

export type ParsedPreviewItem = Omit<Recommendation, 'audit_object'> & {
  audit_object: string;
  previewKey: string;
};

export type ParsedPreviewDraft = Pick<
  ParsedPreviewItem,
  | 'name'
  | 'observation_name'
  | 'audit_object'
  | 'deadline'
  | 'auditor'
  | 'manager'
  | 'status'
  | 'additional_status'
>;

export type RecentUploadSession = {
  ids: string[];
  count: number;
  fileName: string | null;
};

export type EditablePreviewField = 'name' | 'observation_name' | 'audit_object' | 'manager' | 'deadline';

export function toRecommendationPayload({ previewKey: _previewKey, audit_object, ...payload }: ParsedPreviewItem): Recommendation {
  return {
    ...payload,
    audit_object: getRecommendationAuditObjects(audit_object),
  };
}

export function buildParsedPreviewItem(
  draft: ParsedPreviewDraft,
  index: number,
  checkKey: string,
  storedCount: number,
): ParsedPreviewItem {
  return {
    previewKey: `preview-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    id: '0',
    serial_number: checkKey,
    sequence_number: storedCount + index + 1,
    name: draft.name.trim(),
    observation_name: draft.observation_name?.trim() || undefined,
    description: draft.name.trim(),
    indicator: indicatorFromRecommendationStatus(draft.status),
    materiality_level: 'средний',
    audit_object: (draft.audit_object.trim() || 'Не указан').slice(0, 255),
    deadline: draft.deadline,
    auditor: (draft.auditor.trim() || 'Не указан').slice(0, 255),
    manager: (draft.manager.trim() || 'Не указан').slice(0, 255),
    status: draft.status,
    additional_status: draft.additional_status,
    additional_indicator: indicatorFromRecommendationAdditionalStatus(draft.additional_status),
    created_at: new Date().toISOString().slice(0, 10),
  };
}

export function patchPreviewItem(
  item: ParsedPreviewItem,
  field: EditablePreviewField,
  value: string,
  normalizeDeadline: (value: string) => string,
): ParsedPreviewItem {
  if (field === 'name') {
    return { ...item, name: value, description: value.trim() };
  }
  if (field === 'deadline') {
    return { ...item, deadline: normalizeDeadline(value) || value };
  }
  if (field === 'observation_name') {
    return { ...item, observation_name: value };
  }
  if (field === 'audit_object') {
    return { ...item, audit_object: value.slice(0, 255) };
  }
  return { ...item, manager: value.slice(0, 255) };
}
