/**
 * Constructor DOCX: one landscape sheet with a 12-col table matching the board.
 * Each widget is its own image, not a screenshot of the whole canvas.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  HeightRule,
  ImageRun,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalMergeType,
  WidthType,
} from 'docx';
import { CONSTRUCTOR_GRID_COLS } from '../components/analytics/constructor/constructorLayout';
import {
  CONSTRUCTOR_SOURCE_LABELS,
  type ConstructorWidget,
} from '../components/analytics/constructor/constructorTypes';
import { clampConstructorGridRect, constructorGridRowSpan } from './constructorXlsxLayout';
import { chartHasPngPayload, type DashboardChartCapture } from './dashboardChartRegistry';
import {
  DOCX_LANDSCAPE_PAGE_HEIGHT_TWIPS,
  DOCX_LANDSCAPE_PAGE_WIDTH_TWIPS,
} from './tableExport/shared';

const PAGE_MARGIN_TWIPS = 560;
const CONTENT_WIDTH_TWIPS = DOCX_LANDSCAPE_PAGE_WIDTH_TWIPS - PAGE_MARGIN_TWIPS * 2;
const COL_WIDTH_TWIPS = Math.floor(CONTENT_WIDTH_TWIPS / CONSTRUCTOR_GRID_COLS);
const GRID_ROW_TWIPS = 1400;
const CONTENT_WIDTH_PX = 1000;
const GRID_ROW_PX = 90;
const CELL_PAD_PX = 16;
const TITLE_BLOCK_PX = 36;
const LINE = 'D7DEE7';
const BRAND = '003366';

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const GAP_BORDER = { style: BorderStyle.SINGLE, size: 8, color: 'F3F5F7' };

export type ConstructorDocxGridCell =
  | {
      kind: 'widget';
      widgetIndex: number;
      x: number;
      y: number;
      w: number;
      h: number;
    }
  | {
      kind: 'continue';
      widgetIndex: number;
      w: number;
    }
  | {
      kind: 'empty';
    };

export function constructorDocxGridRows(
  layouts: Array<{ x: number; y: number; w: number; h: number }>,
): ConstructorDocxGridCell[][] {
  const clamped = layouts.map(clampConstructorGridRect);
  const rowCount = constructorGridRowSpan(clamped);
  const owner = Array.from({ length: rowCount }, () =>
    Array.from({ length: CONSTRUCTOR_GRID_COLS }, () => null as number | null),
  );
  clamped.forEach((layout, index) => {
    for (let dy = 0; dy < layout.h; dy += 1) {
      for (let dx = 0; dx < layout.w; dx += 1) {
        const row = layout.y + dy;
        const col = layout.x + dx;
        if (row >= 0 && row < rowCount && col >= 0 && col < CONSTRUCTOR_GRID_COLS && owner[row]?.[col] === null) {
          owner[row][col] = index;
        }
      }
    }
  });

  const rows: ConstructorDocxGridCell[][] = [];
  for (let row = 0; row < rowCount; row += 1) {
    const cells: ConstructorDocxGridCell[] = [];
    let col = 0;
    while (col < CONSTRUCTOR_GRID_COLS) {
      const index = owner[row]?.[col] ?? null;
      if (index === null) {
        cells.push({ kind: 'empty' });
        col += 1;
        continue;
      }
      const layout = clamped[index];
      if (!layout) {
        col += 1;
        continue;
      }
      if (layout.x === col && layout.y === row) {
        cells.push({ kind: 'widget', widgetIndex: index, ...layout });
        col += layout.w;
        continue;
      }
      if (layout.x === col && layout.y < row) {
        cells.push({ kind: 'continue', widgetIndex: index, w: layout.w });
        col += layout.w;
        continue;
      }
      col += 1;
    }
    rows.push(cells);
  }
  return rows;
}

export function constructorDocxImageBox(layout: { w: number; h: number }): { width: number; height: number } {
  const { w, h } = clampConstructorGridRect({ x: 0, y: 0, ...layout });
  return {
    width: Math.max(Math.round((w * CONTENT_WIDTH_PX) / CONSTRUCTOR_GRID_COLS - CELL_PAD_PX), 40),
    height: Math.max(Math.round(h * GRID_ROW_PX - TITLE_BLOCK_PX - CELL_PAD_PX), 40),
  };
}

function fitContain(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  const scale = Math.min(maxW / Math.max(srcW, 1), maxH / Math.max(srcH, 1));
  return {
    width: Math.max(Math.round(srcW * scale), 1),
    height: Math.max(Math.round(srcH * scale), 1),
  };
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function cellBorders() {
  return {
    top: CELL_BORDER,
    bottom: CELL_BORDER,
    left: CELL_BORDER,
    right: CELL_BORDER,
  };
}

function emptyCell() {
  return new TableCell({
    width: { size: COL_WIDTH_TWIPS, type: WidthType.DXA },
    borders: {
      top: GAP_BORDER,
      bottom: GAP_BORDER,
      left: GAP_BORDER,
      right: GAP_BORDER,
    },
    children: [new Paragraph({})],
  });
}

function continueCell(columnSpan: number) {
  return new TableCell({
    columnSpan,
    width: { size: COL_WIDTH_TWIPS * columnSpan, type: WidthType.DXA },
    verticalMerge: VerticalMergeType.CONTINUE,
    borders: cellBorders(),
    children: [new Paragraph({})],
  });
}

function widgetCell(
  widget: ConstructorWidget,
  capture: DashboardChartCapture | undefined,
): TableCell {
  const layout = clampConstructorGridRect(widget.layout);
  const box = constructorDocxImageBox(layout);
  const children: Paragraph[] = [
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: widget.title, bold: true, color: BRAND, size: 18 })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `${CONSTRUCTOR_SOURCE_LABELS[widget.kind]}${widget.filterCaption ? ` · ${widget.filterCaption}` : ''}`,
          color: '64748B',
          size: 14,
        }),
      ],
    }),
  ];

  if (capture && chartHasPngPayload(capture.dataUrl)) {
    const fitted = fitContain(capture.width, capture.height, box.width, box.height);
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: dataUrlToUint8Array(capture.dataUrl),
            transformation: fitted,
            type: 'png',
          }),
        ],
      }),
    );
  } else {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Нет снимка графика', color: '64748B', size: 16 })],
      }),
    );
  }

  return new TableCell({
    columnSpan: layout.w,
    rowSpan: layout.h,
    verticalMerge: layout.h > 1 ? VerticalMergeType.RESTART : undefined,
    width: { size: COL_WIDTH_TWIPS * layout.w, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    borders: cellBorders(),
    children,
  });
}

export function buildConstructorDashboardDocument(options: {
  title: string;
  meta: Array<[string, string]>;
  widgets: ConstructorWidget[];
  captures: DashboardChartCapture[];
}): Document {
  const { title, meta, widgets, captures } = options;
  const byId = new Map(captures.map((item) => [item.id, item]));
  const gridRows = constructorDocxGridRows(widgets.map((widget) => widget.layout));

  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: meta.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: BRAND })] })],
            }),
            new TableCell({
              width: { size: 72, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun({ text: value })] })],
            }),
          ],
        }),
    ),
  });

  const board = new Table({
    width: { size: COL_WIDTH_TWIPS * CONSTRUCTOR_GRID_COLS, type: WidthType.DXA },
    columnWidths: Array.from({ length: CONSTRUCTOR_GRID_COLS }, () => COL_WIDTH_TWIPS),
    rows: gridRows.map(
      (cells) =>
        new TableRow({
          height: { value: GRID_ROW_TWIPS, rule: HeightRule.ATLEAST },
          children: cells.map((cell) => {
            if (cell.kind === 'empty') {
              return emptyCell();
            }
            if (cell.kind === 'continue') {
              return continueCell(cell.w);
            }
            const widget = widgets[cell.widgetIndex];
            if (!widget) {
              return emptyCell();
            }
            return widgetCell(widget, byId.get(widget.instanceId));
          }),
        }),
    ),
  });

  return new Document({
    creator: 'SOKOL',
    title,
    sections: [
      {
        properties: {
          page: {
            size: {
              width: DOCX_LANDSCAPE_PAGE_WIDTH_TWIPS,
              height: DOCX_LANDSCAPE_PAGE_HEIGHT_TWIPS,
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: PAGE_MARGIN_TWIPS,
              right: PAGE_MARGIN_TWIPS,
              bottom: PAGE_MARGIN_TWIPS,
              left: PAGE_MARGIN_TWIPS,
            },
          },
        },
        children: [
          new Paragraph({ text: title, heading: HeadingLevel.TITLE, spacing: { after: 80 } }),
          metaTable,
          new Paragraph({ spacing: { before: 200, after: 80 } }),
          board,
        ],
      },
    ],
  });
}
