import { filesWord } from './fileHelpers';

export type AttachmentSlot = 'order' | 'program' | 'az' | 'dz';

export type AttachmentFileGroup = AttachmentSlot | 'dz_appendix';

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

export { filesWord };
