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
import {
  getMaterialityChartColor,
  VALUE_BLUE_SCALE,
  VALUE_TEAL_SCALE,
} from '../../components/analytics/analyticsPalette';
import type { DvaCheckLifecycleRow } from '../../api/analytics';
import {
  averageLifecycleDurationDays,
  buildCheckLifecycleChartModel,
  buildCheckLifecycleExportRows,
  CHECK_LIFECYCLE_SEGMENTS,
  formatDurationDays,
  formatLifecycleChecksCount,
} from '../dvaAnalytics';
import type { DashboardChartCapture } from '../dashboardChartRegistry';
import { dataUrlToUint8Array, fitImageSize, stamp } from './shared';
import type { VisualExportMetaRow } from './types';

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

export async function buildVisualDocx(options: {
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
                text: (() => {
                  const lifecycleModel = buildCheckLifecycleChartModel(checkLifecycle!);
                  const averageLifecycle = averageLifecycleDurationDays(lifecycleModel.rows);
                  const parts = [`Итого: ${formatLifecycleChecksCount(checkLifecycle!.length)}`];
                  if (averageLifecycle !== null) {
                    parts.push(
                      `Средняя продолжительность жизненного цикла: ${formatDurationDays(averageLifecycle.averageDays)}`,
                    );
                  }
                  return parts.join(' · ');
                })(),
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
