import { describe, expect, it } from 'vitest';
import type { Check } from '../types/check';
import { buildCheckFolderName, sanitizePathSegment } from './exportCheckAttachments';

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

describe('sanitizePathSegment', () => {
  it('removes invalid filesystem characters', () => {
    expect(sanitizePathSegment('file:name?.docx')).toBe('file_name_.docx');
  });

  it('trims trailing dots and spaces', () => {
    expect(sanitizePathSegment('folder name. ')).toBe('folder name');
  });
});

describe('buildCheckFolderName', () => {
  it('combines key and short name', () => {
    expect(buildCheckFolderName(baseCheck)).toBe('26KVS3P1 ИТ');
  });

  it('uses only key when short name is missing', () => {
    expect(buildCheckFolderName({ ...baseCheck, short_name: undefined })).toBe('26KVS3P1');
  });
});
