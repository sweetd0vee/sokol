import type { Recommendation } from '../types/recommendation';
import { getRecommendationAuditObjects } from './auditObjects';
import { computeRecommendationAutoStatus } from './recommendationAutoStatus';
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
  const auto = computeRecommendationAutoStatus({
    controlDeadline: draft.deadline,
    currentStatus: draft.status,
    currentAdditionalStatus: draft.additional_status,
  });
  const status = auto.status ?? draft.status;
  const additionalStatus = auto.additionalStatus ?? draft.additional_status;
  return {
    previewKey: `preview-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    id: '0',
    serial_number: checkKey,
    sequence_number: storedCount + index + 1,
    name: draft.name.trim(),
    observation_name: draft.observation_name?.trim() || undefined,
    description: draft.name.trim(),
    indicator: auto.indicator ?? indicatorFromRecommendationStatus(status),
    materiality_level: 'средний',
    audit_object: (draft.audit_object.trim() || 'Не указан').slice(0, 255),
    deadline: draft.deadline,
    auditor: (draft.auditor.trim() || 'Не указан').slice(0, 255),
    manager: (draft.manager.trim() || 'Не указан').slice(0, 255),
    status,
    additional_status: additionalStatus,
    additional_indicator:
      auto.additionalIndicator ?? indicatorFromRecommendationAdditionalStatus(additionalStatus),
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
    const deadline = normalizeDeadline(value) || value;
    const auto = computeRecommendationAutoStatus({
      controlDeadline: deadline,
      executionDeadline: item.execution_deadline,
      currentStatus: item.status,
      currentAdditionalStatus: item.additional_status,
    });
    return {
      ...item,
      deadline,
      status: auto.status ?? item.status,
      indicator: auto.indicator ?? item.indicator,
      additional_status: auto.additionalStatus ?? item.additional_status,
      additional_indicator: auto.additionalIndicator ?? item.additional_indicator,
    };
  }
  if (field === 'observation_name') {
    return { ...item, observation_name: value };
  }
  if (field === 'audit_object') {
    return { ...item, audit_object: value.slice(0, 255) };
  }
  return { ...item, manager: value.slice(0, 255) };
}
