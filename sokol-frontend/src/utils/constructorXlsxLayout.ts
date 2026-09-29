/**
 * Map constructor board layout (12-col grid) onto a single Excel sheet.
 * Each widget occupies the same x/y/w/h cells as on the dashboard; charts
 * are separate floating images, not one screenshot of the screen.
 */
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { CONSTRUCTOR_GRID_COLS } from '../components/analytics/constructor/constructorLayout';
import type { ConstructorWidget } from '../components/analytics/constructor/constructorTypes';
import type { DashboardChartCapture } from './dashboardChartRegistry';
import { chartHasPngPayload } from './dashboardChartRegistry';

/** ~84px per column → the 12-col board fits a landscape sheet without a horizontal scrollbar. */
export const CONSTRUCTOR_XLSX_COL_WIDTH = 12;
export const CONSTRUCTOR_XLSX_ROWS_PER_UNIT = 3;
/** 15pt × 3 rows ≈ 60px per grid unit; a h=4 card stays wide, close to the on-screen 2:1. */
export const CONSTRUCTOR_XLSX_ROW_HEIGHT = 15;
export const CONSTRUCTOR_XLSX_IMAGE_PAD = 0.18;
export const CONSTRUCTOR_XLSX_IMAGE_PAD_ROW = 0.28;
/**
 * Default 0-based image origin used by the anchor helpers.
 * The workbook itself starts the grid after the title, meta rows, and a spacer.
 */
export const CONSTRUCTOR_XLSX_GRID_ORIGIN_ROW = 3;

/** 0-based row index of the first board row: title + meta lines + spacer. */
export function constructorXlsxOriginRow(metaCount: number): number {
  return Math.max(metaCount, 0) + 2;
}

const BRAND = 'FF003366';
const INK = 'FF334155';
const CARD_FILL = 'FFFFFFFF';
const CARD_BORDER = 'FF9AADC0';
const HAIRLINE = 'FFE6EDF4';
const LABEL_FILL = 'FFF4F7FB';
const FONT = 'Calibri';

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
  padCol = CONSTRUCTOR_XLSX_IMAGE_PAD,
  padRow = CONSTRUCTOR_XLSX_IMAGE_PAD_ROW,
): ConstructorXlsxImageAnchor {
  const { x, y, w, h } = clampConstructorGridRect(layout);
  return {
    tl: {
      col: x + padCol,
      row: originRow + y * CONSTRUCTOR_XLSX_ROWS_PER_UNIT + padRow,
    },
    br: {
      col: x + w - padCol,
      row: originRow + (y + h) * CONSTRUCTOR_XLSX_ROWS_PER_UNIT - padRow,
    },
    editAs: 'twoCell',
  };
}

/** Excel column-width units → CSS pixels (Calibri 11, MDW 7). */
export function excelColumnWidthToPixels(width: number): number {
  const mdw = 7;
  return Math.floor(((256 * width + Math.floor(128 / mdw)) / 256) * mdw);
}

export function excelRowHeightToPixels(heightPt: number): number {
  return Math.round((heightPt * 96) / 72);
}

/** On-sheet drawing size of a widget, matching the enlarged 12-col grid. */
export function constructorXlsxImageExtent(
  layout: ConstructorGridRect,
  padCol = CONSTRUCTOR_XLSX_IMAGE_PAD,
  padRow = CONSTRUCTOR_XLSX_IMAGE_PAD_ROW,
): { width: number; height: number } {
  const { w, h } = clampConstructorGridRect(layout);
  const colPx = excelColumnWidthToPixels(CONSTRUCTOR_XLSX_COL_WIDTH);
  const rowPx = excelRowHeightToPixels(CONSTRUCTOR_XLSX_ROW_HEIGHT);
  return {
    width: Math.max(Math.round(w * colPx - 2 * padCol * colPx), 1),
    height: Math.max(Math.round(h * CONSTRUCTOR_XLSX_ROWS_PER_UNIT * rowPx - 2 * padRow * rowPx), 1),
  };
}

/** Place a native-aspect capture inside the widget cell without stretching. */
export function constructorXlsxFittedImage(
  layout: ConstructorGridRect,
  captureSize: { width: number; height: number },
  originRow = CONSTRUCTOR_XLSX_GRID_ORIGIN_ROW,
): { tl: { col: number; row: number }; ext: { width: number; height: number }; editAs: 'oneCell' } {
  const box = constructorXlsxImageAnchor(layout, originRow);
  const cell = constructorXlsxImageExtent(layout);
  const srcW = Math.max(captureSize.width, 1);
  const srcH = Math.max(captureSize.height, 1);
  const scale = Math.min(cell.width / srcW, cell.height / srcH);
  const width = Math.max(Math.round(srcW * scale), 1);
  const height = Math.max(Math.round(srcH * scale), 1);
  const colPx = excelColumnWidthToPixels(CONSTRUCTOR_XLSX_COL_WIDTH);
  const rowPx = excelRowHeightToPixels(CONSTRUCTOR_XLSX_ROW_HEIGHT);
  return {
    tl: {
      col: box.tl.col + (cell.width - width) / 2 / colPx,
      row: box.tl.row + (cell.height - height) / 2 / rowPx,
    },
    ext: { width, height },
    editAs: 'oneCell',
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

function paintRowBottom(sheet: ExcelJS.Worksheet, row: number, color: string, style: 'thin' | 'medium') {
  for (let col = 1; col <= CONSTRUCTOR_GRID_COLS; col += 1) {
    const cell = sheet.getCell(row, col);
    cell.border = { bottom: { style, color: { argb: color } } };
  }
}

function writeHeader(sheet: ExcelJS.Worksheet, title: string, meta: Array<[string, string]>) {
  sheet.mergeCells(1, 1, 1, CONSTRUCTOR_GRID_COLS);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: FONT, size: 18, bold: true, color: { argb: BRAND } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 28;
  paintRowBottom(sheet, 1, BRAND, 'medium');

  meta.forEach(([label, value], index) => {
    const row = 2 + index;
    sheet.mergeCells(row, 1, row, 3);
    sheet.mergeCells(row, 4, row, CONSTRUCTOR_GRID_COLS);
    const labelCell = sheet.getCell(row, 1);
    labelCell.value = label;
    labelCell.font = { name: FONT, size: 10, bold: true, color: { argb: BRAND } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LABEL_FILL } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    const valueCell = sheet.getCell(row, 4);
    valueCell.value = value;
    valueCell.font = { name: FONT, size: 10, color: { argb: INK } };
    valueCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(row).height = 20;
    for (let col = 1; col <= 3; col += 1) {
      sheet.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LABEL_FILL } };
    }
    paintRowBottom(sheet, row, HAIRLINE, 'thin');
  });

  const spacer = constructorXlsxOriginRow(meta.length);
  sheet.getRow(spacer).height = 12;
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
  const originRow = constructorXlsxOriginRow(meta.length);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SOKOL';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(excelSheetName(title), {
    properties: { tabColor: { argb: BRAND } },
    views: [
      {
        showGridLines: false,
        zoomScale: 100,
        zoomScaleNormal: 100,
        state: 'frozen',
        ySplit: originRow,
      },
    ],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      horizontalDpi: 600,
      verticalDpi: 600,
      printTitlesRow: `1:${Math.max(originRow, 1)}`,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.45,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  sheet.columns = Array.from({ length: CONSTRUCTOR_GRID_COLS }, () => ({
    width: CONSTRUCTOR_XLSX_COL_WIDTH,
  }));
  writeHeader(sheet, title, meta);

  const gridEndRow = originRow + rowSpan * CONSTRUCTOR_XLSX_ROWS_PER_UNIT;
  for (let row = originRow + 1; row <= gridEndRow; row += 1) {
    sheet.getRow(row).height = CONSTRUCTOR_XLSX_ROW_HEIGHT;
  }

  placed.forEach(({ widget, layout }) => {
    const range = constructorXlsxCellRange(layout, originRow);
    const capture = byId.get(widget.instanceId);
    if (!capture) {
      sheet.mergeCells(range.startRow, range.startCol, range.endRow, range.endCol);
      outlineRange(sheet, range.startRow, range.startCol, range.endRow, range.endCol);
      const labelCell = sheet.getCell(range.startRow, range.startCol);
      labelCell.value = widget.title;
      labelCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      labelCell.font = { name: FONT, size: 11, color: { argb: INK } };
      return;
    }

    // Keep the card cells unmerged. Excel drops the right and bottom edges of a
    // merged range, so the frame is drawn on the perimeter cells themselves.
    outlineRange(sheet, range.startRow, range.startCol, range.endRow, range.endCol);

    const imageId = workbook.addImage({
      base64: capture.dataUrl.startsWith('data:')
        ? capture.dataUrl
        : `data:image/png;base64,${capture.dataUrl}`,
      extension: 'png',
    });
    const fitted = constructorXlsxFittedImage(layout, capture, originRow);
    sheet.addImage(imageId, {
      tl: { col: fitted.tl.col, row: fitted.tl.row },
      ext: fitted.ext,
      editAs: fitted.editAs,
    } as unknown as ExcelJS.ImagePosition);
  });

  sheet.pageSetup.printArea = `A1:${sheet.getColumn(CONSTRUCTOR_GRID_COLS).letter}${gridEndRow}`;
  sheet.headerFooter.oddFooter = '&LSOKOL&RСтр. &P';

  return workbook;
}

const LOCAL_DPI_EXT =
  '<a:extLst><a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}">' +
  '<a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/>' +
  '</a:ext></a:extLst>';

/**
 * ExcelJS writes each picture with a 0×0 transform and marks it compressed for
 * print, so Excel resamples the PNG and the chart looks soft. Restore the real
 * size and tell Excel to draw the embedded pixels at 96 DPI.
 */
export function sharpenConstructorDrawingXml(xml: string): string {
  return xml.replace(/<xdr:(?:one|two)CellAnchor[\s\S]*?<\/xdr:(?:one|two)CellAnchor>/g, (anchor) => {
    const extent = anchor.match(/<xdr:ext\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/);
    let next = anchor.replace(/cstate="print"/g, 'cstate="none"');
    if (extent) {
      next = next.replace(/<a:ext cx="0" cy="0"\/>/, `<a:ext cx="${extent[1]}" cy="${extent[2]}"/>`);
    }
    if (!next.includes('useLocalDpi')) {
      next = next.replace(/<a:blip\b([^>]*)\/>/g, `<a:blip$1>${LOCAL_DPI_EXT}</a:blip>`);
    }
    return next;
  });
}

export async function sharpenConstructorXlsxBuffer(
  data: ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(data);
  const drawings = Object.keys(zip.files).filter((name) => /^xl\/drawings\/drawing\d+\.xml$/.test(name));
  if (drawings.length === 0) {
    return data instanceof Uint8Array ? data : new Uint8Array(data);
  }
  await Promise.all(
    drawings.map(async (name) => {
      const xml = await zip.file(name)?.async('string');
      if (!xml) {
        return;
      }
      zip.file(name, sharpenConstructorDrawingXml(xml));
    }),
  );
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export function constructorXlsxHasChartImages(workbook: ExcelJS.Workbook): boolean {
  return workbook.worksheets.some((sheet) => sheet.getImages().length > 0);
}
