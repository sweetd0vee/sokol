export const DEFAULT_MAX_UPLOAD_MB = 100;
export const DEFAULT_MAX_UPLOAD_BYTES = DEFAULT_MAX_UPLOAD_MB * 1024 * 1024;

export function formatUploadLimit(maxUploadMb: number) {
  return `${maxUploadMb} МБ`;
}

export function isFileWithinUploadLimit(file: File, maxUploadBytes: number) {
  return file.size <= maxUploadBytes;
}

export function uploadLimitError(file: File, maxUploadMb: number) {
  return `Файл «${file.name}» превышает лимит ${formatUploadLimit(maxUploadMb)}.`;
}
