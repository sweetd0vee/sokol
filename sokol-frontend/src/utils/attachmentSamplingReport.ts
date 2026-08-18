import * as XLSX from 'xlsx-js-style';
import type { Check } from '../types/check';
import { ATTACHMENT_SLOT_LABELS, type AttachmentSlot } from './checkAttachments';

export const NO_ATTACHMENTS_LABEL = 'нет вложений';

export type CheckFolderCounts = {
  check: Check;
  folderName: string;
  countsBySlot: Record<AttachmentSlot, number>;
};

export type AttachmentSamplingReport = {
  rows: CheckFolderCounts[];
  selectedSlots: AttachmentSlot[];
  exportedAt: Date;
};

function formatExportDate(date: Date): string {
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCountValue(count: number): string | number {
  return count > 0 ? count : NO_ATTACHMENTS_LABEL;
}

function getEmptySlots(row: CheckFolderCounts, selectedSlots: AttachmentSlot[]): string[] {
  return selectedSlots
    .filter((slot) => row.countsBySlot[slot] === 0)
    .map((slot) => ATTACHMENT_SLOT_LABELS[slot]);
}

export function buildAttachmentSamplingReport(
  rows: CheckFolderCounts[],
  selectedSlots: AttachmentSlot[],
  exportedAt: Date = new Date(),
): AttachmentSamplingReport {
  return { rows, selectedSlots, exportedAt };
}

export function getEmptyFolderEntries(report: AttachmentSamplingReport): Array<{
  folderName: string;
  serialNumber: string;
  emptySlots: string[];
}> {
  return report.rows
    .map((row) => ({
      folderName: row.folderName,
      serialNumber: row.check.serial_number,
      emptySlots: getEmptySlots(row, report.selectedSlots),
    }))
    .filter((entry) => entry.emptySlots.length > 0);
}

const HEADER_STYLE = {
  font: { name: 'Times New Roman', sz: 12, bold: true },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  fill: { fgColor: { rgb: 'D9E1F2' } },
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  },
};

const CELL_STYLE = {
  font: { name: 'Times New Roman', sz: 12 },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: HEADER_STYLE.border,
};

const EMPTY_CELL_STYLE = {
  ...CELL_STYLE,
  font: { ...CELL_STYLE.font, color: { rgb: '9C0006' } },
  fill: { fgColor: { rgb: 'FFC7CE' } },
};

function setStyledCell(
  ws: XLSX.WorkSheet,
  row: number,
  col: number,
  value: string | number,
  style: typeof CELL_STYLE,
) {
  const address = XLSX.utils.encode_cell({ r: row, c: col });
  ws[address] = {
    v: value,
    t: typeof value === 'number' ? 'n' : 's',
    s: style,
  };
}

export function buildAttachmentSamplingReportXlsx(report: AttachmentSamplingReport): Uint8Array {
  const { rows, selectedSlots, exportedAt } = report;
  const ws: XLSX.WorkSheet = {};
  const slotColumnOffset = 2;
  const headers = [
    'Ключ',
    'Проверка',
    ...selectedSlots.map((slot) => ATTACHMENT_SLOT_LABELS[slot]),
    'Пустые папки',
  ];

  let currentRow = 0;
  setStyledCell(ws, currentRow, 0, 'Отчет о выборке вложений', {
    ...CELL_STYLE,
    font: { ...CELL_STYLE.font, bold: true },
  });
  currentRow += 1;
  setStyledCell(ws, currentRow, 0, `Дата экспорта: ${formatExportDate(exportedAt)}`, CELL_STYLE);
  currentRow += 1;
  setStyledCell(ws, currentRow, 0, `Проверок в выборке: ${rows.length}`, CELL_STYLE);
  currentRow += 2;

  headers.forEach((header, col) => {
    setStyledCell(ws, currentRow, col, header, HEADER_STYLE);
  });

  rows.forEach((row, rowIndex) => {
    const sheetRow = currentRow + 1 + rowIndex;
    setStyledCell(ws, sheetRow, 0, row.check.serial_number, CELL_STYLE);
    setStyledCell(ws, sheetRow, 1, row.folderName, CELL_STYLE);

    selectedSlots.forEach((slot, slotIndex) => {
      const count = row.countsBySlot[slot];
      const value = formatCountValue(count);
      setStyledCell(
        ws,
        sheetRow,
        slotColumnOffset + slotIndex,
        value,
        count === 0 ? EMPTY_CELL_STYLE : CELL_STYLE,
      );
    });

    const emptySlots = getEmptySlots(row, selectedSlots);
    setStyledCell(
      ws,
      sheetRow,
      slotColumnOffset + selectedSlots.length,
      emptySlots.length > 0 ? emptySlots.join(', ') : '—',
      emptySlots.length > 0 ? EMPTY_CELL_STYLE : CELL_STYLE,
    );
  });

  const lastRow = currentRow + rows.length;
  const lastCol = headers.length - 1;
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: lastRow, c: lastCol },
  });
  ws['!cols'] = headers.map((header, index) => ({
    wch: index === 1 ? 28 : index === headers.length - 1 ? 24 : 14,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Отчет о выборке');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}
