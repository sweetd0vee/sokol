export const EXPORT_FORMATS = [
  { value: 'xlsx', label: 'XLSX' },
  { value: 'docx', label: 'DOCX' },
  { value: 'pdf', label: 'PDF' },
  { value: 'html', label: 'HTML' },
] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number]['value'];

export type ExportRow = Record<string, unknown>;
