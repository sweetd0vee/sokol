import { describe, expect, it } from 'vitest';
import { filesWord, formatFileSize, getFileExtension } from './fileHelpers';

describe('formatFileSize', () => {
  it('formats bytes, kilobytes and megabytes', () => {
    expect(formatFileSize(512)).toBe('512 Б');
    expect(formatFileSize(2048)).toBe('2.0 КБ');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 МБ');
  });
});

describe('getFileExtension', () => {
  it('returns uppercase extension or fallback', () => {
    expect(getFileExtension('report.docx')).toBe('DOCX');
    expect(getFileExtension('readme')).toBe('файл');
  });
});

describe('filesWord', () => {
  it('declines Russian file count', () => {
    expect(filesWord(1)).toBe('файл');
    expect(filesWord(2)).toBe('файла');
    expect(filesWord(5)).toBe('файлов');
    expect(filesWord(11)).toBe('файлов');
    expect(filesWord(21)).toBe('файл');
  });
});
