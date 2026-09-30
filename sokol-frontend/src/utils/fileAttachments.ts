import {
  createAttachmentId,
  formatFileSize,
  getFileExtension,
} from './fileHelpers';

export type PersistedAttachmentListItem = {
  clientId: string;
  serverId?: number;
  name: string;
  size: number;
  status: 'saved' | 'uploading' | 'error';
  errorMessage?: string;
  slot?: string;
};

export { createAttachmentId, formatFileSize, getFileExtension };
