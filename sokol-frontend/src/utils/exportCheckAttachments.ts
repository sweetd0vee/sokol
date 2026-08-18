import JSZip from 'jszip';
import type { Check } from '../types/check';
import { fetchAttachmentBlob, fetchAttachments } from '../api/attachments';
import {
  buildAttachmentSamplingReport,
  buildAttachmentSamplingReportXlsx,
  getEmptyFolderEntries,
  type CheckFolderCounts,
} from './attachmentSamplingReport';
import {
  ATTACHMENT_SLOT_LABELS,
  getExportFolderName,
  shouldExportStorageSlot,
  type AttachmentSlot,
} from './checkAttachments';
import { downloadBlob } from './download';

const INVALID_PATH_CHARS = /[\\/:*?"<>|]/g;

export function sanitizePathSegment(name: string): string {
  return name
    .replace(INVALID_PATH_CHARS, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
}

export function buildCheckFolderName(check: Check): string {
  const key = sanitizePathSegment(check.serial_number);
  const shortName = check.short_name?.trim();
  if (!shortName) {
    return key;
  }
  return sanitizePathSegment(`${key} ${shortName}`);
}

function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let index = 2;
  while (used.has(`${base} (${index})`)) {
    index += 1;
  }
  const unique = `${base} (${index})`;
  used.add(unique);
  return unique;
}

function buildArchiveFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `checks-attachments-${date}.zip`;
}

function createEmptySlotCounts(selectedSlots: AttachmentSlot[]): Record<AttachmentSlot, number> {
  return selectedSlots.reduce<Record<AttachmentSlot, number>>((counts, slot) => {
    counts[slot] = 0;
    return counts;
  }, {} as Record<AttachmentSlot, number>);
}

function incrementSlotCount(
  countsBySlot: Record<AttachmentSlot, number>,
  storageSlot: string,
): void {
  if (storageSlot === 'dz_appendix') {
    countsBySlot.dz += 1;
    return;
  }
  if (storageSlot === 'order' || storageSlot === 'program' || storageSlot === 'az' || storageSlot === 'dz') {
    countsBySlot[storageSlot] += 1;
  }
}

export type ExportCheckAttachmentsResult = {
  filesAdded: number;
  emptyFolders: Array<{
    folderName: string;
    serialNumber: string;
    emptySlots: string[];
  }>;
};

export async function exportCheckAttachments(
  checks: Check[],
  selectedSlots: AttachmentSlot[],
): Promise<ExportCheckAttachmentsResult> {
  if (checks.length === 0 || selectedSlots.length === 0) {
    return { filesAdded: 0, emptyFolders: [] };
  }

  const zip = new JSZip();
  const usedCheckFolders = new Set<string>();
  const reportRows: CheckFolderCounts[] = [];
  let filesAdded = 0;

  for (const check of checks) {
    const checkFolder = uniqueName(buildCheckFolderName(check), usedCheckFolders);
    const countsBySlot = createEmptySlotCounts(selectedSlots);

    for (const slot of selectedSlots) {
      zip.folder(`${checkFolder}/${ATTACHMENT_SLOT_LABELS[slot]}`);
    }

    const { items } = await fetchAttachments({
      entity_type: 'check',
      entity_id: check.id,
    });

    const attachmentsToExport = items.filter((attachment) =>
      shouldExportStorageSlot(attachment.slot, selectedSlots),
    );

    const usedFilenamesByFolder = new Map<string, Set<string>>();

    for (const attachment of attachmentsToExport) {
      const groupFolder = getExportFolderName(attachment.slot);
      if (!groupFolder) {
        continue;
      }

      const blob = await fetchAttachmentBlob(attachment.id);
      const baseName = sanitizePathSegment(attachment.original_name) || `file-${attachment.id}`;
      const usedFilenames = usedFilenamesByFolder.get(groupFolder) ?? new Set<string>();
      const filename = uniqueName(baseName, usedFilenames);
      usedFilenamesByFolder.set(groupFolder, usedFilenames);
      zip.file(`${checkFolder}/${groupFolder}/${filename}`, blob);
      incrementSlotCount(countsBySlot, attachment.slot);
      filesAdded += 1;
    }

    reportRows.push({ check, folderName: checkFolder, countsBySlot });
  }

  const samplingReport = buildAttachmentSamplingReport(reportRows, selectedSlots);
  const reportBuffer = buildAttachmentSamplingReportXlsx(samplingReport);
  zip.file('Отчет о выборке.xlsx', reportBuffer);

  const archive = await zip.generateAsync({ type: 'blob' });
  downloadBlob(archive, buildArchiveFilename());

  return {
    filesAdded,
    emptyFolders: getEmptyFolderEntries(samplingReport),
  };
}
