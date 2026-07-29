export function createAttachmentId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} Б`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} КБ`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function getFileExtension(name: string) {
  const parts = name.split('.');
  if (parts.length < 2) {
    return 'файл';
  }
  return parts.at(-1)?.toUpperCase() ?? 'файл';
}

export function filesWord(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) {
    return 'файл';
  }
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
    return 'файла';
  }
  return 'файлов';
}
