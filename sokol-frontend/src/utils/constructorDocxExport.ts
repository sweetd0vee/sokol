/**
 * Constructor DOCX: one landscape sheet. Widgets that start on the same board
 * row share one table row, so a chart is a single card instead of a vertical
 * merge (those merges were drawing an extra column and stretching each card
 * across the whole page).
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
  type ITableBordersOptions,
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

const PAGE_MARGIN_TWIPS = 640;
const CONTENT_WIDTH_TWIPS = DOCX_LANDSCAPE_PAGE_WIDTH_TWIPS - PAGE_MARGIN_TWIPS * 2;
const COL_WIDTH_TWIPS = Math.floor(CONTENT_WIDTH_TWIPS / CONSTRUCTOR_GRID_COLS);
const BOARD_WIDTH_TWIPS = COL_WIDTH_TWIPS * CONSTRUCTOR_GRID_COLS;
/** One board row unit. A half-width card (h=4) stays wide, and two such rows fit the page. */
const GRID_ROW_TWIPS = 900;
const CELL_MARGIN_TWIPS = 120;
const TWIPS_PER_PX = 15;
const BRAND = '003366';
const INK = '334155';
const MUTED = '64748B';
const LINE = 'D7DEE7';
const HAIRLINE = 'E6EDF4';
const LABEL_FILL = 'F4F7FB';
const FONT = 'Calibri';

const NIL_BORDER: IBorderOptions = { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' };
const CARD_BORDER: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const META_HAIRLINE: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: HAIRLINE };

const NO_TABLE_BORDERS: ITableBordersOptions = {
  top: NIL_BORDER,
  bottom: NIL_BORDER,
  left: NIL_BORDER,
  right: NIL_BORDER,
  insideHorizontal: NIL_BORDER,
  insideVertical: NIL_BORDER,
};

const CARD_BORDERS = {
  top: CARD_BORDER,
  bottom: CARD_BORDER,
  left: CARD_BORDER,
  right: CARD_BORDER,
};

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

/** Pixel box the chart image is fitted into, inside the card padding. */
export function constructorDocxImageBox(layout: { w: number; h: number }): { width: number; height: number } {
  const { w, h } = clampConstructorGridRect({ x: 0, y: 0, ...layout });
  return {
    width: Math.max(Math.floor((COL_WIDTH_TWIPS * w - CELL_MARGIN_TWIPS * 2) / TWIPS_PER_PX), 40),
    height: Math.max(Math.floor((GRID_ROW_TWIPS * h - CELL_MARGIN_TWIPS * 2) / TWIPS_PER_PX), 40),
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

function emptyCell(columnSpan: number) {
  return new TableCell({
    columnSpan,
    width: { size: COL_WIDTH_TWIPS * columnSpan, type: WidthType.DXA },
    borders: {
      top: NIL_BORDER,
      bottom: NIL_BORDER,
      left: NIL_BORDER,
      right: NIL_BORDER,
    },
    children: [new Paragraph({})],
  });
}

function widgetCell(widget: ConstructorWidget, capture: DashboardChartCapture | undefined): TableCell {
  const layout = clampConstructorGridRect(widget.layout);
  const box = constructorDocxImageBox(layout);
  const children: Paragraph[] = [];

  if (capture && chartHasPngPayload(capture.dataUrl)) {
    const fitted = fitContain(capture.width, capture.height, box.width, box.height);
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
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
    const caption = `${CONSTRUCTOR_SOURCE_LABELS[widget.kind]}${widget.filterCaption ? ` · ${widget.filterCaption}` : ''}`;
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: widget.title, bold: true, color: BRAND, size: 18, font: FONT })],
      }),
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: caption, color: MUTED, size: 16, font: FONT })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Нет снимка графика', color: MUTED, size: 16, font: FONT })],
      }),
    );
  }

  return new TableCell({
    columnSpan: layout.w,
    width: { size: COL_WIDTH_TWIPS * layout.w, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: {
      top: CELL_MARGIN_TWIPS,
      bottom: CELL_MARGIN_TWIPS,
      left: CELL_MARGIN_TWIPS,
      right: CELL_MARGIN_TWIPS,
    },
    borders: CARD_BORDERS,
    children,
  });
}

function boardTable(widgets: ConstructorWidget[], byId: Map<string, DashboardChartCapture>) {
  const placed = widgets
    .map((widget) => ({ widget, layout: clampConstructorGridRect(widget.layout) }))
    .sort((left, right) => left.layout.y - right.layout.y || left.layout.x - right.layout.x);
  const startRows = [...new Set(placed.map((item) => item.layout.y))];

  const rows = startRows.map((y) => {
    const items = placed.filter((item) => item.layout.y === y);
    const rowUnits = Math.max(...items.map((item) => item.layout.h));
    const cells: TableCell[] = [];
    let col = 0;
    for (const item of items) {
      const { x, w } = item.layout;
      if (x < col || x + w > CONSTRUCTOR_GRID_COLS) {
        continue;
      }
      if (x > col) {
        cells.push(emptyCell(x - col));
        col = x;
      }
      cells.push(widgetCell(item.widget, byId.get(item.widget.instanceId)));
      col += w;
    }
    if (col < CONSTRUCTOR_GRID_COLS) {
      cells.push(emptyCell(CONSTRUCTOR_GRID_COLS - col));
    }
    return new TableRow({
      cantSplit: true,
      height: { value: GRID_ROW_TWIPS * rowUnits, rule: HeightRule.ATLEAST },
      children: cells.length > 0 ? cells : [emptyCell(CONSTRUCTOR_GRID_COLS)],
    });
  });

  return new Table({
    width: { size: BOARD_WIDTH_TWIPS, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: Array.from({ length: CONSTRUCTOR_GRID_COLS }, () => COL_WIDTH_TWIPS),
    borders: NO_TABLE_BORDERS,
    rows,
  });
}

function metaTable(meta: Array<[string, string]>) {
  const labelWidth = 3400;
  return new Table({
    width: { size: BOARD_WIDTH_TWIPS, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [labelWidth, BOARD_WIDTH_TWIPS - labelWidth],
    borders: {
      top: NIL_BORDER,
      left: NIL_BORDER,
      right: NIL_BORDER,
      bottom: META_HAIRLINE,
      insideHorizontal: META_HAIRLINE,
      insideVertical: NIL_BORDER,
    },
    rows: meta.map(
      ([label, value]) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: labelWidth, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: LABEL_FILL },
              margins: { top: 50, bottom: 50, left: 120, right: 120 },
              borders: {
                top: NIL_BORDER,
                bottom: META_HAIRLINE,
                left: NIL_BORDER,
                right: NIL_BORDER,
              },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: label, bold: true, color: BRAND, size: 18, font: FONT })],
                }),
              ],
            }),
            new TableCell({
              width: { size: BOARD_WIDTH_TWIPS - labelWidth, type: WidthType.DXA },
              margins: { top: 50, bottom: 50, left: 160, right: 80 },
              borders: {
                top: NIL_BORDER,
                bottom: META_HAIRLINE,
                left: NIL_BORDER,
                right: NIL_BORDER,
              },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: value, color: INK, size: 18, font: FONT })],
                }),
              ],
            }),
          ],
        }),
    ),
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
  const board = boardTable(widgets, byId);

  return new Document({
    creator: 'SOKOL',
    title,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 20 },
          paragraph: { spacing: { before: 0, after: 0 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              // docx swaps width and height when orientation is landscape.
              width: DOCX_LANDSCAPE_PAGE_HEIGHT_TWIPS,
              height: DOCX_LANDSCAPE_PAGE_WIDTH_TWIPS,
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
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND, space: 6 },
            },
            spacing: { before: 0, after: 120 },
            children: [new TextRun({ text: title, bold: true, color: BRAND, size: 40, font: FONT })],
          }),
          metaTable(meta),
          new Paragraph({ spacing: { before: 200, after: 80 } }),
          board,
        ],
      },
    ],
  });
}
