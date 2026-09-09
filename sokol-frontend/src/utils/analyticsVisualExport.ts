/**
 * Bulk analytics export as chart images laid out on PDF/XLSX sheets.
 */
import ExcelJS from 'exceljs';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  ShadingType,
  TextRun,
  WidthType,
} from 'docx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  CHECK_EXPORT_SECTIONS,
  DVA_EXPORT_SECTIONS,
  MONITORING_EXPORT_SECTIONS,
  PLANNING_EXPORT_SECTIONS,
  RECOMMENDATION_EXPORT_SECTIONS,
} from '../constants/analyticsExportSections';
import {
  captureDashboardCharts,
  chartHasPngPayload,
  isUsefulSvgMarkup,
  namespaceSvgMarkupForEmbed,
  type DashboardChartCapture,
} from './dashboardChartRegistry';
import {
  buildEffectivenessColumnShares,
  buildEffectivenessMatrixHtmlMarkup,
  EFFECTIVENESS_LEGEND,
  EFFECTIVENESS_MATRIX_COLUMNS,
  formatEffectivenessChecksCount,
  getEffectivenessToneColor,
  type EffectivenessMatrixRow,
} from './checkAnalytics';
import {
  buildMaterialityMatrixColumnTotals,
  buildMaterialityMatrixHtmlMarkup,
  formatMaterialityChecksCount,
  getMaterialityMatrixCount,
  MATERIALITY_MATRIX_COLUMNS,
  MATERIALITY_MATRIX_LEGEND,
  MATERIALITY_MATRIX_TOTAL_COLUMN,
  materialityMatrixGrandTotal,
  type MaterialityMatrixRow,
} from './materialityMatrix';
import {
  buildStatusMatrixColumnShares,
  buildStatusMatrixHtmlMarkup,
  formatStatusChecksCount,
  getStatusMatrixCount,
  STATUS_MATRIX_COLUMNS,
  STATUS_MATRIX_LEGEND,
  type StatusMatrixRow,
} from './statusMatrix';
import {
  getMaterialityChartColor,
  RECOMMENDATIONS_MATERIALITY_CHART_COLORS,
  VALUE_BLUE_SCALE,
  VALUE_TEAL_SCALE,
} from '../components/analytics/analyticsPalette';
import type { DvaCheckLifecycleRow } from '../api/analytics';
import {
  buildCheckLifecycleExportRows,
  CHECK_LIFECYCLE_SEGMENTS,
  formatLifecycleChecksCount,
} from './dvaAnalytics';

pdfMake.addVirtualFileSystem(pdfFonts);

export type VisualExportMetaRow = [string, string];

function stamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export type VisualAnalyticsKind = 'checks' | 'recommendations' | 'monitoring' | 'dva' | 'planning';

function sheetNameForSection(kind: VisualAnalyticsKind, sectionId: string, fallbackTitle: string) {
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

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? '';
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const binary = window.atob(dataUrlToBase64(dataUrl));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function fitImageSize(
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

function buildEffectivenessMatrixLegendPdfContent(totalChecks: number): Content[] {
  const legendBody = EFFECTIVENESS_LEGEND.map((item) => [
    {
      text: '',
      fillColor: item.color,
      border: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    },
    {
      text: item.label,
      color: '#334155',
      fontSize: 10,
      border: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    },
  ]);

  return [
    {
      text: `Итого: ${formatEffectivenessChecksCount(totalChecks)}`,
      fontSize: 10,
      color: '#64748B',
      margin: [0, 10, 0, 8],
    },
    {
      text: 'Легенда',
      fontSize: 11,
      bold: true,
      color: '#003366',
      margin: [0, 0, 0, 4],
    },
    {
      table: {
        widths: [16, '*'],
        body: legendBody,
      },
      layout: {
        defaultBorder: false,
        paddingLeft: () => 0,
        paddingRight: () => 8,
        paddingTop: () => 2,
        paddingBottom: () => 2,
      },
    } as Content,
  ];
}

function buildEffectivenessMatrixPdfContent(
  chart: DashboardChartCapture,
  rows: EffectivenessMatrixRow[],
): Content[] {
  const body = [
    [
      { text: 'Ключ', bold: true, color: '#FFFFFF', fillColor: '#003366' },
      { text: 'Краткое название проверки', bold: true, color: '#FFFFFF', fillColor: '#003366' },
      ...EFFECTIVENESS_MATRIX_COLUMNS.map((column) => ({
        text: column.label,
        bold: true,
        color: '#FFFFFF',
        fillColor: '#003366',
        alignment: 'center' as const,
      })),
    ],
    ...rows.map((row) => [
      { text: row.key, bold: true, color: '#334155', noWrap: true },
      { text: row.shortName || row.name || '—', color: '#334155' },
      ...EFFECTIVENESS_MATRIX_COLUMNS.map((column) => ({
        text: '',
        fillColor: getEffectivenessToneColor(row.tones[column.key]),
        borderColor: ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'],
      })),
    ]),
  ];

  const shareBody = [
    [
      { text: 'Раздел', bold: true, color: '#FFFFFF', fillColor: '#003366' },
      { text: 'Доля оценок', bold: true, color: '#FFFFFF', fillColor: '#003366' },
    ],
    ...EFFECTIVENESS_MATRIX_COLUMNS.map((column) => ({
      area: column.label,
      shares: buildEffectivenessColumnShares(rows, column.key),
    })).map(({ area, shares }) => [
      { text: area, bold: true, color: '#334155' },
      {
        text: shares.map((share) => `${share.label}: ${share.percent}% (${share.count})`).join('; ') || '—',
        color: '#334155',
      },
    ]),
  ];

  return [
    {
      text: chart.title,
      fontSize: 15,
      bold: true,
      color: '#003366',
      margin: [0, 0, 0, 4],
    },
    {
      text: `${chart.description} (все строки выборки)`,
      fontSize: 10,
      color: '#64748B',
      margin: [0, 0, 0, 12],
    },
    {
      table: {
        headerRows: 1,
        widths: [62, '*', 54, 54, 54, 54],
        body,
        dontBreakRows: true,
      },
      layout: {
        hLineColor: () => '#E2E8F0',
        vLineColor: () => '#E2E8F0',
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
      margin: [0, 0, 0, 14],
    } as Content,
    {
      text: 'Доля оценок',
      fontSize: 12,
      bold: true,
      color: '#003366',
      margin: [0, 0, 0, 6],
    },
    {
      table: {
        headerRows: 1,
        widths: [120, '*'],
        body: shareBody,
      },
      layout: {
        hLineColor: () => '#E2E8F0',
        vLineColor: () => '#E2E8F0',
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 4,
        paddingBottom: () => 4,
      },
      margin: [0, 0, 0, 0],
    } as Content,
    ...buildEffectivenessMatrixLegendPdfContent(rows.length),
  ];
}

function buildMaterialityMatrixPdfContent(
  chart: DashboardChartCapture,
  rows: MaterialityMatrixRow[],
): Content[] {
  const totals = buildMaterialityMatrixColumnTotals(rows);
  const grandTotal = materialityMatrixGrandTotal(rows);
  const body = [
    [
      { text: 'Ключ', bold: true, color: '#FFFFFF', fillColor: '#003366' },
      { text: 'Краткое название проверки', bold: true, color: '#FFFFFF', fillColor: '#003366' },
      ...MATERIALITY_MATRIX_COLUMNS.map((column) => ({
        text: column.label,
        bold: true,
        color: '#FFFFFF',
        fillColor: '#003366',
        alignment: 'center' as const,
      })),
      {
        text: MATERIALITY_MATRIX_TOTAL_COLUMN.label,
        bold: true,
        color: '#FFFFFF',
        fillColor: '#003366',
        alignment: 'center' as const,
      },
    ],
    ...rows.map((row) => [
      { text: row.key, bold: true, color: '#334155', noWrap: true },
      { text: row.shortName || row.name || '—', color: '#334155' },
      ...MATERIALITY_MATRIX_COLUMNS.map((column) => {
        const count = getMaterialityMatrixCount(row, column.key);
        const fill = getMaterialityChartColor(column.level);
        return {
          text: String(count),
          alignment: 'center' as const,
          bold: true,
          color: '#1E293B',
          fillColor: fill,
        };
      }),
      {
        text: String(row.total),
        alignment: 'center' as const,
        bold: true,
        color: '#1E293B',
      },
    ]),
  ];

  const shareBody = [
    [
      { text: 'Уровень', bold: true, color: '#FFFFFF', fillColor: '#003366' },
      { text: 'Доля рекомендаций', bold: true, color: '#FFFFFF', fillColor: '#003366' },
    ],
    ...MATERIALITY_MATRIX_COLUMNS.map((column) => {
      const count = totals[column.key];
      const percent = grandTotal === 0 ? 0 : Math.round((count / grandTotal) * 100);
      return [
        { text: column.label, bold: true, color: '#334155' },
        { text: `${percent}% (${count})`, color: '#334155' },
      ];
    }),
  ];

  const legendBody = MATERIALITY_MATRIX_LEGEND.map((item) => [
    {
      text: '',
      fillColor: item.color,
      border: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    },
    {
      text: item.label,
      color: '#334155',
      fontSize: 10,
      border: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    },
  ]);

  return [
    {
      text: chart.title,
      fontSize: 15,
      bold: true,
      color: '#003366',
      margin: [0, 0, 0, 4],
    },
    {
      text: `${chart.description} (все строки выборки)`,
      fontSize: 10,
      color: '#64748B',
      margin: [0, 0, 0, 12],
    },
    {
      table: {
        headerRows: 1,
        widths: [72, '*', 54, 54, 54, 72],
        body,
        dontBreakRows: true,
      },
      layout: {
        hLineColor: () => '#E2E8F0',
        vLineColor: () => '#E2E8F0',
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
      margin: [0, 0, 0, 14],
    } as Content,
    {
      text: 'Доля рекомендаций',
      fontSize: 12,
      bold: true,
      color: '#003366',
      margin: [0, 0, 0, 6],
    },
    {
      table: {
        headerRows: 1,
        widths: [120, '*'],
        body: shareBody,
      },
      layout: {
        hLineColor: () => '#E2E8F0',
        vLineColor: () => '#E2E8F0',
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 4,
        paddingBottom: () => 4,
      },
      margin: [0, 0, 0, 8],
    } as Content,
    {
      text: `Итого: ${formatMaterialityChecksCount(rows.length)}`,
      fontSize: 10,
      color: '#64748B',
      margin: [0, 4, 0, 8],
    },
    {
      table: {
        widths: [16, '*'],
        body: legendBody,
      },
      layout: {
        defaultBorder: false,
        paddingLeft: () => 0,
        paddingRight: () => 8,
        paddingTop: () => 2,
        paddingBottom: () => 2,
      },
    } as Content,
  ];
}

function buildStatusMatrixPdfContent(
  chart: DashboardChartCapture,
  rows: StatusMatrixRow[],
): Content[] {
  const shares = buildStatusMatrixColumnShares(rows);
  const body = [
    [
      { text: 'Ключ проверки', bold: true, color: '#FFFFFF', fillColor: '#003366' },
      { text: 'Краткое название проверки', bold: true, color: '#FFFFFF', fillColor: '#003366' },
      ...STATUS_MATRIX_COLUMNS.map((column) => ({
        text: column.label,
        bold: true,
        color: '#FFFFFF',
        fillColor: '#003366',
        alignment: 'center' as const,
      })),
    ],
    ...rows.map((row) => [
      { text: row.key, bold: true, color: '#334155', noWrap: true },
      { text: row.shortName || row.name || '—', color: '#334155' },
      ...STATUS_MATRIX_COLUMNS.map((column) => ({
        text: String(getStatusMatrixCount(row, column.key)),
        alignment: 'center' as const,
        bold: true,
        color: '#1E293B',
      })),
    ]),
  ];

  const shareBody = [
    [
      { text: 'Статус', bold: true, color: '#FFFFFF', fillColor: '#003366' },
      { text: 'Доля рекомендаций', bold: true, color: '#FFFFFF', fillColor: '#003366' },
    ],
    ...shares.map((share) => [
      { text: share.label, bold: true, color: '#334155' },
      { text: `${share.percent}% (${share.count})`, color: '#334155' },
    ]),
  ];

  const legendBody = STATUS_MATRIX_LEGEND.map((item) => [
    {
      text: '',
      fillColor: item.color,
      border: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    },
    {
      text: item.label,
      color: '#334155',
      fontSize: 10,
      border: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    },
  ]);

  return [
    {
      text: chart.title,
      fontSize: 15,
      bold: true,
      color: '#003366',
      margin: [0, 0, 0, 4],
    },
    {
      text: `${chart.description} (все строки выборки)`,
      fontSize: 10,
      color: '#64748B',
      margin: [0, 0, 0, 12],
    },
    {
      table: {
        headerRows: 1,
        widths: [72, '*', 54, 54, 54, 54],
        body,
        dontBreakRows: true,
      },
      layout: {
        hLineColor: () => '#E2E8F0',
        vLineColor: () => '#E2E8F0',
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
      margin: [0, 0, 0, 14],
    } as Content,
    {
      text: 'Доля рекомендаций',
      fontSize: 12,
      bold: true,
      color: '#003366',
      margin: [0, 0, 0, 6],
    },
    {
      table: {
        headerRows: 1,
        widths: [120, '*'],
        body: shareBody,
      },
      layout: {
        hLineColor: () => '#E2E8F0',
        vLineColor: () => '#E2E8F0',
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 4,
        paddingBottom: () => 4,
      },
      margin: [0, 0, 0, 8],
    } as Content,
    {
      text: `Итого: ${formatStatusChecksCount(rows.length)}`,
      fontSize: 10,
      color: '#64748B',
      margin: [0, 4, 0, 8],
    },
    {
      table: {
        widths: [16, '*'],
        body: legendBody,
      },
      layout: {
        defaultBorder: false,
        paddingLeft: () => 0,
        paddingRight: () => 8,
        paddingTop: () => 2,
        paddingBottom: () => 2,
      },
    } as Content,
  ];
}

const DOCX_PAGE_MARGIN_TWIPS = 720;
const DOCX_CHART_MAX_WIDTH = 980;
const DOCX_CHART_MAX_HEIGHT = 520;
const DOCX_FRAME_BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'D7DEE7' };

const DOCX_LANDSCAPE_PAGE = {
  size: {
    orientation: PageOrientation.LANDSCAPE,
  },
  margin: {
    top: DOCX_PAGE_MARGIN_TWIPS,
    right: DOCX_PAGE_MARGIN_TWIPS,
    bottom: DOCX_PAGE_MARGIN_TWIPS,
    left: DOCX_PAGE_MARGIN_TWIPS,
  },
};

async function buildVisualPdf(options: {
  documentTitle: string;
  meta: VisualExportMetaRow[];
  charts: DashboardChartCapture[];
  filenamePrefix: string;
  effectivenessMatrix?: EffectivenessMatrixRow[];
  materialityMatrix?: MaterialityMatrixRow[];
  statusMatrix?: StatusMatrixRow[];
}) {
  const { documentTitle, meta, charts, filenamePrefix, effectivenessMatrix, materialityMatrix, statusMatrix } = options;
  const content: Content[] = [
    {
      text: documentTitle,
      fontSize: 20,
      bold: true,
      color: '#003366',
      margin: [0, 0, 0, 8],
    },
    {
      text: 'Отчёт по выбранным дашбордам — графики как на экране',
      fontSize: 11,
      color: '#64748B',
      margin: [0, 0, 0, 16],
    },
    {
      table: {
        widths: [180, '*'],
        body: meta.map(([label, value]) => [
          { text: label, bold: true, color: '#003366', fontSize: 10 },
          { text: value, fontSize: 10, color: '#334155' },
        ]),
      },
      layout: {
        hLineColor: () => '#E2E8F0',
        vLineColor: () => '#E2E8F0',
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 5,
        paddingBottom: () => 5,
      },
      margin: [0, 0, 0, 18],
    },
  ];

  charts.forEach((chart, index) => {
    if (index > 0) {
      content.push({ text: '', pageBreak: 'before' });
    }
    if (chart.id === 'effectivenessMatrix' && effectivenessMatrix?.length) {
      content.push(...buildEffectivenessMatrixPdfContent(chart, effectivenessMatrix));
      return;
    }
    if (chart.id === 'materialityMatrix' && materialityMatrix?.length) {
      content.push(...buildMaterialityMatrixPdfContent(chart, materialityMatrix));
      return;
    }
    if (chart.id === 'statusMatrix' && statusMatrix?.length) {
      content.push(...buildStatusMatrixPdfContent(chart, statusMatrix));
      return;
    }
    const fitted = fitImageSize(chart.width * 2, chart.height * 2, 760, 430);
    content.push({
      text: chart.title,
      fontSize: 15,
      bold: true,
      color: '#003366',
      margin: [0, 0, 0, 4],
    });
    content.push({
      text: chart.description,
      fontSize: 10,
      color: '#64748B',
      margin: [0, 0, 0, 12],
    });
    content.push({
      image: chart.dataUrl,
      width: fitted.width,
      alignment: 'center',
      margin: [0, 8, 0, 0],
    });
  });

  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [28, 32, 28, 32],
    content,
    footer: (currentPage, pageCount) => ({
      text: `SOKOL · ${currentPage} / ${pageCount}`,
      alignment: 'center',
      fontSize: 8,
      color: '#94A3B8',
      margin: [0, 8, 0, 0],
    }),
    defaultStyle: { font: 'Roboto' },
  };

  pdfMake.createPdf(doc).download(`${filenamePrefix}-${stamp()}.pdf`);
}

function hexToArgb(hex: string): string {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length === 6) {
    return `FF${normalized.toUpperCase()}`;
  }
  if (normalized.length === 8) {
    return normalized.toUpperCase();
  }
  return 'FF94A3B8';
}

function writeEffectivenessMatrixSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  chart: DashboardChartCapture,
  rows: EffectivenessMatrixRow[],
) {
  const sheet = workbook.addWorksheet(sheetName, {
    properties: { tabColor: { argb: 'FF065F46' } },
    views: [{ showGridLines: false }],
  });

  const headers = ['Ключ', 'Краткое название проверки', ...EFFECTIVENESS_MATRIX_COLUMNS.map((column) => column.label)];
  const keyColumnWidth = 18;
  const shortNameColumnWidth = 80;
  sheet.columns = [
    { width: keyColumnWidth },
    { width: shortNameColumnWidth },
    ...EFFECTIVENESS_MATRIX_COLUMNS.map(() => ({ width: 14 })),
  ];

  sheet.mergeCells(1, 1, 1, headers.length);
  sheet.getCell(1, 1).value = chart.title;
  sheet.getCell(1, 1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF003366' } };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, headers.length);
  sheet.getCell(2, 1).value = chart.description || 'Матрица оценок по проверкам за период (все строки выборки)';
  sheet.getCell(2, 1).font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
  sheet.getRow(2).height = 18;

  const headerRow = sheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    cell.alignment = { horizontal: index < 2 ? 'left' : 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
  headerRow.height = 22;

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(5 + rowIndex);
    const keyCell = excelRow.getCell(1);
    keyCell.value = row.key;
    keyCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
    keyCell.alignment = { horizontal: 'left', vertical: 'middle' };

    const shortNameCell = excelRow.getCell(2);
    const shortNameValue = row.shortName || '—';
    shortNameCell.value = shortNameValue;
    shortNameCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
    shortNameCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    // ExcelJS doesn't auto-resize row height for wrapped cells; estimate based on character count.
    const usableWidth = Math.max(Math.floor(shortNameColumnWidth * 0.75), 8);
    const wrappedLineCount = shortNameValue
      .toString()
      .split(/\r?\n/)
      .reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / usableWidth)), 0);

    EFFECTIVENESS_MATRIX_COLUMNS.forEach((column, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 3);
      const color = getEffectivenessToneColor(row.tones[column.key]);
      cell.value = null;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(color) } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      };
    });

    [1, 2].forEach((columnIndex) => {
      const cell = excelRow.getCell(columnIndex);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    const baseRowHeight = 18;
    excelRow.height = Math.min(72, Math.max(baseRowHeight, baseRowHeight * wrappedLineCount + 2));
  });

  const shareStartRow = 5 + rows.length + 2;
  sheet.mergeCells(shareStartRow, 1, shareStartRow, headers.length);
  const shareTitleCell = sheet.getCell(shareStartRow, 1);
  shareTitleCell.value = 'Доля оценок';
  shareTitleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF003366' } };
  sheet.getRow(shareStartRow).height = 20;

  const shareHeaderRow = sheet.getRow(shareStartRow + 1);
  ['Раздел', 'Доля оценок'].forEach((header, index) => {
    const cell = shareHeaderRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
  shareHeaderRow.height = 22;

  EFFECTIVENESS_MATRIX_COLUMNS.forEach((column, index) => {
    const excelRow = sheet.getRow(shareStartRow + 2 + index);
    const areaCell = excelRow.getCell(1);
    areaCell.value = column.label;
    areaCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    areaCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };

    const shares = buildEffectivenessColumnShares(rows, column.key);
    const shareCell = excelRow.getCell(2);
    shareCell.value = shares.map((share) => `${share.label}: ${share.percent}% (${share.count})`).join('; ') || '—';
    shareCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    shareCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };

    [1, 2].forEach((columnIndex) => {
      const cell = excelRow.getCell(columnIndex);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    excelRow.height = 28;
  });

  const legendStartRow = shareStartRow + 2 + EFFECTIVENESS_MATRIX_COLUMNS.length + 2;
  sheet.mergeCells(legendStartRow, 1, legendStartRow, headers.length);
  const legendTitleCell = sheet.getCell(legendStartRow, 1);
  legendTitleCell.value = 'Легенда';
  legendTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF003366' } };
  sheet.getRow(legendStartRow).height = 18;

  EFFECTIVENESS_LEGEND.forEach((item, index) => {
    const excelRow = sheet.getRow(legendStartRow + 1 + index);
    const swatchCell = excelRow.getCell(1);
    swatchCell.value = null;
    swatchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(item.color) } };
    swatchCell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };

    const labelCell = excelRow.getCell(2);
    labelCell.value = item.label;
    labelCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
    excelRow.height = 18;
  });

  const totalRow = legendStartRow + 1 + EFFECTIVENESS_LEGEND.length + 1;
  sheet.mergeCells(totalRow, 1, totalRow, headers.length);
  const totalCell = sheet.getCell(totalRow, 1);
  totalCell.value = `Итого: ${formatEffectivenessChecksCount(rows.length)}`;
  totalCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
  sheet.getRow(totalRow).height = 18;
}

function writeMaterialityMatrixSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  chart: DashboardChartCapture,
  rows: MaterialityMatrixRow[],
) {
  const sheet = workbook.addWorksheet(sheetName, {
    properties: { tabColor: { argb: 'FFBE123C' } },
    views: [{ showGridLines: false }],
  });

  const headers = [
    'Ключ',
    'Краткое название проверки',
    ...MATERIALITY_MATRIX_COLUMNS.map((column) => column.label),
    MATERIALITY_MATRIX_TOTAL_COLUMN.label,
  ];
  const keyColumnWidth = 18;
  const shortNameColumnWidth = 72;
  sheet.columns = [
    { width: keyColumnWidth },
    { width: shortNameColumnWidth },
    ...MATERIALITY_MATRIX_COLUMNS.map(() => ({ width: 14 })),
    { width: 22 },
  ];

  sheet.mergeCells(1, 1, 1, headers.length);
  sheet.getCell(1, 1).value = chart.title;
  sheet.getCell(1, 1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF003366' } };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, headers.length);
  sheet.getCell(2, 1).value = chart.description || 'Матрица существенности (все строки выборки)';
  sheet.getCell(2, 1).font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
  sheet.getRow(2).height = 18;

  const headerRow = sheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE123C' } };
    cell.alignment = { horizontal: index < 2 ? 'left' : 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
  headerRow.height = 22;

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(5 + rowIndex);
    const keyCell = excelRow.getCell(1);
    keyCell.value = row.key;
    keyCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
    keyCell.alignment = { horizontal: 'left', vertical: 'middle' };

    const shortNameCell = excelRow.getCell(2);
    const shortNameValue = row.shortName || '—';
    shortNameCell.value = shortNameValue;
    shortNameCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
    shortNameCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    const usableWidth = Math.max(Math.floor(shortNameColumnWidth * 0.75), 8);
    const wrappedLineCount = shortNameValue
      .toString()
      .split(/\r?\n/)
      .reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / usableWidth)), 0);

    MATERIALITY_MATRIX_COLUMNS.forEach((column, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 3);
      const count = getMaterialityMatrixCount(row, column.key);
      const color = getMaterialityChartColor(column.level);
      cell.value = count;
      cell.font = {
        name: 'Calibri',
        size: 11,
        bold: true,
        color: { argb: 'FF1E293B' },
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(color) } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      };
    });

    const totalCell = excelRow.getCell(MATERIALITY_MATRIX_COLUMNS.length + 3);
    totalCell.value = row.total;
    totalCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
    totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totalCell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };

    [1, 2].forEach((columnIndex) => {
      const cell = excelRow.getCell(columnIndex);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    excelRow.height = Math.min(72, Math.max(18, 18 * wrappedLineCount + 2));
  });

  const totals = buildMaterialityMatrixColumnTotals(rows);
  const grandTotal = materialityMatrixGrandTotal(rows);
  const shareStartRow = 5 + rows.length + 2;
  sheet.mergeCells(shareStartRow, 1, shareStartRow, headers.length);
  const shareTitleCell = sheet.getCell(shareStartRow, 1);
  shareTitleCell.value = 'Доля рекомендаций';
  shareTitleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF003366' } };
  sheet.getRow(shareStartRow).height = 20;

  const shareHeaderRow = sheet.getRow(shareStartRow + 1);
  ['Уровень', 'Доля рекомендаций'].forEach((header, index) => {
    const cell = shareHeaderRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
  shareHeaderRow.height = 22;

  MATERIALITY_MATRIX_COLUMNS.forEach((column, index) => {
    const excelRow = sheet.getRow(shareStartRow + 2 + index);
    const count = totals[column.key];
    const percent = grandTotal === 0 ? 0 : Math.round((count / grandTotal) * 100);
    const areaCell = excelRow.getCell(1);
    areaCell.value = column.label;
    areaCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    const shareCell = excelRow.getCell(2);
    shareCell.value = `${percent}% (${count})`;
    shareCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    [1, 2].forEach((columnIndex) => {
      const cell = excelRow.getCell(columnIndex);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    excelRow.height = 22;
  });

  const legendStartRow = shareStartRow + 2 + MATERIALITY_MATRIX_COLUMNS.length + 2;
  sheet.mergeCells(legendStartRow, 1, legendStartRow, headers.length);
  const legendTitleCell = sheet.getCell(legendStartRow, 1);
  legendTitleCell.value = 'Легенда';
  legendTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF003366' } };

  MATERIALITY_MATRIX_LEGEND.forEach((item, index) => {
    const excelRow = sheet.getRow(legendStartRow + 1 + index);
    const swatchCell = excelRow.getCell(1);
    swatchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(item.color) } };
    swatchCell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
    const labelCell = excelRow.getCell(2);
    labelCell.value = item.label;
    labelCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    excelRow.height = 18;
  });

  const totalRow = legendStartRow + 1 + MATERIALITY_MATRIX_LEGEND.length + 1;
  sheet.mergeCells(totalRow, 1, totalRow, headers.length);
  sheet.getCell(totalRow, 1).value = `Итого: ${formatMaterialityChecksCount(rows.length)}`;
  sheet.getCell(totalRow, 1).font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
}

function writeStatusMatrixSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  chart: DashboardChartCapture,
  rows: StatusMatrixRow[],
) {
  const sheet = workbook.addWorksheet(sheetName, {
    properties: { tabColor: { argb: 'FF0891B2' } },
    views: [{ showGridLines: false }],
  });

  const headers = [
    'Ключ проверки',
    'Краткое название проверки',
    ...STATUS_MATRIX_COLUMNS.map((column) => column.label),
  ];
  const keyColumnWidth = 18;
  const shortNameColumnWidth = 72;
  sheet.columns = [
    { width: keyColumnWidth },
    { width: shortNameColumnWidth },
    ...STATUS_MATRIX_COLUMNS.map(() => ({ width: 16 })),
  ];

  sheet.mergeCells(1, 1, 1, headers.length);
  sheet.getCell(1, 1).value = chart.title;
  sheet.getCell(1, 1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF003366' } };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, headers.length);
  sheet.getCell(2, 1).value = chart.description || 'Матрица статусов по проверкам за период (все строки выборки)';
  sheet.getCell(2, 1).font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
  sheet.getRow(2).height = 18;

  const headerRow = sheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0891B2' } };
    cell.alignment = { horizontal: index < 2 ? 'left' : 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
  headerRow.height = 22;

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(5 + rowIndex);
    const keyCell = excelRow.getCell(1);
    keyCell.value = row.key;
    keyCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
    keyCell.alignment = { horizontal: 'left', vertical: 'middle' };

    const shortNameCell = excelRow.getCell(2);
    const shortNameValue = row.shortName || '—';
    shortNameCell.value = shortNameValue;
    shortNameCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
    shortNameCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    const usableWidth = Math.max(Math.floor(shortNameColumnWidth * 0.75), 8);
    const wrappedLineCount = shortNameValue
      .toString()
      .split(/\r?\n/)
      .reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / usableWidth)), 0);

    STATUS_MATRIX_COLUMNS.forEach((column, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 3);
      cell.value = getStatusMatrixCount(row, column.key);
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });

    [1, 2].forEach((columnIndex) => {
      const cell = excelRow.getCell(columnIndex);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    excelRow.height = Math.min(72, Math.max(18, 18 * wrappedLineCount + 2));
  });

  const shares = buildStatusMatrixColumnShares(rows);
  const shareStartRow = 5 + rows.length + 2;
  sheet.mergeCells(shareStartRow, 1, shareStartRow, headers.length);
  const shareTitleCell = sheet.getCell(shareStartRow, 1);
  shareTitleCell.value = 'Доля рекомендаций';
  shareTitleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF003366' } };
  sheet.getRow(shareStartRow).height = 20;

  const shareHeaderRow = sheet.getRow(shareStartRow + 1);
  ['Статус', 'Доля рекомендаций'].forEach((header, index) => {
    const cell = shareHeaderRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
  shareHeaderRow.height = 22;

  shares.forEach((share, index) => {
    const excelRow = sheet.getRow(shareStartRow + 2 + index);
    const areaCell = excelRow.getCell(1);
    areaCell.value = share.label;
    areaCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    const shareCell = excelRow.getCell(2);
    shareCell.value = `${share.percent}% (${share.count})`;
    shareCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    [1, 2].forEach((columnIndex) => {
      const cell = excelRow.getCell(columnIndex);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    excelRow.height = 22;
  });

  const legendStartRow = shareStartRow + 2 + STATUS_MATRIX_COLUMNS.length + 2;
  sheet.mergeCells(legendStartRow, 1, legendStartRow, headers.length);
  const legendTitleCell = sheet.getCell(legendStartRow, 1);
  legendTitleCell.value = 'Легенда';
  legendTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF003366' } };

  STATUS_MATRIX_LEGEND.forEach((item, index) => {
    const excelRow = sheet.getRow(legendStartRow + 1 + index);
    const swatchCell = excelRow.getCell(1);
    swatchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(item.color) } };
    swatchCell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
    const labelCell = excelRow.getCell(2);
    labelCell.value = item.label;
    labelCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    excelRow.height = 18;
  });

  const totalRow = legendStartRow + 1 + STATUS_MATRIX_LEGEND.length + 1;
  sheet.mergeCells(totalRow, 1, totalRow, headers.length);
  sheet.getCell(totalRow, 1).value = `Итого: ${formatStatusChecksCount(rows.length)}`;
  sheet.getCell(totalRow, 1).font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
}

async function buildVisualXlsx(options: {
  documentTitle: string;
  meta: VisualExportMetaRow[];
  charts: DashboardChartCapture[];
  kind: VisualAnalyticsKind;
  filenamePrefix: string;
  effectivenessMatrix?: EffectivenessMatrixRow[];
  materialityMatrix?: MaterialityMatrixRow[];
  statusMatrix?: StatusMatrixRow[];
}) {
  const { documentTitle, meta, charts, kind, filenamePrefix, effectivenessMatrix, materialityMatrix, statusMatrix } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SOKOL';
  workbook.created = new Date();

  const cover = workbook.addWorksheet('Обложка', {
    properties: { tabColor: { argb: 'FF003366' } },
    views: [{ showGridLines: false }],
  });
  cover.columns = [{ width: 28 }, { width: 56 }];
  cover.mergeCells('A1:B1');
  cover.getCell('A1').value = documentTitle;
  cover.getCell('A1').font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF003366' } };
  cover.getCell('A2').value =
    'Выбранные дашборды экспортированы как изображения; матрицы — полными таблицами';
  cover.getCell('A2').font = { name: 'Calibri', size: 11, color: { argb: 'FF64748B' } };
  cover.mergeCells('A2:B2');

  meta.forEach(([label, value], index) => {
    const row = index + 4;
    cover.getCell(`A${row}`).value = label;
    cover.getCell(`A${row}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF003366' } };
    cover.getCell(`B${row}`).value = value;
    cover.getCell(`B${row}`).font = { name: 'Calibri', size: 11, color: { argb: 'FF334155' } };
  });

  const usedNames = new Set<string>(['Обложка']);
  let writtenSheets = 0;
  let wroteEffectivenessMatrix = false;
  let wroteMaterialityMatrix = false;
  let wroteStatusMatrix = false;

  const writeMatrixIfNeeded = (chart?: DashboardChartCapture) => {
    if (!effectivenessMatrix?.length || wroteEffectivenessMatrix) {
      return;
    }
    let sheetName = sheetNameForSection(kind, 'effectivenessMatrix', chart?.title || 'Оценка эффективности');
    if (usedNames.has(sheetName)) {
      sheetName = `${sheetName.slice(0, 28)}_matrix`;
    }
    usedNames.add(sheetName);
    writeEffectivenessMatrixSheet(
      workbook,
      sheetName,
      chart ?? {
        id: 'effectivenessMatrix',
        title: 'Оценка эффективности',
        description: 'Матрица оценок по проверкам за период (все строки выборки)',
        dataUrl: '',
        width: 960,
        height: 540,
      },
      effectivenessMatrix,
    );
    wroteEffectivenessMatrix = true;
    writtenSheets += 1;
  };

  const writeMaterialityMatrixIfNeeded = (chart?: DashboardChartCapture) => {
    if (!materialityMatrix?.length || wroteMaterialityMatrix) {
      return;
    }
    let sheetName = sheetNameForSection(kind, 'materialityMatrix', chart?.title || 'Матрица существенности');
    if (usedNames.has(sheetName)) {
      sheetName = `${sheetName.slice(0, 28)}_matrix`;
    }
    usedNames.add(sheetName);
    writeMaterialityMatrixSheet(
      workbook,
      sheetName,
      chart ?? {
        id: 'materialityMatrix',
        title: 'Матрица существенности',
        description: 'Матрица существенности (все строки выборки)',
        dataUrl: '',
        width: 960,
        height: 540,
      },
      materialityMatrix,
    );
    wroteMaterialityMatrix = true;
    writtenSheets += 1;
  };

  const writeStatusMatrixIfNeeded = (chart?: DashboardChartCapture) => {
    if (!statusMatrix?.length || wroteStatusMatrix) {
      return;
    }
    let sheetName = sheetNameForSection(kind, 'statusMatrix', chart?.title || 'Матрица статусов');
    if (usedNames.has(sheetName)) {
      sheetName = `${sheetName.slice(0, 28)}_matrix`;
    }
    usedNames.add(sheetName);
    writeStatusMatrixSheet(
      workbook,
      sheetName,
      chart ?? {
        id: 'statusMatrix',
        title: 'Матрица статусов',
        description: 'Матрица статусов по проверкам за период (все строки выборки)',
        dataUrl: '',
        width: 960,
        height: 540,
      },
      statusMatrix,
    );
    wroteStatusMatrix = true;
    writtenSheets += 1;
  };

  for (const [index, chart] of charts.entries()) {
    if (chart.id === 'effectivenessMatrix') {
      writeMatrixIfNeeded(chart);
      continue;
    }
    if (chart.id === 'materialityMatrix') {
      writeMaterialityMatrixIfNeeded(chart);
      continue;
    }
    if (chart.id === 'statusMatrix') {
      writeStatusMatrixIfNeeded(chart);
      continue;
    }

    let sheetName = sheetNameForSection(kind, chart.id, chart.title);
    if (usedNames.has(sheetName)) {
      sheetName = `${sheetName.slice(0, 28)}_${index + 1}`;
    }
    usedNames.add(sheetName);

    const hasPng =
      chart.dataUrl.startsWith('data:image/png;base64,') && Boolean(chart.dataUrl.split(',')[1]);
    if (!hasPng) {
      continue;
    }

    const sheet = workbook.addWorksheet(sheetName, {
      properties: { tabColor: { argb: 'FF4F7FA8' } },
      views: [{ showGridLines: false }],
    });
    sheet.columns = [{ width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = chart.title;
    sheet.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF003366' } };
    sheet.getRow(1).height = 24;
    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').value = chart.description;
    sheet.getCell('A2').font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
    sheet.getRow(2).height = 18;

    const imageId = workbook.addImage({
      // ExcelJS strips a data-URL prefix at the first comma; keep a full data URL.
      base64: chart.dataUrl.startsWith('data:')
        ? chart.dataUrl
        : `data:image/png;base64,${chart.dataUrl}`,
      extension: 'png',
    });

    const fitted = fitImageSize(chart.width * 2, chart.height * 2, 960, 520);
    sheet.addImage(imageId, {
      tl: { col: 0.15, row: 2.8 },
      ext: { width: fitted.width, height: fitted.height },
      editAs: 'oneCell',
    });
    sheet.getRow(20).height = Math.max(Math.round(fitted.height * 0.75), 120);
    writtenSheets += 1;
  }

  writeMatrixIfNeeded();
  writeMaterialityMatrixIfNeeded();
  writeStatusMatrixIfNeeded();

  if (writtenSheets === 0) {
    throw new Error('Не удалось сформировать листы дашбордов для Excel. Обновите страницу и попробуйте снова.');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${stamp()}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function toDocxHexColor(hex: string) {
  return hex.replace(/^#/, '').toUpperCase();
}

function createEffectivenessMatrixDocxTable(rows: EffectivenessMatrixRow[]): Table {
  const cellMargin = 70;
  const headerFill = '003366';
  const headerTextColor = 'FFFFFF';
  const bodyTextColor = '334155';

  // Key + short name + 4 effectiveness tones
  const columnWidths = [16, 26, 15, 14, 14, 14];

  const headerRow = new TableRow({
    children: [
      ...['Ключ', 'Краткое название проверки', ...EFFECTIVENESS_MATRIX_COLUMNS.map((c) => c.label)].map(
        (text, index) => {
          const width = columnWidths[index] ?? 14;
          return new TableCell({
            width: { size: width, type: WidthType.PERCENTAGE },
            margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
            shading: { type: ShadingType.CLEAR, fill: headerFill, color: 'auto' },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text, bold: true, color: headerTextColor, size: 20 })],
              }),
            ],
          });
        },
      ),
    ],
  });

  const bodyRows = rows.map((row) => {
    const keyCell = new TableCell({
      width: { size: columnWidths[0], type: WidthType.PERCENTAGE },
      margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: row.key, bold: true, color: bodyTextColor, size: 20 })],
        }),
      ],
    });

    const shortNameCell = new TableCell({
      width: { size: columnWidths[1], type: WidthType.PERCENTAGE },
      margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: row.shortName || row.name || '—',
              color: bodyTextColor,
              size: 20,
            }),
          ],
        }),
      ],
    });

    const toneCells = EFFECTIVENESS_MATRIX_COLUMNS.map((column, index) => {
      const tone = row.tones[column.key];
      const fill = toDocxHexColor(getEffectivenessToneColor(tone));
      const width = columnWidths[index + 2] ?? 14;

      return new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
        shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: ' ', size: 20 })],
          }),
        ],
      });
    });

    return new TableRow({ children: [keyCell, shortNameCell, ...toneCells] });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: DOCX_FRAME_BORDER,
      bottom: DOCX_FRAME_BORDER,
      left: DOCX_FRAME_BORDER,
      right: DOCX_FRAME_BORDER,
      insideHorizontal: DOCX_FRAME_BORDER,
      insideVertical: DOCX_FRAME_BORDER,
    },
    rows: [headerRow, ...bodyRows],
  });
}

function createEffectivenessShareDocxTable(rows: EffectivenessMatrixRow[]): Table {
  const cellMargin = 70;
  const headerFill = '003366';
  const headerTextColor = 'FFFFFF';
  const bodyTextColor = '334155';

  const headerRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 24, type: WidthType.PERCENTAGE },
        margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
        shading: { type: ShadingType.CLEAR, fill: headerFill, color: 'auto' },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: 'Раздел', bold: true, color: headerTextColor, size: 20 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 76, type: WidthType.PERCENTAGE },
        margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
        shading: { type: ShadingType.CLEAR, fill: headerFill, color: 'auto' },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: 'Доля оценок', bold: true, color: headerTextColor, size: 20 })],
          }),
        ],
      }),
    ],
  });

  const bodyRows = EFFECTIVENESS_MATRIX_COLUMNS.map((column) => {
    const shares = buildEffectivenessColumnShares(rows, column.key);
    const text =
      shares.map((share) => `${share.label}: ${share.percent}% (${share.count})`).join('; ') || '—';

    return new TableRow({
      children: [
        new TableCell({
          width: { size: 24, type: WidthType.PERCENTAGE },
          margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: column.label, bold: true, color: bodyTextColor, size: 20 })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 76, type: WidthType.PERCENTAGE },
          margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text, color: bodyTextColor, size: 18 })],
            }),
          ],
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: DOCX_FRAME_BORDER,
      bottom: DOCX_FRAME_BORDER,
      left: DOCX_FRAME_BORDER,
      right: DOCX_FRAME_BORDER,
      insideHorizontal: DOCX_FRAME_BORDER,
      insideVertical: DOCX_FRAME_BORDER,
    },
    rows: [headerRow, ...bodyRows],
  });
}

function createEffectivenessLegendDocxTable(): Table {
  const cellMargin = 70;

  const legendRows = EFFECTIVENESS_LEGEND.map((item) => {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
          shading: { type: ShadingType.CLEAR, fill: toDocxHexColor(item.color), color: 'auto' },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: ' ', size: 18 })] })],
        }),
        new TableCell({
          width: { size: 92, type: WidthType.PERCENTAGE },
          margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: item.label, color: '334155', size: 18 })],
            }),
          ],
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: legendRows,
  });
}

function createColorLegendDocxTable(items: Array<{ label: string; color: string }>): Table {
  const cellMargin = 70;
  const legendRows = items.map((item) => {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
          shading: { type: ShadingType.CLEAR, fill: toDocxHexColor(item.color), color: 'auto' },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: ' ', size: 18 })] })],
        }),
        new TableCell({
          width: { size: 92, type: WidthType.PERCENTAGE },
          margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: item.label, color: '334155', size: 18 })],
            }),
          ],
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: legendRows,
  });
}

function createShareDocxTable(labelHeader: string, valueHeader: string, rows: Array<{ label: string; text: string }>): Table {
  const cellMargin = 70;
  const headerFill = '003366';
  const headerTextColor = 'FFFFFF';
  const bodyTextColor = '334155';

  const headerRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 24, type: WidthType.PERCENTAGE },
        margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
        shading: { type: ShadingType.CLEAR, fill: headerFill, color: 'auto' },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: labelHeader, bold: true, color: headerTextColor, size: 20 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 76, type: WidthType.PERCENTAGE },
        margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
        shading: { type: ShadingType.CLEAR, fill: headerFill, color: 'auto' },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: valueHeader, bold: true, color: headerTextColor, size: 20 })],
          }),
        ],
      }),
    ],
  });

  const bodyRows = rows.map((row) => new TableRow({
    children: [
      new TableCell({
        width: { size: 24, type: WidthType.PERCENTAGE },
        margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: row.label, bold: true, color: bodyTextColor, size: 20 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 76, type: WidthType.PERCENTAGE },
        margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: row.text, color: bodyTextColor, size: 18 })],
          }),
        ],
      }),
    ],
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: DOCX_FRAME_BORDER,
      bottom: DOCX_FRAME_BORDER,
      left: DOCX_FRAME_BORDER,
      right: DOCX_FRAME_BORDER,
      insideHorizontal: DOCX_FRAME_BORDER,
      insideVertical: DOCX_FRAME_BORDER,
    },
    rows: [headerRow, ...bodyRows],
  });
}

function createMaterialityMatrixDocxTable(rows: MaterialityMatrixRow[]): Table {
  const cellMargin = 70;
  const headerFill = '003366';
  const headerTextColor = 'FFFFFF';
  const bodyTextColor = '334155';
  const columnWidths = [16, 30, 13, 13, 13, 15];
  const headers = [
    'Ключ',
    'Краткое название проверки',
    ...MATERIALITY_MATRIX_COLUMNS.map((column) => column.label),
    MATERIALITY_MATRIX_TOTAL_COLUMN.label,
  ];

  const headerRow = new TableRow({
    children: headers.map((text, index) => {
      const width = columnWidths[index] ?? 14;
      return new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
        shading: { type: ShadingType.CLEAR, fill: headerFill, color: 'auto' },
        children: [
          new Paragraph({
            alignment: index < 2 ? AlignmentType.LEFT : AlignmentType.CENTER,
            children: [new TextRun({ text, bold: true, color: headerTextColor, size: 20 })],
          }),
        ],
      });
    }),
  });

  const bodyRows = rows.map((row) => {
    const keyCell = new TableCell({
      width: { size: columnWidths[0], type: WidthType.PERCENTAGE },
      margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: row.key, bold: true, color: bodyTextColor, size: 20 })],
        }),
      ],
    });

    const shortNameCell = new TableCell({
      width: { size: columnWidths[1], type: WidthType.PERCENTAGE },
      margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: row.shortName || row.name || '—',
              color: bodyTextColor,
              size: 20,
            }),
          ],
        }),
      ],
    });

    const countCells = MATERIALITY_MATRIX_COLUMNS.map((column, index) => {
      const count = getMaterialityMatrixCount(row, column.key);
      const fill = toDocxHexColor(getMaterialityChartColor(column.level));
      const width = columnWidths[index + 2] ?? 13;
      return new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
        shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: String(count), bold: true, color: '1E293B', size: 20 })],
          }),
        ],
      });
    });

    const totalCell = new TableCell({
      width: { size: columnWidths[5], type: WidthType.PERCENTAGE },
      margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: String(row.total), bold: true, color: '1E293B', size: 20 })],
        }),
      ],
    });

    return new TableRow({ children: [keyCell, shortNameCell, ...countCells, totalCell] });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: DOCX_FRAME_BORDER,
      bottom: DOCX_FRAME_BORDER,
      left: DOCX_FRAME_BORDER,
      right: DOCX_FRAME_BORDER,
      insideHorizontal: DOCX_FRAME_BORDER,
      insideVertical: DOCX_FRAME_BORDER,
    },
    rows: [headerRow, ...bodyRows],
  });
}

function createStatusMatrixDocxTable(rows: StatusMatrixRow[]): Table {
  const cellMargin = 70;
  const headerFill = '003366';
  const headerTextColor = 'FFFFFF';
  const bodyTextColor = '334155';
  const columnWidths = [16, 32, 13, 13, 13, 13];
  const headers = [
    'Ключ проверки',
    'Краткое название проверки',
    ...STATUS_MATRIX_COLUMNS.map((column) => column.label),
  ];

  const headerRow = new TableRow({
    children: headers.map((text, index) => {
      const width = columnWidths[index] ?? 13;
      return new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
        shading: { type: ShadingType.CLEAR, fill: headerFill, color: 'auto' },
        children: [
          new Paragraph({
            alignment: index < 2 ? AlignmentType.LEFT : AlignmentType.CENTER,
            children: [new TextRun({ text, bold: true, color: headerTextColor, size: 20 })],
          }),
        ],
      });
    }),
  });

  const bodyRows = rows.map((row) => {
    const keyCell = new TableCell({
      width: { size: columnWidths[0], type: WidthType.PERCENTAGE },
      margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: row.key, bold: true, color: bodyTextColor, size: 20 })],
        }),
      ],
    });

    const shortNameCell = new TableCell({
      width: { size: columnWidths[1], type: WidthType.PERCENTAGE },
      margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: row.shortName || row.name || '—',
              color: bodyTextColor,
              size: 20,
            }),
          ],
        }),
      ],
    });

    const countCells = STATUS_MATRIX_COLUMNS.map((column, index) => {
      const width = columnWidths[index + 2] ?? 13;
      return new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: String(getStatusMatrixCount(row, column.key)),
                bold: true,
                color: '1E293B',
                size: 20,
              }),
            ],
          }),
        ],
      });
    });

    return new TableRow({ children: [keyCell, shortNameCell, ...countCells] });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: DOCX_FRAME_BORDER,
      bottom: DOCX_FRAME_BORDER,
      left: DOCX_FRAME_BORDER,
      right: DOCX_FRAME_BORDER,
      insideHorizontal: DOCX_FRAME_BORDER,
      insideVertical: DOCX_FRAME_BORDER,
    },
    rows: [headerRow, ...bodyRows],
  });
}

const CHECK_LIFECYCLE_DOCX_LEGEND = [
  { label: CHECK_LIFECYCLE_SEGMENTS[0].label, color: VALUE_BLUE_SCALE[0] },
  { label: CHECK_LIFECYCLE_SEGMENTS[1].label, color: VALUE_TEAL_SCALE[5] },
  { label: CHECK_LIFECYCLE_SEGMENTS[2].label, color: VALUE_BLUE_SCALE[5] },
];

function createCheckLifecycleDocxTable(rows: DvaCheckLifecycleRow[]): Table {
  const cellMargin = 60;
  const headerFill = '003366';
  const headerTextColor = 'FFFFFF';
  const bodyTextColor = '334155';
  const exportRows = buildCheckLifecycleExportRows(rows);
  const columnWidths = [10, 18, 12, 9, 9, 9, 9, 16, 8];
  const headers = [
    'Ключ',
    'Краткое название',
    'Аудитор',
    'Приказ',
    'Программа',
    'АЗ',
    'ДЗ',
    'Этапы',
    'Итого',
  ];

  const headerRow = new TableRow({
    children: headers.map((text, index) => {
      const width = columnWidths[index] ?? 10;
      return new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
        shading: { type: ShadingType.CLEAR, fill: headerFill, color: 'auto' },
        children: [
          new Paragraph({
            alignment: index <= 2 || index === 7 ? AlignmentType.LEFT : AlignmentType.CENTER,
            children: [new TextRun({ text, bold: true, color: headerTextColor, size: 16 })],
          }),
        ],
      });
    }),
  });

  const bodyRows = exportRows.map((row) => {
    const values = [
      row.key,
      row.shortName,
      row.auditor,
      row.orderDate,
      row.programDate,
      row.azDate,
      row.dzDate,
      row.stages,
      row.totalDays,
    ];
    return new TableRow({
      children: values.map((text, index) => {
        const width = columnWidths[index] ?? 10;
        const isKey = index === 0;
        const isTotal = index === values.length - 1;
        return new TableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          margins: { top: cellMargin, bottom: cellMargin, left: cellMargin / 2, right: cellMargin / 2 },
          children: [
            new Paragraph({
              alignment: index <= 2 || index === 7 ? AlignmentType.LEFT : AlignmentType.CENTER,
              children: [
                new TextRun({
                  text,
                  bold: isKey || isTotal,
                  color: isTotal ? '1E293B' : bodyTextColor,
                  size: 16,
                }),
              ],
            }),
          ],
        });
      }),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: DOCX_FRAME_BORDER,
      bottom: DOCX_FRAME_BORDER,
      left: DOCX_FRAME_BORDER,
      right: DOCX_FRAME_BORDER,
      insideHorizontal: DOCX_FRAME_BORDER,
      insideVertical: DOCX_FRAME_BORDER,
    },
    rows: [headerRow, ...bodyRows],
  });
}

function materialityShareDocxRows(rows: MaterialityMatrixRow[]) {
  const totals = buildMaterialityMatrixColumnTotals(rows);
  const grandTotal = materialityMatrixGrandTotal(rows);
  return MATERIALITY_MATRIX_COLUMNS.map((column) => {
    const count = totals[column.key];
    const percent = grandTotal === 0 ? 0 : Math.round((count / grandTotal) * 100);
    return { label: column.label, text: `${percent}% (${count})` };
  });
}

async function buildVisualDocx(options: {
  documentTitle: string;
  meta: VisualExportMetaRow[];
  charts: DashboardChartCapture[];
  filenamePrefix: string;
  effectivenessMatrix?: EffectivenessMatrixRow[];
  materialityMatrix?: MaterialityMatrixRow[];
  statusMatrix?: StatusMatrixRow[];
  checkLifecycle?: DvaCheckLifecycleRow[];
}) {
  const {
    documentTitle,
    meta,
    charts,
    filenamePrefix,
    effectivenessMatrix,
    materialityMatrix,
    statusMatrix,
    checkLifecycle,
  } = options;
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: meta.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 32, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: label, bold: true, color: '003366' })],
                }),
              ],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(value)] })],
            }),
          ],
        }),
    ),
  });

  const chartSections = charts.map((chart) => {
    const canRenderEffectivenessMatrix =
      chart.id === 'effectivenessMatrix' && Boolean(effectivenessMatrix?.length);
    if (canRenderEffectivenessMatrix) {
      const baseDescription = chart.description || 'Матрица оценок по проверкам за период';
      const fullDescription = baseDescription.includes('(все строки выборки)')
        ? baseDescription
        : `${baseDescription} (все строки выборки)`;

      return {
        properties: {
          page: DOCX_LANDSCAPE_PAGE,
        },
        children: [
          new Paragraph({
            text: chart.title,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: fullDescription, color: '64748B', size: 20 })],
            spacing: { after: 40 },
          }),
          createEffectivenessMatrixDocxTable(effectivenessMatrix!),
          new Paragraph({
            children: [new TextRun({ text: 'Доля оценок', bold: true, color: '003366', size: 22 })],
            spacing: { after: 20 },
          }),
          createEffectivenessShareDocxTable(effectivenessMatrix!),
          new Paragraph({
            children: [
              new TextRun({
                text: `Итого: ${formatEffectivenessChecksCount(effectivenessMatrix!.length)}`,
                color: '64748B',
                size: 18,
              }),
            ],
            spacing: { after: 10 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Легенда', bold: true, color: '003366', size: 20 })],
            spacing: { after: 10 },
          }),
          createEffectivenessLegendDocxTable(),
        ],
      };
    }

    const canRenderMaterialityMatrix =
      chart.id === 'materialityMatrix' && Boolean(materialityMatrix?.length);
    if (canRenderMaterialityMatrix) {
      const baseDescription = chart.description || 'Матрица существенности';
      const fullDescription = baseDescription.includes('(все строки выборки)')
        ? baseDescription
        : `${baseDescription} (все строки выборки)`;

      return {
        properties: {
          page: DOCX_LANDSCAPE_PAGE,
        },
        children: [
          new Paragraph({
            text: chart.title,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: fullDescription, color: '64748B', size: 20 })],
            spacing: { after: 40 },
          }),
          createMaterialityMatrixDocxTable(materialityMatrix!),
          new Paragraph({
            children: [new TextRun({ text: 'Доля рекомендаций', bold: true, color: '003366', size: 22 })],
            spacing: { after: 20 },
          }),
          createShareDocxTable('Уровень', 'Доля рекомендаций', materialityShareDocxRows(materialityMatrix!)),
          new Paragraph({
            children: [
              new TextRun({
                text: `Итого: ${formatMaterialityChecksCount(materialityMatrix!.length)}`,
                color: '64748B',
                size: 18,
              }),
            ],
            spacing: { after: 10 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Легенда', bold: true, color: '003366', size: 20 })],
            spacing: { after: 10 },
          }),
          createColorLegendDocxTable(MATERIALITY_MATRIX_LEGEND),
        ],
      };
    }

    const canRenderStatusMatrix = chart.id === 'statusMatrix' && Boolean(statusMatrix?.length);
    if (canRenderStatusMatrix) {
      const baseDescription = chart.description || 'Матрица статусов по проверкам за период';
      const fullDescription = baseDescription.includes('(все строки выборки)')
        ? baseDescription
        : `${baseDescription} (все строки выборки)`;
      const shares = buildStatusMatrixColumnShares(statusMatrix!);

      return {
        properties: {
          page: DOCX_LANDSCAPE_PAGE,
        },
        children: [
          new Paragraph({
            text: chart.title,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: fullDescription, color: '64748B', size: 20 })],
            spacing: { after: 40 },
          }),
          createStatusMatrixDocxTable(statusMatrix!),
          new Paragraph({
            children: [new TextRun({ text: 'Доля рекомендаций', bold: true, color: '003366', size: 22 })],
            spacing: { after: 20 },
          }),
          createShareDocxTable(
            'Статус',
            'Доля рекомендаций',
            shares.map((share) => ({ label: share.label, text: `${share.percent}% (${share.count})` })),
          ),
          new Paragraph({
            children: [
              new TextRun({
                text: `Итого: ${formatStatusChecksCount(statusMatrix!.length)}`,
                color: '64748B',
                size: 18,
              }),
            ],
            spacing: { after: 10 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Легенда', bold: true, color: '003366', size: 20 })],
            spacing: { after: 10 },
          }),
          createColorLegendDocxTable(STATUS_MATRIX_LEGEND),
        ],
      };
    }

    const canRenderCheckLifecycle = chart.id === 'checkLifecycle' && Boolean(checkLifecycle?.length);
    if (canRenderCheckLifecycle) {
      const baseDescription = chart.description || 'Жизненный цикл проверки: от приказа до ДЗ';
      const fullDescription = baseDescription.includes('(все строки выборки)')
        ? baseDescription
        : `${baseDescription} (все строки выборки)`;

      return {
        properties: {
          page: DOCX_LANDSCAPE_PAGE,
        },
        children: [
          new Paragraph({
            text: chart.title || 'Жизненный цикл проверки: от приказа до ДЗ',
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: fullDescription, color: '64748B', size: 20 })],
            spacing: { after: 40 },
          }),
          createCheckLifecycleDocxTable(checkLifecycle!),
          new Paragraph({
            children: [
              new TextRun({
                text: `Итого: ${formatLifecycleChecksCount(checkLifecycle!.length)}`,
                color: '64748B',
                size: 18,
              }),
            ],
            spacing: { after: 10 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Легенда этапов', bold: true, color: '003366', size: 20 })],
            spacing: { after: 10 },
          }),
          createColorLegendDocxTable(CHECK_LIFECYCLE_DOCX_LEGEND),
        ],
      };
    }

    const fitted = fitImageSize(
      chart.width,
      chart.height,
      DOCX_CHART_MAX_WIDTH,
      DOCX_CHART_MAX_HEIGHT,
    );

    return {
      properties: {
        page: DOCX_LANDSCAPE_PAGE,
      },
      children: [
        new Paragraph({
          text: chart.title,
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [new TextRun({ text: chart.description, color: '64748B', size: 20 })],
          spacing: { after: 160 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: DOCX_FRAME_BORDER,
            bottom: DOCX_FRAME_BORDER,
            left: DOCX_FRAME_BORDER,
            right: DOCX_FRAME_BORDER,
            insideHorizontal: DOCX_FRAME_BORDER,
            insideVertical: DOCX_FRAME_BORDER,
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  margins: {
                    top: 120,
                    bottom: 120,
                    left: 120,
                    right: 120,
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new ImageRun({
                          data: dataUrlToUint8Array(chart.dataUrl),
                          transformation: fitted,
                          type: 'png',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    };
  });

  const doc = new Document({
    creator: 'SOKOL',
    title: documentTitle,
    sections: [
      {
        properties: {
          page: DOCX_LANDSCAPE_PAGE,
        },
        children: [
          new Paragraph({
            text: documentTitle,
            heading: HeadingLevel.TITLE,
            spacing: { after: 160 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Отчёт по выбранным дашбордам. Каждый график вынесен на отдельную страницу в крупном размере.',
                color: '64748B',
              }),
            ],
            spacing: { after: 240 },
          }),
          metaTable,
        ],
      },
      ...chartSections,
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${stamp()}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function orderChartsBySelection(
  charts: DashboardChartCapture[],
  selectedSections: string[],
): DashboardChartCapture[] {
  const order = new Map(selectedSections.map((id, index) => [id, index]));
  return [...charts].sort((left, right) => (order.get(left.id) ?? 999) - (order.get(right.id) ?? 999));
}

function matrixChartPlaceholder(
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

function ensureMatrixCharts(
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

function resolveHtmlChartBody(chart: DashboardChartCapture, index: number): string {
  const prefersHtml =
    chart.id === 'effectivenessMatrix'
    || chart.id === 'materialityMatrix'
    || chart.id === 'statusMatrix'
    || chart.htmlMarkup?.includes('class="chart-html"')
    || chart.htmlMarkup?.includes('class="kpi-strip"');
  if (prefersHtml && chart.htmlMarkup) {
    return chart.htmlMarkup;
  }
  if (isUsefulSvgMarkup(chart.svgMarkup)) {
    const namespacedSvg = namespaceSvgMarkupForEmbed(chart.svgMarkup, `chart-${index}-${chart.id}`);
    return `<div class="chart-svg" data-chart-index="${index}">${namespacedSvg}</div>`;
  }
  if (chart.htmlMarkup) {
    return chart.htmlMarkup;
  }
  if (chartHasPngPayload(chart.dataUrl)) {
    return `<img class="chart-img" src="${chart.dataUrl}" alt="${escapeHtml(chart.title)}" width="${chart.width}" height="${chart.height}" />`;
  }
  return '<p class="chart-empty" style="margin:0;padding:18px 0;text-align:center;color:#64748b;font-size:0.9rem">Не удалось отобразить график</p>';
}

async function buildVisualHtml(options: {
  documentTitle: string;
  meta: VisualExportMetaRow[];
  charts: DashboardChartCapture[];
  filenamePrefix: string;
}) {
  const { documentTitle, meta, charts, filenamePrefix } = options;
  const metaRows = meta
    .map(
      ([label, value]) => `
        <tr>
          <th>${escapeHtml(label)}</th>
          <td>${escapeHtml(value)}</td>
        </tr>`,
    )
    .join('');

  const chartSections = charts
    .map((chart, index) => {
      const chartBody = resolveHtmlChartBody(chart, index);
      return `
      <section class="card" id="chart-${escapeHtml(chart.id)}">
        <header>
          <h2>${escapeHtml(chart.title)}</h2>
          <p>${escapeHtml(chart.description)}</p>
        </header>
        <div class="chart-frame">
          ${chartBody}
        </div>
      </section>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    :root {
      --ink: #1a2332;
      --muted: #5b6b7c;
      --brand: #003366;
      --brand-soft: #e8eef4;
      --line: #d7dee7;
      --bg: #f3f5f7;
      --card: #ffffff;
      --accent: #4f7fa8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--ink);
      background-color: var(--bg);
      background-image:
        linear-gradient(180deg, #e9eef3 0%, var(--bg) 180px);
      line-height: 1.5;
    }
    .page {
      width: min(880px, calc(100% - 32px));
      margin: 24px auto 48px;
    }
    .hero {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      border-top: 3px solid var(--brand);
      padding: 22px 24px 18px;
      margin-bottom: 14px;
    }
    .hero .brand {
      margin: 0 0 10px;
      color: var(--brand);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .hero h1 {
      margin: 0;
      color: var(--brand);
      font-size: 1.65rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .meta {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 11px 16px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
      font-size: 0.92rem;
    }
    th {
      width: 30%;
      color: var(--brand);
      background: var(--brand-soft);
      font-weight: 650;
    }
    tr:last-child th, tr:last-child td { border-bottom: 0; }
    .toc {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 18px;
    }
    .toc a {
      text-decoration: none;
      color: var(--brand);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 11px;
      font-size: 0.82rem;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .toc a:hover {
      border-color: var(--accent);
      background: var(--brand-soft);
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px 16px 12px;
      margin-bottom: 12px;
    }
    .card header h2 {
      margin: 0 0 2px;
      color: var(--brand);
      font-size: 1.05rem;
      font-weight: 700;
    }
    .card header p {
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 0.84rem;
    }
    .chart-frame {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fafbfc;
      padding: 10px 12px;
      overflow: visible;
    }
    .chart-svg, .chart-img {
      display: block;
      margin: 0 auto;
    }
    .chart-svg {
      width: min(100%, 640px);
    }
    .chart-svg svg, .chart-img {
      display: block;
      width: 100%;
      max-width: 640px;
      height: auto;
      max-height: 300px;
      margin: 0 auto;
      object-fit: contain;
      background: #fff;
      border-radius: 6px;
    }
    .chart-svg svg {
      cursor: crosshair;
      overflow: visible;
    }
    .chart-svg svg text {
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }
    .chart-legend {
      margin-top: 8px;
      display: flex;
      justify-content: center;
    }
    .chart-legend:has(.chart-materiality-legend) {
      display: block;
      width: 100%;
      overflow: auto;
    }
    .chart-materiality-legend {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
      color: var(--ink);
    }
    .chart-materiality-legend caption {
      caption-side: top;
      text-align: left;
      font-weight: 600;
      color: var(--brand);
      margin-bottom: 6px;
    }
    .chart-materiality-legend th,
    .chart-materiality-legend td {
      border: 1px solid var(--line);
      padding: 5px 8px;
      text-align: left;
      background: #fff;
    }
    .chart-materiality-legend th:not(:first-child),
    .chart-materiality-legend td:not(:first-child) {
      text-align: center;
      white-space: nowrap;
    }
    .chart-svg:has(.chart-materiality-legend) {
      width: 100%;
    }
    .chart-svg:has(.chart-materiality-legend) svg {
      max-width: 960px;
      max-height: 360px;
    }
    .chart-legend-list {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px 16px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .chart-legend-list li {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-size: 0.8rem;
      line-height: 1.2;
    }
    .chart-legend-swatch {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      flex-shrink: 0;
      background: var(--accent);
    }
    .chart-html {
      overflow: auto;
      background: #fff;
      border-radius: 6px;
    }
    .chart-html table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }
    .chart-html th, .chart-html td {
      border: 1px solid var(--line);
      padding: 6px 8px;
      background: transparent;
      width: auto;
      font-weight: inherit;
    }
    .chart-html [data-export-html] {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .chart-html [data-effectiveness-matrix-footer] {
      background: #f8fafc;
    }
    .chart-html [data-effectiveness-matrix-footer] th,
    .chart-html [data-effectiveness-matrix-footer] td {
      border-top: 1px solid var(--line);
      vertical-align: top;
      background: #f8fafc;
    }
    .chart-html [data-effectiveness-matrix-footer] td {
      text-align: center;
    }
    .chart-html [data-effectiveness-matrix-legend] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      list-style: none;
      padding: 0;
      margin: 0;
      font-size: 0.78rem;
      color: var(--muted);
    }
    .chart-html [data-effectiveness-matrix-legend] li {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .chart-html svg.recharts-surface {
      display: block;
      margin: 0 auto;
    }
    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
    }
    .kpi-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 72px;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
    }
    .kpi-meta { min-width: 0; }
    .kpi-label {
      font-size: 0.86rem;
      line-height: 1.2;
      opacity: 0.82;
    }
    .kpi-hint {
      margin-top: 3px;
      font-size: 0.75rem;
      line-height: 1.2;
      opacity: 0.6;
    }
    .kpi-value {
      flex-shrink: 0;
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.02em;
    }
    .chart-svg svg .recharts-layer path,
    .chart-svg svg .recharts-layer rect,
    .chart-svg svg .recharts-sector,
    .chart-svg svg .recharts-rectangle {
      transition: opacity 0.15s ease, filter 0.15s ease;
    }
    .chart-svg.is-hovering svg .recharts-layer path,
    .chart-svg.is-hovering svg .recharts-layer rect,
    .chart-svg.is-hovering svg .recharts-sector,
    .chart-svg.is-hovering svg .recharts-rectangle {
      opacity: 0.35;
    }
    .chart-svg.is-hovering svg .recharts-layer path:hover,
    .chart-svg.is-hovering svg .recharts-layer rect:hover,
    .chart-svg.is-hovering svg .recharts-sector:hover,
    .chart-svg.is-hovering svg .recharts-rectangle:hover,
    .chart-svg svg [data-active="true"] {
      opacity: 1 !important;
      filter: brightness(1.05);
    }
    .tooltip {
      position: fixed;
      z-index: 20;
      pointer-events: none;
      display: none;
      min-width: 120px;
      max-width: 320px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(0, 51, 102, 0.94);
      color: #fff;
      font-size: 12px;
      white-space: pre-line;
      line-height: 1.35;
    }
    .footnote {
      margin-top: 10px;
      color: var(--muted);
      font-size: 0.82rem;
      text-align: center;
    }
    .to-top {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 30;
      width: 40px;
      height: 40px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card);
      color: var(--brand);
      box-shadow: 0 4px 14px rgba(26, 35, 50, 0.12);
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      transform: translateY(6px);
      transition: opacity 0.18s ease, visibility 0.18s ease, transform 0.18s ease, background 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      line-height: 1;
      padding: 0;
    }
    .to-top.is-visible {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    .to-top:hover {
      background: var(--brand-soft);
    }
    .to-top:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    @media print {
      body { background: #fff; }
      .page { width: 100%; margin: 0; }
      .toc, .to-top { display: none; }
      .card, .meta, .hero { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page" id="top">
    <section class="hero">
      <p class="brand">SOKOL</p>
      <h1>${escapeHtml(documentTitle)}</h1>
    </section>
    <section class="meta">
      <table>
        <tbody>${metaRows}</tbody>
      </table>
    </section>
    <nav class="toc">
      ${charts
        .map((chart) => `<a href="#chart-${escapeHtml(chart.id)}">${escapeHtml(chart.title)}</a>`)
        .join('')}
    </nav>
    ${chartSections}
    <p class="footnote">SOKOL: Сформировано ${escapeHtml(new Date().toLocaleString('ru-RU'))}</p>
  </div>
  <button type="button" class="to-top" id="to-top" aria-label="Наверх" title="Наверх">↑</button>
  <div class="tooltip" id="chart-tooltip"></div>
  <script>
    (function () {
      var toTop = document.getElementById('to-top');
      if (toTop) {
        var toggleToTop = function () {
          if (window.scrollY > 280) toTop.classList.add('is-visible');
          else toTop.classList.remove('is-visible');
        };
        window.addEventListener('scroll', toggleToTop, { passive: true });
        toggleToTop();
        toTop.addEventListener('click', function () {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
      var tooltip = document.getElementById('chart-tooltip');
      var fillTooltip = function (hit, fallbackLabel) {
        if (!tooltip) return;
        var high = hit.getAttribute('data-materiality-high');
        var medium = hit.getAttribute('data-materiality-medium');
        var low = hit.getAttribute('data-materiality-low');
        if (high === null && medium === null && low === null) {
          tooltip.textContent = fallbackLabel || 'Значение графика';
          return;
        }
        tooltip.replaceChildren();
        var name = (hit.getAttribute('data-name') || '').trim();
        var value = (hit.getAttribute('data-value') || '').trim();
        var headline = name && value
          ? name + ': ' + value
          : (fallbackLabel || '').split('\\n')[0] || 'Рекомендации';
        var titleEl = document.createElement('div');
        titleEl.style.fontWeight = '600';
        titleEl.style.marginBottom = '4px';
        titleEl.textContent = headline;
        tooltip.appendChild(titleEl);
        [
          ['Высокий', high, '${RECOMMENDATIONS_MATERIALITY_CHART_COLORS.высокий}'],
          ['Средний', medium, '${RECOMMENDATIONS_MATERIALITY_CHART_COLORS.средний}'],
          ['Низкий', low, '${RECOMMENDATIONS_MATERIALITY_CHART_COLORS.низкий}']
        ].forEach(function (row) {
          var line = document.createElement('div');
          line.style.color = row[2];
          line.style.fontWeight = '600';
          line.textContent = row[0] + ': ' + (row[1] == null || row[1] === '' ? '0' : row[1]);
          tooltip.appendChild(line);
        });
      };
      document.querySelectorAll('.chart-svg').forEach(function (frame) {
        frame.addEventListener('pointerover', function (event) {
          var target = event.target;
          if (!target || !target.closest) return;
          var hit = target.closest('path, rect, circle, polygon, polyline, .recharts-sector, .recharts-rectangle');
          if (!hit || !frame.contains(hit)) return;
          frame.classList.add('is-hovering');
          frame.querySelectorAll('[data-active="true"]').forEach(function (node) {
            node.removeAttribute('data-active');
          });
          hit.setAttribute('data-active', 'true');
          var label =
            hit.getAttribute('data-label') ||
            hit.getAttribute('name') ||
            hit.getAttribute('aria-label') ||
            hit.getAttribute('data-name') ||
            hit.getAttribute('title');
          if (!label) {
            var group = hit.closest('g');
            if (group) {
              var texts = [];
              Array.prototype.forEach.call(group.children || [], function (node) {
                var tag = (node.tagName || '').toLowerCase();
                if (tag !== 'text' && tag !== 'title') return;
                var value = (node.textContent || '').trim();
                if (value) texts.push(value);
              });
              if (texts.length) label = texts.join(' · ');
            }
          }
          fillTooltip(hit, label);
          tooltip.style.display = 'block';
        });
        frame.addEventListener('pointermove', function (event) {
          if (tooltip.style.display === 'none') return;
          tooltip.style.left = event.clientX + 14 + 'px';
          tooltip.style.top = event.clientY + 14 + 'px';
        });
        frame.addEventListener('pointerleave', function () {
          frame.classList.remove('is-hovering');
          frame.querySelectorAll('[data-active="true"]').forEach(function (node) {
            node.removeAttribute('data-active');
          });
          tooltip.style.display = 'none';
        });
      });
    })();
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${stamp()}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

function enrichEffectivenessMatrixCapture(
  charts: DashboardChartCapture[],
  rows: EffectivenessMatrixRow[] | undefined,
  selected: boolean,
): DashboardChartCapture[] {
  if (!selected || !rows?.length) {
    return charts;
  }

  const htmlMarkup = buildEffectivenessMatrixHtmlMarkup(rows);
  const matrixMeta = {
    id: 'effectivenessMatrix',
    title: 'Оценка эффективности',
    description: 'Матрица оценок по проверкам за период',
    width: 960,
    height: 540,
  } as const;

  const index = charts.findIndex((chart) => chart.id === 'effectivenessMatrix');
  if (index >= 0) {
    const next = [...charts];
    next[index] = {
      ...next[index],
      htmlMarkup,
      svgMarkup: undefined,
    };
    return next;
  }

  return [
    ...charts,
    {
      ...matrixMeta,
      dataUrl: '',
      htmlMarkup,
    },
  ];
}

function enrichMaterialityMatrixCapture(
  charts: DashboardChartCapture[],
  rows: MaterialityMatrixRow[] | undefined,
  selected: boolean,
): DashboardChartCapture[] {
  if (!selected || !rows?.length) {
    return charts;
  }

  const htmlMarkup = buildMaterialityMatrixHtmlMarkup(rows);
  const matrixMeta = {
    id: 'materialityMatrix',
    title: 'Матрица существенности',
    description: '',
    width: 960,
    height: 540,
  } as const;

  const index = charts.findIndex((chart) => chart.id === 'materialityMatrix');
  if (index >= 0) {
    const next = [...charts];
    next[index] = {
      ...next[index],
      htmlMarkup,
      svgMarkup: undefined,
    };
    return next;
  }

  return [
    ...charts,
    {
      ...matrixMeta,
      dataUrl: '',
      htmlMarkup,
    },
  ];
}

function enrichStatusMatrixCapture(
  charts: DashboardChartCapture[],
  rows: StatusMatrixRow[] | undefined,
  selected: boolean,
): DashboardChartCapture[] {
  if (!selected || !rows?.length) {
    return charts;
  }

  const htmlMarkup = buildStatusMatrixHtmlMarkup(rows);
  const matrixMeta = {
    id: 'statusMatrix',
    title: 'Матрица статусов',
    description: 'Матрица статусов по проверкам за период',
    width: 960,
    height: 540,
  } as const;

  const index = charts.findIndex((chart) => chart.id === 'statusMatrix');
  if (index >= 0) {
    const next = [...charts];
    next[index] = {
      ...next[index],
      htmlMarkup,
      svgMarkup: undefined,
    };
    return next;
  }

  return [
    ...charts,
    {
      ...matrixMeta,
      dataUrl: '',
      htmlMarkup,
    },
  ];
}

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
