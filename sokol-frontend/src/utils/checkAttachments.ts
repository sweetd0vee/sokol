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

/** Имена папок при массовом экспорте вложений проверок. */
export const ATTACHMENT_EXPORT_FOLDER_LABELS: Record<AttachmentFileGroup, string> = {
  order: 'Приказ',
  program: 'Программа',
  az: 'АЗ',
  dz: 'ДЗ',
  dz_appendix: 'Приложение к ДЗ',
};

export const CHECK_ATTACHMENT_EXPORT_GROUPS: AttachmentFileGroup[] = [
  'order',
  'program',
  'az',
  'dz',
  'dz_appendix',
];

export { filesWord };
