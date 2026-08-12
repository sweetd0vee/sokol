import type { Check, CheckStatus, CheckType } from '../types/check';
import { toIsoDate } from './dates';

export type CheckRequiredFieldErrors = {
  checkName: boolean;
  checkType: boolean;
  checkView: boolean;
  checkLeader: boolean;
  startDate: boolean;
  hasErrors: boolean;
};

export type CheckFormPayloadInput = {
  existing?: Check;
  checkName: string;
  shortName: string;
  checkType: string;
  checkView: string;
  checkLeader: string;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  orderDocumentNumber: string;
  orderDocumentDate: Date | null;
  programDocumentNumber: string;
  programDocumentDate: Date | null;
  azDocumentNumber: string;
  azDocumentDate: Date | null;
  dzDocumentNumber: string;
  dzDocumentDate: Date | null;
  processEffectiveness: string;
  svkEffectiveness: string;
  surEffectiveness: string;
  svikEffectiveness: string;
  now?: Date;
};

export function getCheckRequiredFieldErrors({
  checkName,
  checkType,
  checkView,
  checkLeader,
  startDate,
}: Pick<CheckFormPayloadInput, 'checkName' | 'checkType' | 'checkView' | 'checkLeader' | 'startDate'>): CheckRequiredFieldErrors {
  const errors = {
    checkName: !checkName.trim(),
    checkType: !checkType,
    checkView: !checkView,
    checkLeader: !checkLeader,
    startDate: !startDate,
  };
  return {
    ...errors,
    hasErrors: Object.values(errors).some(Boolean),
  };
}

export function buildCheckPayload({
  existing,
  checkName,
  shortName,
  checkType,
  checkView,
  checkLeader,
  startDate,
  endDate,
  status,
  orderDocumentNumber,
  orderDocumentDate,
  programDocumentNumber,
  programDocumentDate,
  azDocumentNumber,
  azDocumentDate,
  dzDocumentNumber,
  dzDocumentDate,
  processEffectiveness,
  svkEffectiveness,
  surEffectiveness,
  svikEffectiveness,
  now = new Date(),
}: CheckFormPayloadInput): Check {
  return {
    id: existing?.id ?? '0',
    serial_number: existing?.serial_number ?? '',
    check_name: checkName.trim(),
    short_name: shortName.trim() || undefined,
    check_type: checkType as CheckType,
    check_view: checkView as Check['check_view'],
    start_date: toIsoDate(startDate) ?? '',
    end_date: toIsoDate(endDate),
    check_leader: checkLeader,
    status: (status || existing?.status || 'not_started') as CheckStatus,
    created_at: existing?.created_at ?? now.toISOString().slice(0, 10),
    description: existing?.description,
    order_document_number: orderDocumentNumber || undefined,
    order_document_date: toIsoDate(orderDocumentDate),
    program_document_number: programDocumentNumber || undefined,
    program_document_date: toIsoDate(programDocumentDate),
    az_document_number: azDocumentNumber || undefined,
    az_document_date: toIsoDate(azDocumentDate),
    dz_document_number: dzDocumentNumber || undefined,
    dz_document_date: toIsoDate(dzDocumentDate),
    process_effectiveness: processEffectiveness || undefined,
    svk_effectiveness: svkEffectiveness || undefined,
    sur_effectiveness: surEffectiveness || undefined,
    svik_effectiveness: svikEffectiveness || undefined,
  };
}
