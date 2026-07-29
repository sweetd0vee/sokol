import {
  createAttachmentId,
  filesWord,
  formatFileSize,
  getFileExtension,
} from './fileHelpers';

export type AttachmentSlot = 'order' | 'program' | 'az' | 'dz';

export type AttachmentFileGroup = AttachmentSlot | 'dz_appendix';

export type CheckAttachmentItem = {
  id: string;
  file: File;
};

export const ATTACHMENT_SLOT_LABELS: Record<AttachmentSlot, string> = {
  order: 'Приказ',
  program: 'Программа',
  az: 'АЗ',
  dz: 'ДЗ',
};

export const ATTACHMENT_GROUP_LABELS: Record<AttachmentFileGroup, string> = {
  order: 'Приказ',
  program: 'Программа',
  az: 'АЗ',
  dz: 'Докладная записка',
  dz_appendix: 'Приложение к ДЗ',
};

export { createAttachmentId, filesWord, formatFileSize, getFileExtension };

export function countSlotFiles(
  files: Record<AttachmentFileGroup, CheckAttachmentItem[]>,
  slot: AttachmentSlot,
) {
  if (slot === 'dz') {
    return files.dz.length + files.dz_appendix.length;
  }
  return files[slot].length;
}
