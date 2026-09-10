import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  buildEffectivenessColumnShares,
  EFFECTIVENESS_LEGEND,
  EFFECTIVENESS_MATRIX_COLUMNS,
  formatEffectivenessChecksCount,
  getEffectivenessToneColor,
  type EffectivenessMatrixRow,
} from '../checkAnalytics';
import {
  buildMaterialityMatrixColumnTotals,
  formatMaterialityChecksCount,
  getMaterialityMatrixCount,
  MATERIALITY_MATRIX_COLUMNS,
  MATERIALITY_MATRIX_LEGEND,
  MATERIALITY_MATRIX_TOTAL_COLUMN,
  materialityMatrixGrandTotal,
  type MaterialityMatrixRow,
} from '../materialityMatrix';
import {
  buildStatusMatrixColumnShares,
  formatStatusChecksCount,
  getStatusMatrixCount,
  STATUS_MATRIX_COLUMNS,
  STATUS_MATRIX_LEGEND,
  type StatusMatrixRow,
} from '../statusMatrix';
import { getMaterialityChartColor } from '../../components/analytics/analyticsPalette';
import type { DashboardChartCapture } from '../dashboardChartRegistry';
import { dataUrlToBase64, fitImageSize, stamp } from './shared';
import type { VisualExportMetaRow } from './types';

pdfMake.addVirtualFileSystem(pdfFonts);

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

export async function buildVisualPdf(options: {
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
