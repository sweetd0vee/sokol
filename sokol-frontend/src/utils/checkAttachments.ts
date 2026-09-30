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

/** Слоты, доступные для массового экспорта (совпадают с карточками на форме проверки). */
export const CHECK_ATTACHMENT_EXPORT_SLOTS: AttachmentSlot[] = [
  'order',
  'program',
  'az',
  'dz',
];

/** Слоты хранилища, соответствующие выбранному слоту экспорта. */
export function getStorageSlotsForExportSlot(slot: AttachmentSlot): AttachmentFileGroup[] {
  if (slot === 'dz') {
    return ['dz', 'dz_appendix'];
  }
  return [slot];
}

export function getExportFolderName(storageSlot: string): string | null {
  switch (storageSlot) {
    case 'order':
    case 'program':
    case 'az':
      return ATTACHMENT_SLOT_LABELS[storageSlot];
    case 'dz':
    case 'dz_appendix':
      return ATTACHMENT_SLOT_LABELS.dz;
    default:
      return null;
  }
}

export function shouldExportStorageSlot(storageSlot: string, selectedSlots: AttachmentSlot[]): boolean {
  if (storageSlot === 'dz_appendix') {
    return selectedSlots.includes('dz');
  }
  if (storageSlot === 'order' || storageSlot === 'program' || storageSlot === 'az' || storageSlot === 'dz') {
    return selectedSlots.includes(storageSlot);
  }
  return false;
}
