import type { Check } from '../types/check';
import type { CheckFormDraft } from './checkFormNavigation';
import { toInputDate, toIsoDate, toStartOfDayMs } from './dates';

const MOSCOW_TZ = 'Europe/Moscow';

function moscowTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export type CheckFormFields = {
  checkName: string;
  shortName: string;
  checkType: string;
  checkView: string;
  checkLeader: string;
  checkQuarter: string;
  startDate: Date | null;
  endDate: Date | null;
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
};

export function emptyCheckFormFields(): CheckFormFields {
  return {
    checkName: '',
    shortName: '',
    checkType: '',
    checkView: '',
    checkLeader: '',
    checkQuarter: '',
    startDate: null,
    endDate: null,
    orderDocumentNumber: '',
    orderDocumentDate: null,
    programDocumentNumber: '',
    programDocumentDate: null,
    azDocumentNumber: '',
    azDocumentDate: null,
    dzDocumentNumber: '',
    dzDocumentDate: null,
    processEffectiveness: '',
    svkEffectiveness: '',
    surEffectiveness: '',
    svikEffectiveness: '',
  };
}

export function checkFormFieldsFromCheck(existing: Check): CheckFormFields {
  return {
    checkName: existing.check_name ?? '',
    shortName: existing.short_name ?? '',
    checkType: existing.check_type ?? '',
    checkView: existing.check_view ?? '',
    checkLeader: existing.check_leader ?? '',
    checkQuarter: String(existing.check_quarter ?? ''),
    startDate: toInputDate(existing.start_date),
    endDate: toInputDate(existing.end_date),
    orderDocumentNumber: existing.order_document_number ?? '',
    orderDocumentDate: toInputDate(existing.order_document_date),
    programDocumentNumber: existing.program_document_number ?? '',
    programDocumentDate: toInputDate(existing.program_document_date),
    azDocumentNumber: existing.az_document_number ?? '',
    azDocumentDate: toInputDate(existing.az_document_date),
    dzDocumentNumber: existing.dz_document_number ?? '',
    dzDocumentDate: toInputDate(existing.dz_document_date),
    processEffectiveness: existing.process_effectiveness ?? '',
    svkEffectiveness: existing.svk_effectiveness ?? '',
    surEffectiveness: existing.sur_effectiveness ?? '',
    svikEffectiveness: existing.svik_effectiveness ?? '',
  };
}

function restoredDate(value: string | null | undefined): Date | null {
  return value ? toInputDate(value) : null;
}

export function resolveInitialCheckFormFields(
  restoredDraft: CheckFormDraft | undefined,
  existing: Check | undefined,
): CheckFormFields {
  const fromExisting = existing ? checkFormFieldsFromCheck(existing) : emptyCheckFormFields();
  if (!restoredDraft) {
    return fromExisting;
  }

  return {
    checkName: restoredDraft.checkName ?? fromExisting.checkName,
    shortName: restoredDraft.shortName ?? fromExisting.shortName,
    checkType: restoredDraft.checkType ?? fromExisting.checkType,
    checkView: restoredDraft.checkView ?? fromExisting.checkView,
    checkLeader: restoredDraft.checkLeader ?? fromExisting.checkLeader,
    checkQuarter: restoredDraft.checkQuarter ?? fromExisting.checkQuarter,
    startDate: restoredDate(restoredDraft.startDate),
    endDate: restoredDate(restoredDraft.endDate),
    orderDocumentNumber: restoredDraft.orderDocumentNumber ?? fromExisting.orderDocumentNumber,
    orderDocumentDate: restoredDate(restoredDraft.orderDocumentDate),
    programDocumentNumber: restoredDraft.programDocumentNumber ?? fromExisting.programDocumentNumber,
    programDocumentDate: restoredDate(restoredDraft.programDocumentDate),
    azDocumentNumber: restoredDraft.azDocumentNumber ?? fromExisting.azDocumentNumber,
    azDocumentDate: restoredDate(restoredDraft.azDocumentDate),
    dzDocumentNumber: restoredDraft.dzDocumentNumber ?? fromExisting.dzDocumentNumber,
    dzDocumentDate: restoredDate(restoredDraft.dzDocumentDate),
    processEffectiveness: restoredDraft.processEffectiveness ?? fromExisting.processEffectiveness,
    svkEffectiveness: restoredDraft.svkEffectiveness ?? fromExisting.svkEffectiveness,
    surEffectiveness: restoredDraft.surEffectiveness ?? fromExisting.surEffectiveness,
    svikEffectiveness: restoredDraft.svikEffectiveness ?? fromExisting.svikEffectiveness,
  };
}

export function deriveCheckStatus(
  startDate: Date | null,
  dzDocumentDate: Date | null,
  existingStatus: string | undefined,
  now = new Date(),
): string {
  if (dzDocumentDate) {
    return 'completed';
  }
  if (!startDate) {
    return existingStatus ?? '';
  }
  const start = toIsoDate(startDate);
  if (!start) {
    return existingStatus ?? '';
  }
  return start > moscowTodayIso(now) ? 'not_started' : 'in_progress';
}

export function getMissingCheckKeyFieldLabels(
  startDate: Date | null,
  checkQuarter: string,
  checkLeader: string,
  checkType: string,
): string[] {
  return [
    !startDate ? 'дату начала' : '',
    !checkQuarter ? 'квартал проверки' : '',
    !checkLeader ? 'руководителя' : '',
    !checkType ? 'тип' : '',
  ].filter(Boolean);
}

export function isCheckKeySourceChanged(
  existing: Check | undefined,
  fields: Pick<CheckFormFields, 'checkType' | 'checkLeader' | 'checkQuarter' | 'startDate'>,
): boolean {
  if (!existing?.serial_number) {
    return false;
  }
  const existingStartDate = toInputDate(existing.start_date);
  return (
    fields.checkType !== existing.check_type
    || fields.checkLeader !== existing.check_leader
    || fields.checkQuarter !== String(existing.check_quarter)
    || Boolean(
      fields.startDate
      && existingStartDate
      && toIsoDate(fields.startDate) !== toIsoDate(existingStartDate),
    )
  );
}

export function toCheckFormDraft(fields: CheckFormFields, existing?: Check): CheckFormDraft {
  return {
    existingCheck: existing,
    checkName: fields.checkName,
    shortName: fields.shortName,
    checkType: fields.checkType,
    checkView: fields.checkView,
    checkLeader: fields.checkLeader,
    checkQuarter: fields.checkQuarter,
    startDate: fields.startDate ? (toIsoDate(fields.startDate) ?? null) : null,
    endDate: fields.endDate ? (toIsoDate(fields.endDate) ?? null) : null,
    orderDocumentNumber: fields.orderDocumentNumber,
    orderDocumentDate: fields.orderDocumentDate ? (toIsoDate(fields.orderDocumentDate) ?? null) : null,
    programDocumentNumber: fields.programDocumentNumber,
    programDocumentDate: fields.programDocumentDate ? (toIsoDate(fields.programDocumentDate) ?? null) : null,
    azDocumentNumber: fields.azDocumentNumber,
    azDocumentDate: fields.azDocumentDate ? (toIsoDate(fields.azDocumentDate) ?? null) : null,
    dzDocumentNumber: fields.dzDocumentNumber,
    dzDocumentDate: fields.dzDocumentDate ? (toIsoDate(fields.dzDocumentDate) ?? null) : null,
    processEffectiveness: fields.processEffectiveness,
    svkEffectiveness: fields.svkEffectiveness,
    surEffectiveness: fields.surEffectiveness,
    svikEffectiveness: fields.svikEffectiveness,
  };
}

export function applyStartDateChange(
  fields: CheckFormFields,
  value: Date | null,
): CheckFormFields {
  const next = { ...fields, startDate: value };
  if (value && fields.endDate && toStartOfDayMs(fields.endDate) < toStartOfDayMs(value)) {
    next.endDate = value;
  }
  return next;
}
