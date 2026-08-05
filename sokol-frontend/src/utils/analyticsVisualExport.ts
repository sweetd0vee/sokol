/**
 * Bulk analytics export as chart images laid out on PDF/XLSX sheets.
 */
import ExcelJS from 'exceljs';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
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
  RECOMMENDATION_EXPORT_SECTIONS,
} from '../constants/analyticsExportSections';
import {
  captureDashboardCharts,
  type DashboardChartCapture,
} from './dashboardChartRegistry';

pdfMake.addVirtualFileSystem(pdfFonts);

export type VisualExportMetaRow = [string, string];

function stamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export type VisualAnalyticsKind = 'checks' | 'recommendations' | 'monitoring' | 'dva';

function sheetNameForSection(kind: VisualAnalyticsKind, sectionId: string, fallbackTitle: string) {
  const catalog =
    kind === 'checks'
      ? CHECK_EXPORT_SECTIONS
      : kind === 'recommendations'
        ? RECOMMENDATION_EXPORT_SECTIONS
        : kind === 'monitoring'
          ? MONITORING_EXPORT_SECTIONS
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

async function buildVisualPdf(options: {
  documentTitle: string;
  meta: VisualExportMetaRow[];
  charts: DashboardChartCapture[];
  filenamePrefix: string;
}) {
  const { documentTitle, meta, charts, filenamePrefix } = options;
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

async function buildVisualXlsx(options: {
  documentTitle: string;
  meta: VisualExportMetaRow[];
  charts: DashboardChartCapture[];
  kind: VisualAnalyticsKind;
  filenamePrefix: string;
}) {
  const { documentTitle, meta, charts, kind, filenamePrefix } = options;
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
  cover.getCell('A2').value = 'Выбранные дашборды экспортированы как изображения графиков';
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
  for (const [index, chart] of charts.entries()) {
    let sheetName = sheetNameForSection(kind, chart.id, chart.title);
    if (usedNames.has(sheetName)) {
      sheetName = `${sheetName.slice(0, 28)}_${index + 1}`;
    }
    usedNames.add(sheetName);

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
      base64: dataUrlToBase64(chart.dataUrl),
      extension: 'png',
    });

    const fitted = fitImageSize(chart.width, chart.height, 920, 480);
    // ExcelJS uses approximate pixel positioning; place under the title block.
    sheet.addImage(imageId, {
      tl: { col: 0.2, row: 3.2 },
      ext: { width: fitted.width, height: fitted.height },
      editAs: 'oneCell',
    });
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

async function buildVisualDocx(options: {
  documentTitle: string;
  meta: VisualExportMetaRow[];
  charts: DashboardChartCapture[];
  filenamePrefix: string;
}) {
  const { documentTitle, meta, charts, filenamePrefix } = options;
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

  const chartChildren = charts.flatMap((chart, index) => {
    const fitted = fitImageSize(chart.width * 2, chart.height * 2, 880, 500);
    return [
      new Paragraph({
        text: chart.title,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: index === 0 ? 320 : 560, after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: chart.description, color: '64748B', size: 20 })],
        spacing: { after: 180 },
      }),
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
    ];
  });

  const doc = new Document({
    creator: 'SOKOL',
    title: documentTitle,
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: documentTitle,
            heading: HeadingLevel.TITLE,
            spacing: { after: 160 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Отчёт по выбранным дашбордам. Графики, подписи и легенды соответствуют экранной версии.',
                color: '64748B',
              }),
            ],
            spacing: { after: 240 },
          }),
          metaTable,
          ...chartChildren,
        ],
      },
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

export async function exportVisualAnalyticsReport(options: {
  format: 'xlsx' | 'pdf' | 'docx';
  kind: VisualAnalyticsKind;
  documentTitle: string;
  filenamePrefix: string;
  meta: VisualExportMetaRow[];
  selectedSections: string[];
}) {
  const charts = await captureDashboardCharts(options.selectedSections);
  if (charts.length === 0) {
    throw new Error(
      'Не удалось снять выбранные дашборды. Отметьте карточки с графиками (не только «Исходные данные») и убедитесь, что они видны на экране.',
    );
  }

  if (options.format === 'pdf') {
    await buildVisualPdf({
      documentTitle: options.documentTitle,
      meta: options.meta,
      charts,
      filenamePrefix: options.filenamePrefix,
    });
    return;
  }

  if (options.format === 'docx') {
    await buildVisualDocx({
      documentTitle: options.documentTitle,
      meta: options.meta,
      charts,
      filenamePrefix: options.filenamePrefix,
    });
    return;
  }

  await buildVisualXlsx({
    documentTitle: options.documentTitle,
    meta: options.meta,
    charts,
    kind: options.kind,
    filenamePrefix: options.filenamePrefix,
  });
}
