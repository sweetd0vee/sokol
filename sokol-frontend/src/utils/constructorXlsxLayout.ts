/**
 * Map constructor board layout (12-col grid) onto a single Excel sheet.
 * Each widget occupies the same x/y/w/h cells as on the dashboard; charts
 * are separate floating images, not one screenshot of the screen.
 */
import ExcelJS from 'exceljs';
import { CONSTRUCTOR_GRID_COLS } from '../components/analytics/constructor/constructorLayout';
import type { ConstructorWidget } from '../components/analytics/constructor/constructorTypes';
import type { DashboardChartCapture } from './dashboardChartRegistry';
import { chartHasPngPayload } from './dashboardChartRegistry';

export const CONSTRUCTOR_XLSX_COL_WIDTH = 11;
export const CONSTRUCTOR_XLSX_ROWS_PER_UNIT = 4;
export const CONSTRUCTOR_XLSX_ROW_HEIGHT = 14;
export const CONSTRUCTOR_XLSX_IMAGE_PAD = 0.12;
/** Title + subtitle + gap before the board grid (0-based image origin). */
export const CONSTRUCTOR_XLSX_GRID_ORIGIN_ROW = 3;

const BRAND = 'FF003366';
const MUTED = 'FF64748B';
const CARD_FILL = 'FFF8FAFC';
const CARD_BORDER = 'FFD7DEE7';
const TITLE_FILL = 'FFEEF4FA';

export type ConstructorGridRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function clampConstructorGridRect(layout: ConstructorGridRect): ConstructorGridRect {
  const x = Math.max(0, Math.min(Math.floor(layout.x), CONSTRUCTOR_GRID_COLS - 1));
  const w = Math.max(1, Math.min(Math.floor(layout.w), CONSTRUCTOR_GRID_COLS - x));
  const y = Math.max(0, Math.floor(layout.y));
  const h = Math.max(1, Math.floor(layout.h));
  return { x, y, w, h };
}

export function constructorGridRowSpan(layouts: ConstructorGridRect[]): number {
  if (layouts.length === 0) {
    return 1;
  }
  return Math.max(
    1,
    ...layouts.map((item) => {
      const rect = clampConstructorGridRect(item);
      return rect.y + rect.h;
    }),
  );
}

export type ConstructorXlsxImageAnchor = {
  tl: { col: number; row: number };
  br: { col: number; row: number };
  editAs: 'twoCell';
};

/** ExcelJS image anchors are 0-based; widget cells use the dashboard 12-col grid. */
export function constructorXlsxImageAnchor(
  layout: ConstructorGridRect,
  originRow = CONSTRUCTOR_XLSX_GRID_ORIGIN_ROW,
  pad = CONSTRUCTOR_XLSX_IMAGE_PAD,
): ConstructorXlsxImageAnchor {
  const { x, y, w, h } = clampConstructorGridRect(layout);
  return {
    tl: {
      col: x + pad,
      row: originRow + y * CONSTRUCTOR_XLSX_ROWS_PER_UNIT + pad,
    },
    br: {
      col: x + w - pad,
      row: originRow + (y + h) * CONSTRUCTOR_XLSX_ROWS_PER_UNIT - pad,
    },
    editAs: 'twoCell',
  };
}

/** 1-based inclusive cell range behind a widget (for merge, fill, border). */
export function constructorXlsxCellRange(
  layout: ConstructorGridRect,
  originRow = CONSTRUCTOR_XLSX_GRID_ORIGIN_ROW,
): { startRow: number; startCol: number; endRow: number; endCol: number } {
  const { x, y, w, h } = clampConstructorGridRect(layout);
  return {
    startCol: x + 1,
    endCol: x + w,
    startRow: originRow + y * CONSTRUCTOR_XLSX_ROWS_PER_UNIT + 1,
    endRow: originRow + (y + h) * CONSTRUCTOR_XLSX_ROWS_PER_UNIT,
  };
}

export function excelSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return (cleaned || 'Конструктор').slice(0, 31);
}

function thinBorder(side: boolean) {
  return side ? { style: 'thin' as const, color: { argb: CARD_BORDER } } : undefined;
}

function outlineRange(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      const cell = sheet.getCell(row, col);
      cell.border = {
        top: thinBorder(row === startRow),
        bottom: thinBorder(row === endRow),
        left: thinBorder(col === startCol),
        right: thinBorder(col === endCol),
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: CARD_FILL },
      };
    }
  }
}

function formatMetaLine(meta: Array<[string, string]>): string {
  return meta
    .map(([label, value]) => `${label}: ${value}`)
    .filter((part) => part.length > 0)
    .join('   ·   ');
}

export function buildConstructorDashboardWorkbook(options: {
  title: string;
  meta: Array<[string, string]>;
  widgets: ConstructorWidget[];
  captures: DashboardChartCapture[];
}): ExcelJS.Workbook {
  const { title, meta, widgets, captures } = options;
  const byId = new Map(captures.filter((item) => chartHasPngPayload(item.dataUrl)).map((item) => [item.id, item]));
  const placed = widgets
    .map((widget) => ({ widget, layout: clampConstructorGridRect(widget.layout) }))
    .sort(
      (left, right) =>
        left.layout.y - right.layout.y
        || left.layout.x - right.layout.x
        || left.widget.instanceId.localeCompare(right.widget.instanceId),
    );
  const rowSpan = constructorGridRowSpan(placed.map((item) => item.layout));
  const originRow = CONSTRUCTOR_XLSX_GRID_ORIGIN_ROW;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SOKOL';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(excelSheetName(title), {
    properties: { tabColor: { argb: BRAND } },
    views: [{ showGridLines: false, zoomScale: 85, state: 'frozen', ySplit: 2 }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
    },
  });

  sheet.columns = Array.from({ length: CONSTRUCTOR_GRID_COLS }, () => ({
    width: CONSTRUCTOR_XLSX_COL_WIDTH,
  }));

  sheet.mergeCells(1, 1, 1, CONSTRUCTOR_GRID_COLS);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: BRAND } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_FILL } };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, CONSTRUCTOR_GRID_COLS);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = formatMetaLine(meta);
  subtitleCell.font = { name: 'Calibri', size: 10, color: { argb: MUTED } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  sheet.getRow(2).height = 18;
  sheet.getRow(3).height = 8;

  const gridEndRow = originRow + rowSpan * CONSTRUCTOR_XLSX_ROWS_PER_UNIT;
  for (let row = originRow + 1; row <= gridEndRow; row += 1) {
    sheet.getRow(row).height = CONSTRUCTOR_XLSX_ROW_HEIGHT;
  }

  placed.forEach(({ widget, layout }) => {
    const range = constructorXlsxCellRange(layout, originRow);
    sheet.mergeCells(range.startRow, range.startCol, range.endRow, range.endCol);
    outlineRange(sheet, range.startRow, range.startCol, range.endRow, range.endCol);

    const labelCell = sheet.getCell(range.startRow, range.startCol);
    labelCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    labelCell.font = { name: 'Calibri', size: 11, color: { argb: MUTED } };

    const capture = byId.get(widget.instanceId);
    if (!capture) {
      labelCell.value = widget.title;
      return;
    }

    const imageId = workbook.addImage({
      base64: capture.dataUrl.startsWith('data:')
        ? capture.dataUrl
        : `data:image/png;base64,${capture.dataUrl}`,
      extension: 'png',
    });
    const anchor = constructorXlsxImageAnchor(layout, originRow);
    sheet.addImage(imageId, {
      tl: { col: anchor.tl.col, row: anchor.tl.row },
      br: { col: anchor.br.col, row: anchor.br.row },
      editAs: anchor.editAs,
    } as unknown as ExcelJS.ImageRange);
  });

  const headerTitle = title.replaceAll('&', '&&');
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(CONSTRUCTOR_GRID_COLS).letter}${gridEndRow}`;
  sheet.headerFooter.oddHeader = `&LSOKOL&C&B${headerTitle}`;

  return workbook;
}

export function constructorXlsxHasChartImages(workbook: ExcelJS.Workbook): boolean {
  return workbook.worksheets.some((sheet) => sheet.getImages().length > 0);
}
