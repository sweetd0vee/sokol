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

export type PersistedAttachmentListItem = {
  clientId: string;
  serverId?: number;
  name: string;
  size: number;
  status: 'saved' | 'uploading' | 'error';
  errorMessage?: string;
  slot?: string;
};

export { createAttachmentId, filesWord, formatFileSize, getFileExtension };

export function countFilesForSlot(files: Record<string, AttachedFileItem[]>, slotId: string) {
  return files[slotId]?.length ?? 0;
}
