/**
 * Map constructor board layout (12-col grid) onto one landscape Excel sheet.
 * Each widget is its own card and image. Pictures are written at full PNG
 * resolution; ExcelJS otherwise stores a 0×0 transform and marks them
 * compressed for print, which makes the charts look soft.
 */
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { CONSTRUCTOR_GRID_COLS } from '../constants/constructorGrid';
import type { ConstructorWidget } from '../components/analytics/constructor/constructorTypes';
import type { DashboardChartCapture } from './dashboardChartRegistry';
import { chartHasPngPayload } from './dashboardChartRegistry';

/** Two Excel columns per board column; the last column of a widget is left empty as a gutter. */
export const CONSTRUCTOR_XLSX_COLS_PER_BOARD = 2;
export const CONSTRUCTOR_XLSX_SHEET_COLS = CONSTRUCTOR_GRID_COLS * CONSTRUCTOR_XLSX_COLS_PER_BOARD;
/** ~52px × 24 cols ≈ 1250px — large enough that charts stay sharp at 100% zoom. */
export const CONSTRUCTOR_XLSX_COL_WIDTH = 7.5;
export const CONSTRUCTOR_XLSX_ROWS_PER_UNIT = 3;
/** 18pt × 3 rows ≈ 72px per grid unit; a h=4 card stays close to the on-screen 2:1. */
export const CONSTRUCTOR_XLSX_ROW_HEIGHT = 18;
export const CONSTRUCTOR_XLSX_BAND_GAP_ROWS = 1;
export const CONSTRUCTOR_XLSX_IMAGE_PAD = 0.4;
export const CONSTRUCTOR_XLSX_IMAGE_PAD_ROW = 0.45;
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

export type ConstructorXlsxSheetRect = {
  startCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
};

/** 1-based inclusive Excel range for a board widget, with a 1-col gutter on the right. */
export function constructorXlsxSheetRect(
  layout: ConstructorGridRect,
  originRow = CONSTRUCTOR_XLSX_GRID_ORIGIN_ROW,
  bandGapBefore = 0,
): ConstructorXlsxSheetRect {
  const { x, y, w, h } = clampConstructorGridRect(layout);
  const startCol = x * CONSTRUCTOR_XLSX_COLS_PER_BOARD + 1;
  const endCol = (x + w) * CONSTRUCTOR_XLSX_COLS_PER_BOARD - (x + w < CONSTRUCTOR_GRID_COLS ? 1 : 0);
  const startRow = originRow + y * CONSTRUCTOR_XLSX_ROWS_PER_UNIT + bandGapBefore + 1;
  const endRow = startRow + h * CONSTRUCTOR_XLSX_ROWS_PER_UNIT - 1;
  return { startCol, endCol, startRow, endRow };
}

export function constructorXlsxBandGapBefore(ys: number[], y: number): number {
  return ys.filter((value) => value < y).length * CONSTRUCTOR_XLSX_BAND_GAP_ROWS;
}

export type ConstructorXlsxImageAnchor = {
  tl: { col: number; row: number };
  br: { col: number; row: number };
  editAs: 'twoCell';
};

/** ExcelJS image anchors are 0-based; widget cells use the 24-col sheet (2 per board col). */
export function constructorXlsxImageAnchor(
  layout: ConstructorGridRect,
  originRow = CONSTRUCTOR_XLSX_GRID_ORIGIN_ROW,
  padCol = CONSTRUCTOR_XLSX_IMAGE_PAD,
  padRow = CONSTRUCTOR_XLSX_IMAGE_PAD_ROW,
  bandGapBefore = 0,
): ConstructorXlsxImageAnchor {
  const range = constructorXlsxSheetRect(layout, originRow, bandGapBefore);
  return {
    tl: {
      col: range.startCol - 1 + padCol,
      row: range.startRow - 1 + padRow,
    },
    br: {
      col: range.endCol - padCol,
      row: range.endRow - padRow,
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

/** On-sheet drawing size of a widget, after gutters and padding. */
export function constructorXlsxImageExtent(
  layout: ConstructorGridRect,
  padCol = CONSTRUCTOR_XLSX_IMAGE_PAD,
  padRow = CONSTRUCTOR_XLSX_IMAGE_PAD_ROW,
): { width: number; height: number } {
  const range = constructorXlsxSheetRect(layout);
  const colPx = excelColumnWidthToPixels(CONSTRUCTOR_XLSX_COL_WIDTH);
  const rowPx = excelRowHeightToPixels(CONSTRUCTOR_XLSX_ROW_HEIGHT);
  const cols = range.endCol - range.startCol + 1;
  const rows = range.endRow - range.startRow + 1;
  return {
    width: Math.max(Math.round(cols * colPx - 2 * padCol * colPx), 1),
    height: Math.max(Math.round(rows * rowPx - 2 * padRow * rowPx), 1),
  };
}

/** Place a native-aspect capture inside the widget cell without stretching. */
export function constructorXlsxFittedImage(
  layout: ConstructorGridRect,
  captureSize: { width: number; height: number },
  originRow = CONSTRUCTOR_XLSX_GRID_ORIGIN_ROW,
  bandGapBefore = 0,
): { tl: { col: number; row: number }; ext: { width: number; height: number }; editAs: 'oneCell' } {
  const box = constructorXlsxImageAnchor(layout, originRow, CONSTRUCTOR_XLSX_IMAGE_PAD, CONSTRUCTOR_XLSX_IMAGE_PAD_ROW, bandGapBefore);
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

/** 1-based inclusive cell range behind a widget (for fill and border). */
export function constructorXlsxCellRange(
  layout: ConstructorGridRect,
  originRow = CONSTRUCTOR_XLSX_GRID_ORIGIN_ROW,
  bandGapBefore = 0,
): ConstructorXlsxSheetRect {
  return constructorXlsxSheetRect(layout, originRow, bandGapBefore);
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
  for (let col = 1; col <= CONSTRUCTOR_XLSX_SHEET_COLS; col += 1) {
    const cell = sheet.getCell(row, col);
    cell.border = { bottom: { style, color: { argb: color } } };
  }
}

function writeHeader(sheet: ExcelJS.Worksheet, title: string, meta: Array<[string, string]>) {
  sheet.mergeCells(1, 1, 1, CONSTRUCTOR_XLSX_SHEET_COLS);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: FONT, size: 20, bold: true, color: { argb: BRAND } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 32;
  paintRowBottom(sheet, 1, BRAND, 'medium');

  const labelCols = 6;
  meta.forEach(([label, value], index) => {
    const row = 2 + index;
    sheet.mergeCells(row, 1, row, labelCols);
    sheet.mergeCells(row, labelCols + 1, row, CONSTRUCTOR_XLSX_SHEET_COLS);
    const labelCell = sheet.getCell(row, 1);
    labelCell.value = label;
    labelCell.font = { name: FONT, size: 10, bold: true, color: { argb: BRAND } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LABEL_FILL } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    const valueCell = sheet.getCell(row, labelCols + 1);
    valueCell.value = value;
    valueCell.font = { name: FONT, size: 11, color: { argb: INK } };
    valueCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(row).height = 22;
    for (let col = 1; col <= labelCols; col += 1) {
      sheet.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LABEL_FILL } };
    }
    paintRowBottom(sheet, row, HAIRLINE, 'thin');
  });

  const spacer = constructorXlsxOriginRow(meta.length);
  sheet.getRow(spacer).height = 14;
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
  const originRow = constructorXlsxOriginRow(meta.length);
  const bandYs = [...new Set(placed.map((item) => item.layout.y))].sort((left, right) => left - right);

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
      fitToHeight: 1,
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

  sheet.columns = Array.from({ length: CONSTRUCTOR_XLSX_SHEET_COLS }, () => ({
    width: CONSTRUCTOR_XLSX_COL_WIDTH,
  }));
  writeHeader(sheet, title, meta);

  const gridEndRow = placed.reduce((max, item) => {
    const range = constructorXlsxCellRange(
      item.layout,
      originRow,
      constructorXlsxBandGapBefore(bandYs, item.layout.y),
    );
    return Math.max(max, range.endRow);
  }, originRow);
  for (let row = originRow + 1; row <= gridEndRow; row += 1) {
    sheet.getRow(row).height = CONSTRUCTOR_XLSX_ROW_HEIGHT;
  }

  placed.forEach(({ widget, layout }) => {
    const bandGap = constructorXlsxBandGapBefore(bandYs, layout.y);
    const range = constructorXlsxCellRange(layout, originRow, bandGap);
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
    const fitted = constructorXlsxFittedImage(layout, capture, originRow, bandGap);
    sheet.addImage(imageId, {
      tl: { col: fitted.tl.col, row: fitted.tl.row },
      ext: fitted.ext,
      editAs: fitted.editAs,
    } as unknown as ExcelJS.ImagePosition);
  });

  sheet.pageSetup.printArea = `A1:${sheet.getColumn(CONSTRUCTOR_XLSX_SHEET_COLS).letter}${gridEndRow}`;
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
): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(data);
  const drawings = Object.keys(zip.files).filter((name) => /^xl\/drawings\/drawing\d+\.xml$/.test(name));
  if (drawings.length === 0) {
    if (data instanceof ArrayBuffer) {
      return data;
    }
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
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
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

export function constructorXlsxHasChartImages(workbook: ExcelJS.Workbook): boolean {
  return workbook.worksheets.some((sheet) => sheet.getImages().length > 0);
}
