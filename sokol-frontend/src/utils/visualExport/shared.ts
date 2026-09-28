import {
  CHECK_EXPORT_SECTIONS,
  DVA_EXPORT_SECTIONS,
  MONITORING_EXPORT_SECTIONS,
  PLANNING_EXPORT_SECTIONS,
  RECOMMENDATION_EXPORT_SECTIONS,
} from '../../constants/analyticsExportSections';
import type { DashboardChartCapture } from '../dashboardChartRegistry';
import type { VisualAnalyticsKind } from './types';

export function stamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export function sheetNameForSection(kind: VisualAnalyticsKind, sectionId: string, fallbackTitle: string) {
  const catalog =
    kind === 'checks'
      ? CHECK_EXPORT_SECTIONS
      : kind === 'recommendations'
        ? RECOMMENDATION_EXPORT_SECTIONS
        : kind === 'monitoring'
          ? MONITORING_EXPORT_SECTIONS
          : kind === 'planning'
            ? PLANNING_EXPORT_SECTIONS
            : DVA_EXPORT_SECTIONS;
  const found = catalog.find((section) => section.id === sectionId);
  const raw = found?.sheetName ?? fallbackTitle;
  return raw.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Дашборд';
}

export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? '';
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const binary = window.atob(dataUrlToBase64(dataUrl));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function fitImageSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(Math.round(width * ratio), 1),
    height: Math.max(Math.round(height * ratio), 1),
  };
}

export { escapeHtml } from '../escapeHtml';

export function orderChartsBySelection(
  charts: DashboardChartCapture[],
  selectedSections: string[],
): DashboardChartCapture[] {
  const order = new Map(selectedSections.map((id, index) => [id, index]));
  return [...charts].sort((left, right) => (order.get(left.id) ?? 999) - (order.get(right.id) ?? 999));
}

export function matrixChartPlaceholder(
  id: 'effectivenessMatrix' | 'materialityMatrix' | 'statusMatrix' | 'checkLifecycle',
): DashboardChartCapture {
  if (id === 'effectivenessMatrix') {
    return {
      id,
      title: 'Оценка эффективности',
      description: 'Матрица оценок по проверкам за период',
      dataUrl: '',
      width: 960,
      height: 540,
    };
  }
  if (id === 'materialityMatrix') {
    return {
      id,
      title: 'Матрица существенности',
      description: '',
      dataUrl: '',
      width: 960,
      height: 540,
    };
  }
  if (id === 'checkLifecycle') {
    return {
      id,
      title: 'Жизненный цикл проверки: от приказа до ДЗ',
      description: 'Жизненный цикл проверки: от приказа до ДЗ',
      dataUrl: '',
      width: 960,
      height: 540,
    };
  }
  return {
    id,
    title: 'Матрица статусов',
    description: 'Матрица статусов по проверкам за период',
    dataUrl: '',
    width: 960,
    height: 540,
  };
}

export function ensureMatrixCharts(
  charts: DashboardChartCapture[],
  selectedSections: string[],
  flags: {
    effectiveness: boolean;
    materiality: boolean;
    status: boolean;
    checkLifecycle: boolean;
  },
): DashboardChartCapture[] {
  const next = [...charts];
  const ensure = (
    id: 'effectivenessMatrix' | 'materialityMatrix' | 'statusMatrix' | 'checkLifecycle',
    enabled: boolean,
  ) => {
    if (enabled && !next.some((chart) => chart.id === id)) {
      next.push(matrixChartPlaceholder(id));
    }
  };
  ensure('effectivenessMatrix', flags.effectiveness);
  ensure('materialityMatrix', flags.materiality);
  ensure('statusMatrix', flags.status);
  ensure('checkLifecycle', flags.checkLifecycle);
  return orderChartsBySelection(next, selectedSections);
}
