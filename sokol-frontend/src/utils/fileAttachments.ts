import {
  createAttachmentId,
  filesWord,
  formatFileSize,
  getFileExtension,
} from './fileHelpers';

export type AttachedFileItem = {
  id: string;
  file: File;
};

export { createAttachmentId, filesWord, formatFileSize, getFileExtension };

export function countFilesForSlot(files: Record<string, AttachedFileItem[]>, slotId: string) {
  return files[slotId]?.length ?? 0;
}
