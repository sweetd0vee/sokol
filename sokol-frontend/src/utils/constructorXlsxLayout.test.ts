import { describe, expect, it } from 'vitest';
import type { ConstructorWidget } from '../components/analytics/constructor/constructorTypes';
import type { DashboardChartCapture } from './dashboardChartRegistry';
import {
  buildConstructorDashboardWorkbook,
  clampConstructorGridRect,
  CONSTRUCTOR_XLSX_COL_WIDTH,
  CONSTRUCTOR_XLSX_GRID_ORIGIN_ROW,
  CONSTRUCTOR_XLSX_IMAGE_PAD,
  CONSTRUCTOR_XLSX_IMAGE_PAD_ROW,
  CONSTRUCTOR_XLSX_ROWS_PER_UNIT,
  constructorGridRowSpan,
  constructorXlsxCellRange,
  constructorXlsxHasChartImages,
  constructorXlsxFittedImage,
  constructorXlsxImageAnchor,
  constructorXlsxImageExtent,
  excelColumnWidthToPixels,
  excelSheetName,
} from './constructorXlsxLayout';

const PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function widget(
  id: string,
  layout: { x: number; y: number; w: number; h: number },
  title = id,
): ConstructorWidget {
  return {
    instanceId: id,
    kind: 'checks',
    sectionId: id,
    title,
    description: '',
    filterCaption: 'Все',
    size: { w: layout.w, h: layout.h, minW: 1, minH: 1 },
    payload: { chart: 'list', items: [] },
    layout: { ...layout, minW: 1, minH: 1 },
  };
}

function capture(id: string): DashboardChartCapture {
  return {
    id,
    title: id,
    description: '',
    dataUrl: PIXEL_PNG,
    width: 640,
    height: 360,
  };
}

describe('constructor xlsx grid mapping', () => {
  it('clamps widgets into the 12-column board', () => {
    expect(clampConstructorGridRect({ x: -2, y: -1, w: 20, h: 0 })).toEqual({
      x: 0,
      y: 0,
      w: 12,
      h: 1,
    });
    expect(clampConstructorGridRect({ x: 10, y: 3, w: 8, h: 4 })).toEqual({
      x: 10,
      y: 3,
      w: 2,
      h: 4,
    });
  });

  it('places two half-width charts side by side like the dashboard', () => {
    const left = constructorXlsxImageAnchor({ x: 0, y: 0, w: 6, h: 4 });
    const right = constructorXlsxImageAnchor({ x: 6, y: 0, w: 6, h: 4 });
    expect(left.tl.col).toBeCloseTo(CONSTRUCTOR_XLSX_IMAGE_PAD);
    expect(left.br.col).toBeCloseTo(6 - CONSTRUCTOR_XLSX_IMAGE_PAD);
    expect(right.tl.col).toBeCloseTo(6 + CONSTRUCTOR_XLSX_IMAGE_PAD);
    expect(right.br.col).toBeCloseTo(12 - CONSTRUCTOR_XLSX_IMAGE_PAD);
    expect(right.tl.col - left.br.col).toBeCloseTo(CONSTRUCTOR_XLSX_IMAGE_PAD * 2);
    expect(left.tl.row).toBe(right.tl.row);
    expect(left.br.row).toBe(right.br.row);
    expect(left.editAs).toBe('twoCell');
  });

  it('draws a half-width chart at dashboard scale without stretching the whole sheet', () => {
    const half = constructorXlsxImageExtent({ x: 0, y: 0, w: 6, h: 4 });
    const full = constructorXlsxImageExtent({ x: 0, y: 4, w: 12, h: 3 });
    const boardWidth = excelColumnWidthToPixels(CONSTRUCTOR_XLSX_COL_WIDTH) * 12;
    expect(half.width).toBeGreaterThanOrEqual(500);
    expect(half.width).toBeLessThan(800);
    expect(half.height).toBeGreaterThanOrEqual(280);
    expect(full.width).toBeGreaterThan(half.width);
    expect(full.width / half.width).toBeCloseTo(2, 0);
    expect(boardWidth).toBeLessThan(1400);
  });

  it('keeps the captured chart aspect instead of stretching it to the cell', () => {
    const cell = constructorXlsxImageExtent({ x: 0, y: 0, w: 6, h: 4 });
    const fitted = constructorXlsxFittedImage({ x: 0, y: 0, w: 6, h: 4 }, { width: 640, height: 360 });
    expect(fitted.ext.width / fitted.ext.height).toBeCloseTo(640 / 360, 2);
    expect(fitted.ext.width).toBeLessThanOrEqual(cell.width);
    expect(fitted.ext.height).toBeLessThanOrEqual(cell.height);
    expect(fitted.editAs).toBe('oneCell');
  });

  it('places a full-width chart on the next board row', () => {
    const top = constructorXlsxImageAnchor({ x: 0, y: 0, w: 6, h: 4 });
    const below = constructorXlsxImageAnchor({ x: 0, y: 4, w: 12, h: 3 });
    expect(below.tl.row).toBeCloseTo(top.br.row + CONSTRUCTOR_XLSX_IMAGE_PAD_ROW * 2);
    expect(below.tl.col).toBeCloseTo(CONSTRUCTOR_XLSX_IMAGE_PAD);
    expect(below.br.col).toBeCloseTo(12 - CONSTRUCTOR_XLSX_IMAGE_PAD);
    expect(constructorGridRowSpan([{ x: 0, y: 0, w: 6, h: 4 }, { x: 0, y: 4, w: 12, h: 3 }])).toBe(7);
  });

  it('keeps 1-based cell ranges aligned with image anchors', () => {
    const layout = { x: 3, y: 1, w: 4, h: 2 };
    const anchor = constructorXlsxImageAnchor(layout);
    const range = constructorXlsxCellRange(layout);
    expect(range.startCol).toBe(4);
    expect(range.endCol).toBe(7);
    expect(range.startRow).toBe(CONSTRUCTOR_XLSX_GRID_ORIGIN_ROW + CONSTRUCTOR_XLSX_ROWS_PER_UNIT + 1);
    expect(range.endRow).toBe(CONSTRUCTOR_XLSX_GRID_ORIGIN_ROW + 3 * CONSTRUCTOR_XLSX_ROWS_PER_UNIT);
    expect(anchor.tl.col).toBeGreaterThan(range.startCol - 1);
    expect(anchor.br.col).toBeLessThan(range.endCol);
    expect(anchor.tl.row).toBeGreaterThan(range.startRow - 1);
    expect(anchor.br.row).toBeLessThan(range.endRow);
  });

  it('sanitizes Excel sheet names', () => {
    expect(excelSheetName('Q3 / Проверки *дашборд*')).toBe('Q3 Проверки дашборд');
    expect(excelSheetName('')).toBe('Конструктор');
    expect(excelSheetName('а'.repeat(40)).length).toBe(31);
  });
});

describe('buildConstructorDashboardWorkbook', () => {
  it('writes one sheet with a chart image per widget in board order', async () => {
    const widgets = [
      widget('left', { x: 0, y: 0, w: 6, h: 4 }, 'KPI'),
      widget('right', { x: 6, y: 0, w: 6, h: 4 }, 'Виды'),
      widget('bottom', { x: 0, y: 4, w: 12, h: 3 }, 'Карта'),
    ];
    const workbook = buildConstructorDashboardWorkbook({
      title: 'Мой дашборд',
      meta: [
        ['Графиков на листе', '3'],
        ['Источники', 'Проверки'],
      ],
      widgets,
      captures: widgets.map((item) => capture(item.instanceId)),
    });

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Мой дашборд']);
    const sheet = workbook.worksheets[0];
    expect(sheet).toBeDefined();
    expect(sheet?.columnCount).toBeGreaterThanOrEqual(12);
    expect(sheet?.getColumn(1).width).toBe(CONSTRUCTOR_XLSX_COL_WIDTH);
    expect(sheet?.getCell('A1').value).toBe('Мой дашборд');
    expect(String(sheet?.getCell('A2').value)).toContain('Графиков на листе: 3');

    const images = sheet?.getImages() ?? [];
    expect(images).toHaveLength(3);
    expect(constructorXlsxHasChartImages(workbook)).toBe(true);

    const cols = images.map((image) => {
      const range = image.range as {
        tl?: { col: number; row: number };
        ext?: { width: number; height: number };
      };
      return {
        col: range.tl?.col ?? -1,
        row: range.tl?.row ?? -1,
        width: range.ext?.width ?? -1,
        height: range.ext?.height ?? -1,
      };
    });
    expect(cols[0]?.col).toBeLessThan(cols[1]?.col ?? 0);
    expect(cols[0]?.row).toBeCloseTo(cols[1]?.row ?? 0, 5);
    expect(cols[2]?.row).toBeGreaterThan(cols[0]?.row ?? 0);
    expect(cols[0]?.width).toBe(cols[1]?.width);
    expect((cols[0]?.width ?? 0) / (cols[0]?.height ?? 1)).toBeCloseTo(640 / 360, 2);

    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it('keeps the board slot and title when a chart snapshot is missing', () => {
    const widgets = [widget('missing', { x: 0, y: 0, w: 12, h: 3 }, 'Пустой график')];
    const workbook = buildConstructorDashboardWorkbook({
      title: 'Лист',
      meta: [],
      widgets,
      captures: [],
    });
    const sheet = workbook.worksheets[0];
    const range = constructorXlsxCellRange(widgets[0]!.layout);
    expect(sheet?.getCell(range.startRow, range.startCol).value).toBe('Пустой график');
    expect(sheet?.getImages() ?? []).toHaveLength(0);
  });
});
