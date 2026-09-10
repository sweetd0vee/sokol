/**
 * Bulk analytics export as chart images laid out on PDF/XLSX sheets.
 */
import type { DvaCheckLifecycleRow } from '../api/analytics';
import type { EffectivenessMatrixRow } from './checkAnalytics';
import type { MaterialityMatrixRow } from './materialityMatrix';
import type { StatusMatrixRow } from './statusMatrix';
import {
  captureDashboardCharts,
  chartHasPngPayload,
} from './dashboardChartRegistry';
import { enrichEffectivenessMatrixCapture, enrichMaterialityMatrixCapture, enrichStatusMatrixCapture } from './visualExport/enrich';
import { buildVisualPdf } from './visualExport/pdf';
import { buildVisualXlsx } from './visualExport/xlsx';
import { buildVisualDocx } from './visualExport/docx';
import { buildVisualHtml } from './visualExport/html';
import { ensureMatrixCharts, orderChartsBySelection } from './visualExport/shared';
import type { VisualAnalyticsKind, VisualExportMetaRow } from './visualExport/types';

export type { VisualExportMetaRow, VisualAnalyticsKind };

export async function exportVisualAnalyticsReport(options: {
  format: 'xlsx' | 'pdf' | 'docx' | 'html';
  kind: VisualAnalyticsKind;
  documentTitle: string;
  filenamePrefix: string;
  meta: VisualExportMetaRow[];
  selectedSections: string[];
  effectivenessMatrix?: EffectivenessMatrixRow[];
  materialityMatrix?: MaterialityMatrixRow[];
  statusMatrix?: StatusMatrixRow[];
  checkLifecycle?: DvaCheckLifecycleRow[];
}) {
  const capturedCharts = await captureDashboardCharts(options.selectedSections, {
    // Keep PNG snapshots for HTML too — several inline SVGs otherwise clash on duplicate ids.
    skipPng: false,
  });
  const htmlCharts = enrichStatusMatrixCapture(
    enrichMaterialityMatrixCapture(
      enrichEffectivenessMatrixCapture(
        capturedCharts,
        options.effectivenessMatrix,
        options.selectedSections.includes('effectivenessMatrix'),
      ),
      options.materialityMatrix,
      options.selectedSections.includes('materialityMatrix'),
    ),
    options.statusMatrix,
    options.selectedSections.includes('statusMatrix'),
  );
  const charts = orderChartsBySelection(
    options.format === 'html' ? htmlCharts : capturedCharts,
    options.selectedSections,
  );
  const canRenderMaterialityMatrixTable =
    Boolean(options.materialityMatrix?.length) && options.selectedSections.includes('materialityMatrix');
  const canRenderEffectivenessMatrixTable =
    Boolean(options.effectivenessMatrix?.length) && options.selectedSections.includes('effectivenessMatrix');
  const canRenderStatusMatrixTable =
    Boolean(options.statusMatrix?.length) && options.selectedSections.includes('statusMatrix');
  const canRenderCheckLifecycleTable =
    Boolean(options.checkLifecycle?.length) && options.selectedSections.includes('checkLifecycle');
  const canExportMatrixOnly =
    canRenderEffectivenessMatrixTable
    || canRenderMaterialityMatrixTable
    || canRenderStatusMatrixTable
    || canRenderCheckLifecycleTable;
  if (charts.length === 0 && !canExportMatrixOnly) {
    throw new Error(
      'Не удалось снять дашборды вкладки. Убедитесь, что графики видны на экране, и попробуйте снова.',
    );
  }

  const chartsWithPng = charts.filter((chart) => chartHasPngPayload(chart.dataUrl));

  if (options.format === 'pdf') {
    const chartsForPdf = ensureMatrixCharts(
      charts.filter(
        (chart) =>
          chartHasPngPayload(chart.dataUrl)
          || (canRenderEffectivenessMatrixTable && chart.id === 'effectivenessMatrix')
          || (canRenderMaterialityMatrixTable && chart.id === 'materialityMatrix')
          || (canRenderStatusMatrixTable && chart.id === 'statusMatrix'),
      ),
      options.selectedSections,
      {
        effectiveness: canRenderEffectivenessMatrixTable,
        materiality: canRenderMaterialityMatrixTable,
        status: canRenderStatusMatrixTable,
        checkLifecycle: false,
      },
    );
    if (chartsForPdf.length === 0) {
      throw new Error('Не удалось снять изображения дашбордов для PDF. Обновите страницу и попробуйте снова.');
    }
    await buildVisualPdf({
      documentTitle: options.documentTitle,
      meta: options.meta,
      charts: chartsForPdf,
      filenamePrefix: options.filenamePrefix,
      effectivenessMatrix: options.effectivenessMatrix,
      materialityMatrix: options.materialityMatrix,
      statusMatrix: options.statusMatrix,
    });
    return;
  }

  if (options.format === 'docx') {
    const chartsForDocx = ensureMatrixCharts(
      charts.filter(
        (chart) =>
          (chartHasPngPayload(chart.dataUrl) && !(canRenderCheckLifecycleTable && chart.id === 'checkLifecycle'))
          || (canRenderEffectivenessMatrixTable && chart.id === 'effectivenessMatrix')
          || (canRenderMaterialityMatrixTable && chart.id === 'materialityMatrix')
          || (canRenderStatusMatrixTable && chart.id === 'statusMatrix')
          || (canRenderCheckLifecycleTable && chart.id === 'checkLifecycle'),
      ),
      options.selectedSections,
      {
        effectiveness: canRenderEffectivenessMatrixTable,
        materiality: canRenderMaterialityMatrixTable,
        status: canRenderStatusMatrixTable,
        checkLifecycle: canRenderCheckLifecycleTable,
      },
    );
    if (chartsForDocx.length === 0) {
      throw new Error(
        'Не удалось снять изображения дашбордов для Word. Обновите страницу и попробуйте снова.',
      );
    }
    await buildVisualDocx({
      documentTitle: options.documentTitle,
      meta: options.meta,
      charts: chartsForDocx,
      filenamePrefix: options.filenamePrefix,
      effectivenessMatrix: options.effectivenessMatrix,
      materialityMatrix: options.materialityMatrix,
      statusMatrix: options.statusMatrix,
      checkLifecycle: options.checkLifecycle,
    });
    return;
  }

  if (options.format === 'html') {
    await buildVisualHtml({
      documentTitle: options.documentTitle,
      meta: options.meta,
      charts,
      filenamePrefix: options.filenamePrefix,
    });
    return;
  }

  const hasMatrixTable =
    canRenderEffectivenessMatrixTable || canRenderMaterialityMatrixTable || canRenderStatusMatrixTable;
  if (chartsWithPng.length === 0 && !hasMatrixTable) {
    throw new Error('Не удалось снять изображения дашбордов для Excel. Обновите страницу и попробуйте снова.');
  }
  await buildVisualXlsx({
    documentTitle: options.documentTitle,
    meta: options.meta,
    charts,
    kind: options.kind,
    filenamePrefix: options.filenamePrefix,
    effectivenessMatrix: options.effectivenessMatrix,
    materialityMatrix: options.materialityMatrix,
    statusMatrix: options.statusMatrix,
  });
}
