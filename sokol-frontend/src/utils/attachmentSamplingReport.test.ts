import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { Check } from '../types/check';
import {
  buildAttachmentSamplingReport,
  buildAttachmentSamplingReportXlsx,
  getEmptyFolderEntries,
  NO_ATTACHMENTS_LABEL,
} from './attachmentSamplingReport';
import type { CheckFolderCounts } from './attachmentSamplingReport';

const baseCheck: Check = {
  id: '1',
  serial_number: '26KVS3P1',
  check_name: 'Проверка информационных технологий',
  short_name: 'ИТ',
  check_type: 'planned',
  check_view: 'complex',
  check_quarter: 'Q3',
  start_date: '2026-07-01',
  check_leader: 'Иванов И.И.',
  status: 'in_progress',
  created_at: '2026-01-01T00:00:00Z',
};

const secondCheck: Check = {
  ...baseCheck,
  id: '2',
  serial_number: '26KVS3P2',
  short_name: 'Кадры',
};

function makeRow(
  check: Check,
  folderName: string,
  counts: Partial<Record<'order' | 'program' | 'az' | 'dz', number>>,
): CheckFolderCounts {
  return {
    check,
    folderName,
    countsBySlot: {
      order: counts.order ?? 0,
      program: counts.program ?? 0,
      az: counts.az ?? 0,
      dz: counts.dz ?? 0,
    },
  };
}

describe('attachment sampling report', () => {
  it('marks empty folders and lists them in a dedicated column', () => {
    const rows = [
      makeRow(baseCheck, '26KVS3P1 ИТ', { order: 1, program: 0, az: 2, dz: 0 }),
      makeRow(secondCheck, '26KVS3P2 Кадры', { order: 0, program: 3, az: 0, dz: 1 }),
    ];
    const report = buildAttachmentSamplingReport(rows, ['order', 'program', 'az', 'dz']);
    const buffer = buildAttachmentSamplingReportXlsx(report);
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets['Отчет о выборке'];
    const grid = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });

    expect(grid[4]).toEqual(['Ключ', 'Проверка', 'Приказ', 'Программа', 'АЗ', 'ДЗ', 'Пустые папки']);
    expect(grid[5]).toEqual([
      '26KVS3P1',
      '26KVS3P1 ИТ',
      1,
      NO_ATTACHMENTS_LABEL,
      2,
      NO_ATTACHMENTS_LABEL,
      'Программа, ДЗ',
    ]);
    expect(grid[6]).toEqual([
      '26KVS3P2',
      '26KVS3P2 Кадры',
      NO_ATTACHMENTS_LABEL,
      3,
      NO_ATTACHMENTS_LABEL,
      1,
      'Приказ, АЗ',
    ]);
  });

  it('collects empty folder entries for UI warnings', () => {
    const rows = [
      makeRow(baseCheck, '26KVS3P1 ИТ', { order: 0 }),
    ];
    const report = buildAttachmentSamplingReport(rows, ['order', 'program']);
    expect(getEmptyFolderEntries(report)).toEqual([
      {
        folderName: '26KVS3P1 ИТ',
        serialNumber: '26KVS3P1',
        emptySlots: ['Приказ', 'Программа'],
      },
    ]);
  });
});
