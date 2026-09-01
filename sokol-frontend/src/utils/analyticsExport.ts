import type { Check } from '../types/check';
import type { MaterialityLevel, Recommendation } from '../types/recommendation';
import { getMaterialityLevelLabel } from '../constants/recommendations';
import {
  buildEffectivenessMatrix,
  type PeriodGranularity,
} from './checkAnalytics';
import type { MaterialityMatrixRow } from './materialityMatrix';
import type { StatusMatrixRow } from './statusMatrix';
import {
  exportVisualAnalyticsReport,
  type VisualAnalyticsKind,
  type VisualExportMetaRow,
} from './analyticsVisualExport';

export const ANALYTICS_EXPORT_FORMATS = [
  { value: 'html', label: 'HTML' },
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'DOCX' },
  { value: 'xlsx', label: 'XLSX' },
] as const;

export type AnalyticsExportFormat = (typeof ANALYTICS_EXPORT_FORMATS)[number]['value'];

export type ChecksDashboardExportInput = {
  checks: Check[];
  filteredChecks: Check[];
  granularity: PeriodGranularity;
  auditors: string[];
  departments?: string[];
  selectedPeriodLabels?: string[];
  selectedSections: string[];
  /** When set (server analytics), used instead of checks.length / filteredChecks.length. */
  universeTotal?: number;
  filteredTotal?: number;
  effectivenessMatrixOverride?: ReturnType<typeof buildEffectivenessMatrix>;
};

export type RecommendationsDashboardExportInput = {
  recommendations: Recommendation[];
  filteredRecommendations: Recommendation[];
  granularity: PeriodGranularity;
  dateFrom: Date | null;
  dateTo: Date | null;
  auditors: string[];
  departments?: string[];
  materialityLevels: MaterialityLevel[];
  selectedSections: string[];
  materialityMatrixOverride?: MaterialityMatrixRow[];
};

export type GenericAnalyticsDashboardExportInput = {
  kind: VisualAnalyticsKind;
  documentTitle: string;
  filenamePrefix: string;
  selectedSections: string[];
  meta: VisualExportMetaRow[];
  statusMatrixOverride?: StatusMatrixRow[];
};

function formatFilterDate(date: Date | null) {
  return date ? date.toLocaleDateString('ru-RU') : '—';
}

function granularityLabel(value: PeriodGranularity) {
  if (value === 'month') {
    return 'По месяцам';
  }
  if (value === 'quarter') {
    return 'По кварталам';
  }
  return 'По годам';
}

export async function exportChecksDashboard(
  input: ChecksDashboardExportInput,
  format: AnalyticsExportFormat,
) {
  const { checks, filteredChecks, granularity, auditors, selectedSections } = input;
  const universeTotal = input.universeTotal ?? checks.length;
  const filteredTotal = input.filteredTotal ?? filteredChecks.length;
  const effectivenessMatrix = selectedSections.includes('effectivenessMatrix')
    ? (input.effectivenessMatrixOverride ?? buildEffectivenessMatrix(filteredChecks))
    : undefined;
  await exportVisualAnalyticsReport({
    format,
    kind: 'checks',
    documentTitle: 'Проверки',
    filenamePrefix: 'analytics-checks',
    selectedSections,
    effectivenessMatrix,
    meta: [
      ['Группировка', granularityLabel(granularity)],
      ...(input.selectedPeriodLabels?.map((label) => ['Период', label] as [string, string]) ?? []),
      ['Аудиторы', auditors.length ? auditors.join(', ') : 'Все'],
      ['Департаменты', input.departments?.length ? input.departments.join(', ') : 'Все'],
      ['Записей в выборке', String(filteredTotal)],
      ['Всего в системе', String(universeTotal)],
      ['Дашбордов в отчёте', String(selectedSections.filter((id) => id !== 'source').length)],
      ['Сформировано', new Date().toLocaleString('ru-RU')],
    ],
  });
}

export async function exportGenericAnalyticsDashboard(
  input: GenericAnalyticsDashboardExportInput,
  format: AnalyticsExportFormat,
) {
  const statusMatrix = input.selectedSections.includes('statusMatrix')
    ? input.statusMatrixOverride
    : undefined;
  await exportVisualAnalyticsReport({
    format,
    kind: input.kind,
    documentTitle: input.documentTitle,
    filenamePrefix: input.filenamePrefix,
    selectedSections: input.selectedSections,
    statusMatrix,
    meta: [...input.meta, ['Сформировано', new Date().toLocaleString('ru-RU')]],
  });
}

export async function exportRecommendationsDashboard(
  input: RecommendationsDashboardExportInput,
  format: AnalyticsExportFormat,
) {
  const {
    recommendations,
    filteredRecommendations,
    granularity,
    dateFrom,
    dateTo,
    auditors,
    materialityLevels,
    selectedSections,
  } = input;
  const materialityMatrix = selectedSections.includes('materialityMatrix')
    ? input.materialityMatrixOverride
    : undefined;
  await exportVisualAnalyticsReport({
    format,
    kind: 'recommendations',
    documentTitle: 'Аналитика рекомендаций',
    filenamePrefix: 'analytics-recommendations',
    selectedSections,
    materialityMatrix,
    meta: [
      ['Группировка', granularityLabel(granularity)],
      ['Срок с', formatFilterDate(dateFrom)],
      ['Срок по', formatFilterDate(dateTo)],
      ['Аудиторы', auditors.length ? auditors.join(', ') : 'Все'],
      [
        'Существенность',
        materialityLevels.length
          ? materialityLevels.map((level) => getMaterialityLevelLabel(level)).join(', ')
          : 'Все уровни',
      ],
      ['Записей в выборке', String(filteredRecommendations.length)],
      ['Всего в системе', String(recommendations.length)],
      ['Дашбордов в отчёте', String(selectedSections.filter((id) => id !== 'source').length)],
      ['Сформировано', new Date().toLocaleString('ru-RU')],
    ],
  });
}
