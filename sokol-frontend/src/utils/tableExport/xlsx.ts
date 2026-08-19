import * as XLSX from 'xlsx-js-style';
import ExcelJS from 'exceljs';
import type { Check } from '../../types/check';
import type { Recommendation } from '../../types/recommendation';
import { downloadBlob } from '../download';
import { indicatorIconBytesToDataUrl, preloadIndicatorIcons } from '../exportIndicatorIcons';
import type { ExportRow } from './types';
import {
  BORDER_GRAY,
  CHECK_COLUMN_KEYS,
  getHeaders,
  getHighlightFill,
  getMaterialityDotColor,
  HEADER_BLUE,
  INDICATOR_ICON_DISPLAY_PX,
  isIndicatorHeader,
  isMaterialityHeader,
  MATERIALITY_DOT_CHAR,
  RECOMMENDATION_TABLE_COLUMN_KEYS,
  RECOMMENDATION_XLSX_DEFAULT_COLUMN_WIDTH,
  RECOMMENDATION_XLSX_LINE_HEIGHT,
  RECOMMENDATION_XLSX_MAX_ROW_HEIGHT,
  RECOMMENDATION_XLSX_MIN_ROW_HEIGHT,
  RECOMMENDATION_XLSX_COLUMN_WIDTHS,
  TIMES_NEW_ROMAN_12,
  toCellText,
  toCheckRows,
  toRecommendationTableRows,
  WHITE,
} from './shared';

export function getCellBorderStyle() {
  return {
    top: { style: 'thin' as const, color: { rgb: BORDER_GRAY } },
    bottom: { style: 'thin' as const, color: { rgb: BORDER_GRAY } },
    left: { style: 'thin' as const, color: { rgb: BORDER_GRAY } },
    right: { style: 'thin' as const, color: { rgb: BORDER_GRAY } },
  };
}

export function getRecommendationXlsxColumnWidth(header: string) {
  return RECOMMENDATION_XLSX_COLUMN_WIDTHS[header] ?? RECOMMENDATION_XLSX_DEFAULT_COLUMN_WIDTH;
}

export function estimateWrappedLineCount(value: unknown, width: number) {
  const text = toCellText(value).trim();
  if (!text) {
    return 1;
  }
  const usableWidth = Math.max(Math.floor(width * 0.75), 8);
  return text
    .split(/\r?\n/)
    .reduce((lines, part) => lines + Math.max(1, Math.ceil(part.length / usableWidth)), 0);
}

export function getRecommendationXlsxRowHeight(row: ExportRow, headers: string[]) {
  const maxLineCount = headers.reduce((max, header) => {
    if (isMaterialityHeader(header) || isIndicatorHeader(header)) {
      return max;
    }
    return Math.max(
      max,
      estimateWrappedLineCount(row[header], getRecommendationXlsxColumnWidth(header)),
    );
  }, 1);

  return Math.min(
    Math.max(RECOMMENDATION_XLSX_MIN_ROW_HEIGHT, maxLineCount * RECOMMENDATION_XLSX_LINE_HEIGHT + 8),
    RECOMMENDATION_XLSX_MAX_ROW_HEIGHT,
  );
}

export function applySheetTableStyle(ws: XLSX.WorkSheet, headers: string[], rows: ExportRow[]) {
  const ref = ws['!ref'];
  if (!ref) {
    return;
  }
  const range = XLSX.utils.decode_range(ref);
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = ws[cellAddress];
      if (!cell) {
        continue;
      }
      const isHeader = row === range.s.r;
      const header = headers[col - range.s.c];
      const materialityColor =
        !isHeader && isMaterialityHeader(header) ? getMaterialityDotColor(cell.v) : undefined;

      if (materialityColor) {
        cell.v = MATERIALITY_DOT_CHAR;
        cell.t = 's';
        cell.w = MATERIALITY_DOT_CHAR;
        cell.s = {
          ...(cell.s ?? {}),
          font: {
            name: 'Segoe UI Symbol',
            sz: 16,
            color: { rgb: materialityColor },
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center',
          },
          border: getCellBorderStyle(),
        };
        continue;
      }

      if (!isHeader && isIndicatorHeader(header)) {
        // Recommendation XLSX uses ExcelJS with embedded icon images instead.
        cell.v = '';
        cell.t = 's';
        cell.s = {
          ...(cell.s ?? {}),
          alignment: { horizontal: 'center', vertical: 'center' },
          border: getCellBorderStyle(),
        };
        continue;
      }

      const valueFill = !isHeader ? getHighlightFill(header, cell.v) : undefined;
      cell.s = {
        ...(cell.s ?? {}),
        font: {
          ...TIMES_NEW_ROMAN_12,
          bold: isHeader,
          color: isHeader ? { rgb: WHITE } : { rgb: '111827' },
        },
        fill: isHeader
          ? { fgColor: { rgb: HEADER_BLUE } }
          : valueFill
            ? { fgColor: { rgb: valueFill } }
            : undefined,
        alignment: {
          horizontal: isHeader || valueFill ? 'center' : 'left',
          vertical: 'center',
          wrapText: true,
        },
        border: getCellBorderStyle(),
      };
    }
  }
  ws['!cols'] = headers.map((header) => {
    if (isMaterialityHeader(header) || isIndicatorHeader(header)) {
      return { wch: 14 };
    }
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => toCellText(row[header]).length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 12), 42) };
  });
}

export function excelBorder() {
  const edge = { style: 'thin' as const, color: { argb: `FF${BORDER_GRAY}` } };
  return { top: edge, bottom: edge, left: edge, right: edge };
}

export async function exportRecommendationsTableXlsx(
  recommendations: Recommendation[],
  checks: Check[],
  filename: string,
  yearlyNumbers: Map<string, number>,
) {
  const rows = toRecommendationTableRows(recommendations, checks, yearlyNumbers);
  const headers = getHeaders(rows, RECOMMENDATION_TABLE_COLUMN_KEYS);
  const indicatorIcons = await preloadIndicatorIcons(rows.map((row) => toCellText(row.Индикатор)));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Рекомендации');
  const headerRow = sheet.addRow(headers);
  headerRow.height = 34;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: `FF${WHITE}` } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${HEADER_BLUE}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = excelBorder();
  });

  const indicatorColIndex = headers.indexOf('Индикатор');
  const iconIds = new Map<string, number>();
  indicatorIcons.forEach((bytes, label) => {
    iconIds.set(
      label,
      workbook.addImage({
        base64: indicatorIconBytesToDataUrl(bytes).split(',')[1] ?? '',
        extension: 'png',
      })
    );
  });

  rows.forEach((row, rowOffset) => {
    const values = headers.map((header) => {
      if (isIndicatorHeader(header)) {
        return '';
      }
      if (isMaterialityHeader(header)) {
        return MATERIALITY_DOT_CHAR;
      }
      return toCellText(row[header]);
    });
    const excelRow = sheet.addRow(values);
    excelRow.height = getRecommendationXlsxRowHeight(row, headers);
    excelRow.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      const rawValue = row[header ?? ''];
      const fill = getHighlightFill(header, rawValue);
      const isMateriality = isMaterialityHeader(header);
      const isIndicator = isIndicatorHeader(header);

      cell.border = excelBorder();
      cell.alignment = {
        horizontal: fill || isMateriality || isIndicator ? 'center' : 'left',
        vertical: 'middle',
        wrapText: !isMateriality && !isIndicator,
      };

      if (isMateriality) {
        cell.font = {
          name: 'Segoe UI Symbol',
          size: 16,
          color: { argb: `FF${getMaterialityDotColor(rawValue) ?? '9CA3AF'}` },
        };
        return;
      }

      if (isIndicator) {
        cell.font = { name: 'Times New Roman', size: 12, color: { argb: 'FF111827' } };
        return;
      }

      cell.font = {
        name: 'Times New Roman',
        size: 12,
        color: { argb: 'FF111827' },
      };
      if (fill) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${fill}` },
        };
      }
    });

    if (indicatorColIndex >= 0) {
      const label = toCellText(row.Индикатор);
      const imageId = iconIds.get(label);
      if (imageId !== undefined) {
        sheet.addImage(imageId, {
          tl: { col: indicatorColIndex + 0.35, row: rowOffset + 1.2 },
          ext: { width: INDICATOR_ICON_DISPLAY_PX, height: INDICATOR_ICON_DISPLAY_PX },
          editAs: 'oneCell',
        });
      }
    }
  });

  headers.forEach((header, index) => {
    sheet.getColumn(index + 1).width = getRecommendationXlsxColumnWidth(header);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename
  );
}

export function exportChecksXlsx(checks: Check[], filename: string, yearlyNumbers: Map<string, number>) {
  const rows = toCheckRows(checks, yearlyNumbers);
  const ws = XLSX.utils.json_to_sheet(rows);
  applySheetTableStyle(ws, getHeaders(rows, CHECK_COLUMN_KEYS), rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Проверки');
  XLSX.writeFile(wb, filename);
}
