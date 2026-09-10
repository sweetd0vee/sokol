import ExcelJS from 'exceljs';
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
import { dataUrlToUint8Array, fitImageSize, sheetNameForSection, stamp } from './shared';
import type { VisualAnalyticsKind, VisualExportMetaRow } from './types';

function hexToArgb(hex: string): string {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length === 6) {
    return `FF${normalized.toUpperCase()}`;
  }
  if (normalized.length === 8) {
    return normalized.toUpperCase();
  }
  return 'FF94A3B8';
}

function writeEffectivenessMatrixSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  chart: DashboardChartCapture,
  rows: EffectivenessMatrixRow[],
) {
  const sheet = workbook.addWorksheet(sheetName, {
    properties: { tabColor: { argb: 'FF065F46' } },
    views: [{ showGridLines: false }],
  });

  const headers = ['Ключ', 'Краткое название проверки', ...EFFECTIVENESS_MATRIX_COLUMNS.map((column) => column.label)];
  const keyColumnWidth = 18;
  const shortNameColumnWidth = 80;
  sheet.columns = [
    { width: keyColumnWidth },
    { width: shortNameColumnWidth },
    ...EFFECTIVENESS_MATRIX_COLUMNS.map(() => ({ width: 14 })),
  ];

  sheet.mergeCells(1, 1, 1, headers.length);
  sheet.getCell(1, 1).value = chart.title;
  sheet.getCell(1, 1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF003366' } };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, headers.length);
  sheet.getCell(2, 1).value = chart.description || 'Матрица оценок по проверкам за период (все строки выборки)';
  sheet.getCell(2, 1).font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
  sheet.getRow(2).height = 18;

  const headerRow = sheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    cell.alignment = { horizontal: index < 2 ? 'left' : 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
  headerRow.height = 22;

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(5 + rowIndex);
    const keyCell = excelRow.getCell(1);
    keyCell.value = row.key;
    keyCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
    keyCell.alignment = { horizontal: 'left', vertical: 'middle' };

    const shortNameCell = excelRow.getCell(2);
    const shortNameValue = row.shortName || '—';
    shortNameCell.value = shortNameValue;
    shortNameCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
    shortNameCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    // ExcelJS doesn't auto-resize row height for wrapped cells; estimate based on character count.
    const usableWidth = Math.max(Math.floor(shortNameColumnWidth * 0.75), 8);
    const wrappedLineCount = shortNameValue
      .toString()
      .split(/\r?\n/)
      .reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / usableWidth)), 0);

    EFFECTIVENESS_MATRIX_COLUMNS.forEach((column, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 3);
      const color = getEffectivenessToneColor(row.tones[column.key]);
      cell.value = null;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(color) } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      };
    });

    [1, 2].forEach((columnIndex) => {
      const cell = excelRow.getCell(columnIndex);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    const baseRowHeight = 18;
    excelRow.height = Math.min(72, Math.max(baseRowHeight, baseRowHeight * wrappedLineCount + 2));
  });

  const shareStartRow = 5 + rows.length + 2;
  sheet.mergeCells(shareStartRow, 1, shareStartRow, headers.length);
  const shareTitleCell = sheet.getCell(shareStartRow, 1);
  shareTitleCell.value = 'Доля оценок';
  shareTitleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF003366' } };
  sheet.getRow(shareStartRow).height = 20;

  const shareHeaderRow = sheet.getRow(shareStartRow + 1);
  ['Раздел', 'Доля оценок'].forEach((header, index) => {
    const cell = shareHeaderRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
  shareHeaderRow.height = 22;

  EFFECTIVENESS_MATRIX_COLUMNS.forEach((column, index) => {
    const excelRow = sheet.getRow(shareStartRow + 2 + index);
    const areaCell = excelRow.getCell(1);
    areaCell.value = column.label;
    areaCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    areaCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };

    const shares = buildEffectivenessColumnShares(rows, column.key);
    const shareCell = excelRow.getCell(2);
    shareCell.value = shares.map((share) => `${share.label}: ${share.percent}% (${share.count})`).join('; ') || '—';
    shareCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    shareCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };

    [1, 2].forEach((columnIndex) => {
      const cell = excelRow.getCell(columnIndex);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    excelRow.height = 28;
  });

  const legendStartRow = shareStartRow + 2 + EFFECTIVENESS_MATRIX_COLUMNS.length + 2;
  sheet.mergeCells(legendStartRow, 1, legendStartRow, headers.length);
  const legendTitleCell = sheet.getCell(legendStartRow, 1);
  legendTitleCell.value = 'Легенда';
  legendTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF003366' } };
  sheet.getRow(legendStartRow).height = 18;

  EFFECTIVENESS_LEGEND.forEach((item, index) => {
    const excelRow = sheet.getRow(legendStartRow + 1 + index);
    const swatchCell = excelRow.getCell(1);
    swatchCell.value = null;
    swatchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(item.color) } };
    swatchCell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };

    const labelCell = excelRow.getCell(2);
    labelCell.value = item.label;
    labelCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
    excelRow.height = 18;
  });

  const totalRow = legendStartRow + 1 + EFFECTIVENESS_LEGEND.length + 1;
  sheet.mergeCells(totalRow, 1, totalRow, headers.length);
  const totalCell = sheet.getCell(totalRow, 1);
  totalCell.value = `Итого: ${formatEffectivenessChecksCount(rows.length)}`;
  totalCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
  sheet.getRow(totalRow).height = 18;
}

function writeMaterialityMatrixSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  chart: DashboardChartCapture,
  rows: MaterialityMatrixRow[],
) {
  const sheet = workbook.addWorksheet(sheetName, {
    properties: { tabColor: { argb: 'FFBE123C' } },
    views: [{ showGridLines: false }],
  });

  const headers = [
    'Ключ',
    'Краткое название проверки',
    ...MATERIALITY_MATRIX_COLUMNS.map((column) => column.label),
    MATERIALITY_MATRIX_TOTAL_COLUMN.label,
  ];
  const keyColumnWidth = 18;
  const shortNameColumnWidth = 72;
  sheet.columns = [
    { width: keyColumnWidth },
    { width: shortNameColumnWidth },
    ...MATERIALITY_MATRIX_COLUMNS.map(() => ({ width: 14 })),
    { width: 22 },
  ];

  sheet.mergeCells(1, 1, 1, headers.length);
  sheet.getCell(1, 1).value = chart.title;
  sheet.getCell(1, 1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF003366' } };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, headers.length);
  sheet.getCell(2, 1).value = chart.description || 'Матрица существенности (все строки выборки)';
  sheet.getCell(2, 1).font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
  sheet.getRow(2).height = 18;

  const headerRow = sheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE123C' } };
    cell.alignment = { horizontal: index < 2 ? 'left' : 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
  headerRow.height = 22;

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(5 + rowIndex);
    const keyCell = excelRow.getCell(1);
    keyCell.value = row.key;
    keyCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
    keyCell.alignment = { horizontal: 'left', vertical: 'middle' };

    const shortNameCell = excelRow.getCell(2);
    const shortNameValue = row.shortName || '—';
    shortNameCell.value = shortNameValue;
    shortNameCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
    shortNameCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    const usableWidth = Math.max(Math.floor(shortNameColumnWidth * 0.75), 8);
    const wrappedLineCount = shortNameValue
      .toString()
      .split(/\r?\n/)
      .reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / usableWidth)), 0);

    MATERIALITY_MATRIX_COLUMNS.forEach((column, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 3);
      const count = getMaterialityMatrixCount(row, column.key);
      const color = getMaterialityChartColor(column.level);
      cell.value = count;
      cell.font = {
        name: 'Calibri',
        size: 11,
        bold: true,
        color: { argb: 'FF1E293B' },
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(color) } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      };
    });

    const totalCell = excelRow.getCell(MATERIALITY_MATRIX_COLUMNS.length + 3);
    totalCell.value = row.total;
    totalCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
    totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totalCell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };

    [1, 2].forEach((columnIndex) => {
      const cell = excelRow.getCell(columnIndex);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    excelRow.height = Math.min(72, Math.max(18, 18 * wrappedLineCount + 2));
  });

  const totals = buildMaterialityMatrixColumnTotals(rows);
  const grandTotal = materialityMatrixGrandTotal(rows);
  const shareStartRow = 5 + rows.length + 2;
  sheet.mergeCells(shareStartRow, 1, shareStartRow, headers.length);
  const shareTitleCell = sheet.getCell(shareStartRow, 1);
  shareTitleCell.value = 'Доля рекомендаций';
  shareTitleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF003366' } };
  sheet.getRow(shareStartRow).height = 20;

  const shareHeaderRow = sheet.getRow(shareStartRow + 1);
  ['Уровень', 'Доля рекомендаций'].forEach((header, index) => {
    const cell = shareHeaderRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
  shareHeaderRow.height = 22;

  MATERIALITY_MATRIX_COLUMNS.forEach((column, index) => {
    const excelRow = sheet.getRow(shareStartRow + 2 + index);
    const count = totals[column.key];
    const percent = grandTotal === 0 ? 0 : Math.round((count / grandTotal) * 100);
    const areaCell = excelRow.getCell(1);
    areaCell.value = column.label;
    areaCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    const shareCell = excelRow.getCell(2);
    shareCell.value = `${percent}% (${count})`;
    shareCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    [1, 2].forEach((columnIndex) => {
      const cell = excelRow.getCell(columnIndex);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    excelRow.height = 22;
  });

  const legendStartRow = shareStartRow + 2 + MATERIALITY_MATRIX_COLUMNS.length + 2;
  sheet.mergeCells(legendStartRow, 1, legendStartRow, headers.length);
  const legendTitleCell = sheet.getCell(legendStartRow, 1);
  legendTitleCell.value = 'Легенда';
  legendTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF003366' } };

  MATERIALITY_MATRIX_LEGEND.forEach((item, index) => {
    const excelRow = sheet.getRow(legendStartRow + 1 + index);
    const swatchCell = excelRow.getCell(1);
    swatchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(item.color) } };
    swatchCell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
    const labelCell = excelRow.getCell(2);
    labelCell.value = item.label;
    labelCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    excelRow.height = 18;
  });

  const totalRow = legendStartRow + 1 + MATERIALITY_MATRIX_LEGEND.length + 1;
  sheet.mergeCells(totalRow, 1, totalRow, headers.length);
  sheet.getCell(totalRow, 1).value = `Итого: ${formatMaterialityChecksCount(rows.length)}`;
  sheet.getCell(totalRow, 1).font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
}

function writeStatusMatrixSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  chart: DashboardChartCapture,
  rows: StatusMatrixRow[],
) {
  const sheet = workbook.addWorksheet(sheetName, {
    properties: { tabColor: { argb: 'FF0891B2' } },
    views: [{ showGridLines: false }],
  });

  const headers = [
    'Ключ проверки',
    'Краткое название проверки',
    ...STATUS_MATRIX_COLUMNS.map((column) => column.label),
  ];
  const keyColumnWidth = 18;
  const shortNameColumnWidth = 72;
  sheet.columns = [
    { width: keyColumnWidth },
    { width: shortNameColumnWidth },
    ...STATUS_MATRIX_COLUMNS.map(() => ({ width: 16 })),
  ];

  sheet.mergeCells(1, 1, 1, headers.length);
  sheet.getCell(1, 1).value = chart.title;
  sheet.getCell(1, 1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF003366' } };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, headers.length);
  sheet.getCell(2, 1).value = chart.description || 'Матрица статусов по проверкам за период (все строки выборки)';
  sheet.getCell(2, 1).font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
  sheet.getRow(2).height = 18;

  const headerRow = sheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0891B2' } };
    cell.alignment = { horizontal: index < 2 ? 'left' : 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
  headerRow.height = 22;

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(5 + rowIndex);
    const keyCell = excelRow.getCell(1);
    keyCell.value = row.key;
    keyCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
    keyCell.alignment = { horizontal: 'left', vertical: 'middle' };

    const shortNameCell = excelRow.getCell(2);
    const shortNameValue = row.shortName || '—';
    shortNameCell.value = shortNameValue;
    shortNameCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
    shortNameCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    const usableWidth = Math.max(Math.floor(shortNameColumnWidth * 0.75), 8);
    const wrappedLineCount = shortNameValue
      .toString()
      .split(/\r?\n/)
      .reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / usableWidth)), 0);

    STATUS_MATRIX_COLUMNS.forEach((column, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 3);
      cell.value = getStatusMatrixCount(row, column.key);
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });

    [1, 2].forEach((columnIndex) => {
      const cell = excelRow.getCell(columnIndex);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    excelRow.height = Math.min(72, Math.max(18, 18 * wrappedLineCount + 2));
  });

  const shares = buildStatusMatrixColumnShares(rows);
  const shareStartRow = 5 + rows.length + 2;
  sheet.mergeCells(shareStartRow, 1, shareStartRow, headers.length);
  const shareTitleCell = sheet.getCell(shareStartRow, 1);
  shareTitleCell.value = 'Доля рекомендаций';
  shareTitleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF003366' } };
  sheet.getRow(shareStartRow).height = 20;

  const shareHeaderRow = sheet.getRow(shareStartRow + 1);
  ['Статус', 'Доля рекомендаций'].forEach((header, index) => {
    const cell = shareHeaderRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
  shareHeaderRow.height = 22;

  shares.forEach((share, index) => {
    const excelRow = sheet.getRow(shareStartRow + 2 + index);
    const areaCell = excelRow.getCell(1);
    areaCell.value = share.label;
    areaCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    const shareCell = excelRow.getCell(2);
    shareCell.value = `${share.percent}% (${share.count})`;
    shareCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    [1, 2].forEach((columnIndex) => {
      const cell = excelRow.getCell(columnIndex);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    excelRow.height = 22;
  });

  const legendStartRow = shareStartRow + 2 + STATUS_MATRIX_COLUMNS.length + 2;
  sheet.mergeCells(legendStartRow, 1, legendStartRow, headers.length);
  const legendTitleCell = sheet.getCell(legendStartRow, 1);
  legendTitleCell.value = 'Легенда';
  legendTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF003366' } };

  STATUS_MATRIX_LEGEND.forEach((item, index) => {
    const excelRow = sheet.getRow(legendStartRow + 1 + index);
    const swatchCell = excelRow.getCell(1);
    swatchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(item.color) } };
    swatchCell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
    const labelCell = excelRow.getCell(2);
    labelCell.value = item.label;
    labelCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    excelRow.height = 18;
  });

  const totalRow = legendStartRow + 1 + STATUS_MATRIX_LEGEND.length + 1;
  sheet.mergeCells(totalRow, 1, totalRow, headers.length);
  sheet.getCell(totalRow, 1).value = `Итого: ${formatStatusChecksCount(rows.length)}`;
  sheet.getCell(totalRow, 1).font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
}

export async function buildVisualXlsx(options: {
  documentTitle: string;
  meta: VisualExportMetaRow[];
  charts: DashboardChartCapture[];
  kind: VisualAnalyticsKind;
  filenamePrefix: string;
  effectivenessMatrix?: EffectivenessMatrixRow[];
  materialityMatrix?: MaterialityMatrixRow[];
  statusMatrix?: StatusMatrixRow[];
}) {
  const { documentTitle, meta, charts, kind, filenamePrefix, effectivenessMatrix, materialityMatrix, statusMatrix } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SOKOL';
  workbook.created = new Date();

  const cover = workbook.addWorksheet('Обложка', {
    properties: { tabColor: { argb: 'FF003366' } },
    views: [{ showGridLines: false }],
  });
  cover.columns = [{ width: 28 }, { width: 56 }];
  cover.mergeCells('A1:B1');
  cover.getCell('A1').value = documentTitle;
  cover.getCell('A1').font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF003366' } };
  cover.getCell('A2').value =
    'Выбранные дашборды экспортированы как изображения; матрицы — полными таблицами';
  cover.getCell('A2').font = { name: 'Calibri', size: 11, color: { argb: 'FF64748B' } };
  cover.mergeCells('A2:B2');

  meta.forEach(([label, value], index) => {
    const row = index + 4;
    cover.getCell(`A${row}`).value = label;
    cover.getCell(`A${row}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF003366' } };
    cover.getCell(`B${row}`).value = value;
    cover.getCell(`B${row}`).font = { name: 'Calibri', size: 11, color: { argb: 'FF334155' } };
  });

  const usedNames = new Set<string>(['Обложка']);
  let writtenSheets = 0;
  let wroteEffectivenessMatrix = false;
  let wroteMaterialityMatrix = false;
  let wroteStatusMatrix = false;

  const writeMatrixIfNeeded = (chart?: DashboardChartCapture) => {
    if (!effectivenessMatrix?.length || wroteEffectivenessMatrix) {
      return;
    }
    let sheetName = sheetNameForSection(kind, 'effectivenessMatrix', chart?.title || 'Оценка эффективности');
    if (usedNames.has(sheetName)) {
      sheetName = `${sheetName.slice(0, 28)}_matrix`;
    }
    usedNames.add(sheetName);
    writeEffectivenessMatrixSheet(
      workbook,
      sheetName,
      chart ?? {
        id: 'effectivenessMatrix',
        title: 'Оценка эффективности',
        description: 'Матрица оценок по проверкам за период (все строки выборки)',
        dataUrl: '',
        width: 960,
        height: 540,
      },
      effectivenessMatrix,
    );
    wroteEffectivenessMatrix = true;
    writtenSheets += 1;
  };

  const writeMaterialityMatrixIfNeeded = (chart?: DashboardChartCapture) => {
    if (!materialityMatrix?.length || wroteMaterialityMatrix) {
      return;
    }
    let sheetName = sheetNameForSection(kind, 'materialityMatrix', chart?.title || 'Матрица существенности');
    if (usedNames.has(sheetName)) {
      sheetName = `${sheetName.slice(0, 28)}_matrix`;
    }
    usedNames.add(sheetName);
    writeMaterialityMatrixSheet(
      workbook,
      sheetName,
      chart ?? {
        id: 'materialityMatrix',
        title: 'Матрица существенности',
        description: 'Матрица существенности (все строки выборки)',
        dataUrl: '',
        width: 960,
        height: 540,
      },
      materialityMatrix,
    );
    wroteMaterialityMatrix = true;
    writtenSheets += 1;
  };

  const writeStatusMatrixIfNeeded = (chart?: DashboardChartCapture) => {
    if (!statusMatrix?.length || wroteStatusMatrix) {
      return;
    }
    let sheetName = sheetNameForSection(kind, 'statusMatrix', chart?.title || 'Матрица статусов');
    if (usedNames.has(sheetName)) {
      sheetName = `${sheetName.slice(0, 28)}_matrix`;
    }
    usedNames.add(sheetName);
    writeStatusMatrixSheet(
      workbook,
      sheetName,
      chart ?? {
        id: 'statusMatrix',
        title: 'Матрица статусов',
        description: 'Матрица статусов по проверкам за период (все строки выборки)',
        dataUrl: '',
        width: 960,
        height: 540,
      },
      statusMatrix,
    );
    wroteStatusMatrix = true;
    writtenSheets += 1;
  };

  for (const [index, chart] of charts.entries()) {
    if (chart.id === 'effectivenessMatrix') {
      writeMatrixIfNeeded(chart);
      continue;
    }
    if (chart.id === 'materialityMatrix') {
      writeMaterialityMatrixIfNeeded(chart);
      continue;
    }
    if (chart.id === 'statusMatrix') {
      writeStatusMatrixIfNeeded(chart);
      continue;
    }

    let sheetName = sheetNameForSection(kind, chart.id, chart.title);
    if (usedNames.has(sheetName)) {
      sheetName = `${sheetName.slice(0, 28)}_${index + 1}`;
    }
    usedNames.add(sheetName);

    const hasPng =
      chart.dataUrl.startsWith('data:image/png;base64,') && Boolean(chart.dataUrl.split(',')[1]);
    if (!hasPng) {
      continue;
    }

    const sheet = workbook.addWorksheet(sheetName, {
      properties: { tabColor: { argb: 'FF4F7FA8' } },
      views: [{ showGridLines: false }],
    });
    sheet.columns = [{ width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = chart.title;
    sheet.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF003366' } };
    sheet.getRow(1).height = 24;
    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').value = chart.description;
    sheet.getCell('A2').font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
    sheet.getRow(2).height = 18;

    const imageId = workbook.addImage({
      // ExcelJS strips a data-URL prefix at the first comma; keep a full data URL.
      base64: chart.dataUrl.startsWith('data:')
        ? chart.dataUrl
        : `data:image/png;base64,${chart.dataUrl}`,
      extension: 'png',
    });

    const fitted = fitImageSize(chart.width * 2, chart.height * 2, 960, 520);
    sheet.addImage(imageId, {
      tl: { col: 0.15, row: 2.8 },
      ext: { width: fitted.width, height: fitted.height },
      editAs: 'oneCell',
    });
    sheet.getRow(20).height = Math.max(Math.round(fitted.height * 0.75), 120);
    writtenSheets += 1;
  }

  writeMatrixIfNeeded();
  writeMaterialityMatrixIfNeeded();
  writeStatusMatrixIfNeeded();

  if (writtenSheets === 0) {
    throw new Error('Не удалось сформировать листы дашбордов для Excel. Обновите страницу и попробуйте снова.');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${stamp()}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
