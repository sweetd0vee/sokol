import type { Check } from '../../types/check';
import { getCheckStatusLabel, getCheckTypeLabel, getCheckViewLabel } from '../../constants/checks';
import { getCheckYearlyId } from '../checkYearlyNumber';
import { getRecommendationYearlyId } from '../recommendationYearlyNumber';
import type { Recommendation } from '../../types/recommendation';
import {
  getIndicatorLabel,
  getMaterialityLevelLabel,
  getRecommendationAdditionalStatusLabel,
  getRecommendationStatusLabel,
} from '../../constants/recommendations';
import { formatRecommendationAuditObjects } from '../auditObjects';
import { getRecommendationExecutionInfo } from '../../constants/recommendationClosure';
import { buildCheckViewBySerial } from '../recommendationList';
import type { ExportRow } from './types';

export const HEADER_BLUE = '003366';
export const LIGHT_ROW_FILL = 'F8FAFC';
export const BORDER_GRAY = 'D1D5DB';
export const WHITE = 'FFFFFF';
export const CHECK_STATUS_FILLS: Record<string, string> = {
  Запланировано: 'E5E7EB',
  'В процессе': 'FEF9C3',
  Завершено: 'DCFCE7',
};
export const RECOMMENDATION_STATUS_FILLS: Record<string, string> = {
  Исполнено: 'DCFCE7',
  'Не решено': 'FECACA',
  'На контроле': 'E5E7EB',
  'В процессе': 'FEF9C3',
};
export const RECOMMENDATION_ADDITIONAL_STATUS_FILLS: Record<string, string> = {
  'В срок': 'DCFCE7',
  'Срок нарушен': 'FECACA',
  'На контроле': 'E5E7EB',
};
/** Dot colors matching the recommendations table UI. */
export const MATERIALITY_DOT_COLORS: Record<string, string> = {
  Высокий: 'FF4347',
  Средний: 'FBEB8D',
  Низкий: 'A7F7C2',
};
export const MATERIALITY_DOT_CHAR = '●';
export const INDICATOR_ICON_DISPLAY_PX = 14;
/** PDF marker size: materiality dots are a 10pt circle; indicator icons match that. */
export const PDF_MATERIALITY_DOT_RADIUS = 5;
export const PDF_INDICATOR_ICON_SIZE = PDF_MATERIALITY_DOT_RADIUS * 2;
export const RECOMMENDATION_XLSX_DEFAULT_COLUMN_WIDTH = 18;
export const RECOMMENDATION_XLSX_MIN_ROW_HEIGHT = 22;
export const RECOMMENDATION_XLSX_MAX_ROW_HEIGHT = 240;
export const RECOMMENDATION_XLSX_LINE_HEIGHT = 15;
export const DOCX_LANDSCAPE_PAGE_WIDTH_TWIPS = 16838;
export const DOCX_LANDSCAPE_PAGE_HEIGHT_TWIPS = 11906;
export const DOCX_LANDSCAPE_MARGIN_TWIPS = 360;
export const DOCX_DEFAULT_CELL_MARGIN_TWIPS = 90;
export const DOCX_COMPACT_CELL_MARGIN_TWIPS = 45;
export const RECOMMENDATION_XLSX_COLUMN_WIDTHS: Record<string, number> = {
  ID: 10,
  Ключ: 14,
  'Название проверки': 110,
  'Название рекомендации': 58,
  'Название наблюдения': 58,
  'Информация о выполнении': 58,
  'Объект аудита': 34,
  Индикатор: 12,
  Вид: 16,
  'Срок исполнения': 15,
  'Уровень существенности': 24,
  Аудитор: 24,
  'Руководитель объекта аудита': 30,
  Статус: 17,
  'Дополнительный статус': 22,
};

export const CHECK_COLUMN_KEYS = [
  'ID',
  'Ключ',
  'Название проверки',
  'Тип проверки',
  'Вид',
  'Квартал проверки',
  'Дата начала',
  'Руководитель проверки',
  'Статус',
] as const;

export const RECOMMENDATION_TABLE_COLUMN_KEYS = [
  'ID',
  'Ключ',
  'Название проверки',
  'Название рекомендации',
  'Название наблюдения',
  'Информация о выполнении',
  'Объект аудита',
  'Индикатор',
  'Вид',
  'Срок исполнения',
  'Уровень существенности',
  'Аудитор',
  'Руководитель объекта аудита',
  'Статус',
  'Дополнительный статус',
] as const;

export const TIMES_NEW_ROMAN_12 = { name: 'Times New Roman', sz: 12 };

export function getHeaders(rows: ExportRow[], fallbackHeaders: readonly string[]) {
  return rows.length > 0 ? Object.keys(rows[0]!) : [...fallbackHeaders];
}

export function toCellText(value: unknown) {
  return String(value ?? '');
}

export function getStatusFill(value: unknown) {
  const text = toCellText(value);
  return RECOMMENDATION_STATUS_FILLS[text] ?? CHECK_STATUS_FILLS[text];
}

export function getAdditionalStatusFill(value: unknown) {
  return RECOMMENDATION_ADDITIONAL_STATUS_FILLS[toCellText(value)];
}

export function getMaterialityDotColor(value: unknown) {
  return MATERIALITY_DOT_COLORS[toCellText(value)];
}

export function isMaterialityHeader(header: string | undefined) {
  return header === 'Уровень существенности';
}

export function isIndicatorHeader(header: string | undefined) {
  return header === 'Индикатор';
}

export function getHighlightFill(header: string | undefined, value: unknown) {
  if (header === 'Статус') {
    return getStatusFill(value);
  }
  if (header === 'Дополнительный статус') {
    return getAdditionalStatusFill(value);
  }
  return undefined;
}

export function formatCheckDate(value?: string) {
  if (!value) {
    return '';
  }
  const [year, month, day] = value.split('-').map(Number);
  if (year && month && day) {
    return new Date(year, month - 1, day).toLocaleDateString('ru-RU');
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ru-RU');
}

export function toCheckRows(checks: Check[], yearlyNumbers: Map<string, number>): ExportRow[] {
  return checks.map((check) => ({
    ID: getCheckYearlyId(check, yearlyNumbers) ?? '',
    Ключ: check.serial_number ?? '',
    'Название проверки': check.check_name ?? '',
    'Тип проверки': getCheckTypeLabel(check.check_type),
    Вид: getCheckViewLabel(check.check_view),
    'Квартал проверки': check.check_quarter,
    'Дата начала': formatCheckDate(check.start_date),
    'Руководитель проверки': check.check_leader ?? '',
    Статус: getCheckStatusLabel(check.status),
  }));
}

export function toRecommendationTableRows(
  recommendations: Recommendation[],
  checks: Check[],
  yearlyNumbers: Map<string, number>,
): ExportRow[] {
  const checkNameByKey = new Map(
    checks.map((check) => [check.serial_number, check.check_name?.trim() ?? ''] as const),
  );
  const checkViewByKey = buildCheckViewBySerial(checks);

  return recommendations.map((recommendation) => ({
    ID: getRecommendationYearlyId(recommendation, yearlyNumbers) ?? '',
    Ключ: recommendation.serial_number,
    'Название проверки': checkNameByKey.get(recommendation.serial_number) ?? '',
    'Название рекомендации': recommendation.name,
    'Название наблюдения': recommendation.observation_name ?? '',
    'Информация о выполнении': getRecommendationExecutionInfo(recommendation),
    'Объект аудита': formatRecommendationAuditObjects(recommendation.audit_object),
    Индикатор: getIndicatorLabel(recommendation.indicator),
    Вид: checkViewByKey.get(recommendation.serial_number) ?? '',
    'Срок исполнения': formatCheckDate(recommendation.deadline),
    'Уровень существенности': getMaterialityLevelLabel(recommendation.materiality_level),
    Аудитор: recommendation.auditor,
    'Руководитель объекта аудита': recommendation.manager,
    Статус: getRecommendationStatusLabel(recommendation.status),
    'Дополнительный статус': getRecommendationAdditionalStatusLabel(recommendation.additional_status),
  }));
}
