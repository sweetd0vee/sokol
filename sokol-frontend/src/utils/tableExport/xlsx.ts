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
  toCellText,
  toCheckRows,
  toRecommendationTableRows,
  WHITE,
} from './shared';

const CHECK_XLSX_COLUMN_WIDTHS: Record<string, number> = {
  ID: 10,
  Ключ: 14,
  'Название проверки': 48,
  'Тип проверки': 16,
  Вид: 22,
  'Краткое название': 28,
  'Квартал проверки': 16,
  'Дата начала': 14,
  'Дата окончания': 16,
  'Руководитель проверки': 26,
  Статус: 16,
  'Номер приказа': 16,
  'Дата приказа': 14,
  'Номер программы': 16,
  'Дата программы': 16,
  'Номер АЗ': 14,
  'Дата АЗ': 14,
  'Номер ДЗ': 14,
  'Дата ДЗ': 14,
  Процесс: 16,
  СВК: 14,
  СУР: 14,
  СВИК: 14,
};
const CHECK_XLSX_WRAP_HEADERS = new Set(['Название проверки', 'Краткое название']);

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

export async function buildChecksXlsxBuffer(checks: Check[], yearlyNumbers: Map<string, number>) {
  const rows = toCheckRows(checks, yearlyNumbers);
  const headers = getHeaders(rows, CHECK_COLUMN_KEYS);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Проверки', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: false,
      scale: 100,
    },
  });

  headers.forEach((header, index) => {
    sheet.getColumn(index + 1).width = CHECK_XLSX_COLUMN_WIDTHS[header] ?? 16;
  });

  const headerRow = sheet.addRow(headers);
  headerRow.height = 22;
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

  const nameWidth = CHECK_XLSX_COLUMN_WIDTHS['Название проверки'] ?? 48;
  rows.forEach((row) => {
    const excelRow = sheet.addRow(headers.map((header) => toCellText(row[header])));
    excelRow.height = Math.min(
      72,
      Math.max(18, estimateWrappedLineCount(row['Название проверки'], nameWidth) * 15),
    );
    excelRow.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      const fill = getHighlightFill(header, row[header ?? '']);
      cell.border = excelBorder();
      cell.alignment = {
        horizontal: fill || header === 'ID' || header === 'Статус' ? 'center' : 'left',
        vertical: 'middle',
        wrapText: header !== undefined && CHECK_XLSX_WRAP_HEADERS.has(header),
      };
      cell.font = { name: 'Times New Roman', size: 12, color: { argb: 'FF111827' } };
      if (fill) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${fill}` },
        };
      }
    });
  });

  return workbook.xlsx.writeBuffer();
}

export async function exportChecksXlsx(
  checks: Check[],
  filename: string,
  yearlyNumbers: Map<string, number>,
) {
  const buffer = await buildChecksXlsxBuffer(checks, yearlyNumbers);
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  );
}
