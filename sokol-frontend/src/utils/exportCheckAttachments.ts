import JSZip from 'jszip';
import type { Check } from '../types/check';
import { fetchAttachmentBlob, fetchAttachments } from '../api/attachments';
import {
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

export async function exportCheckAttachments(
  checks: Check[],
  selectedSlots: AttachmentSlot[],
): Promise<{ filesAdded: number }> {
  if (checks.length === 0 || selectedSlots.length === 0) {
    return { filesAdded: 0 };
  }

  const zip = new JSZip();
  const usedCheckFolders = new Set<string>();
  let filesAdded = 0;

  for (const check of checks) {
    const checkFolder = uniqueName(buildCheckFolderName(check), usedCheckFolders);
    const { items } = await fetchAttachments({
      entity_type: 'check',
      entity_id: check.id,
    });

    const attachmentsToExport = items.filter((attachment) =>
      shouldExportStorageSlot(attachment.slot, selectedSlots),
    );
    if (attachmentsToExport.length === 0) {
      continue;
    }

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
      filesAdded += 1;
    }
  }

  if (filesAdded === 0) {
    return { filesAdded: 0 };
  }

  const archive = await zip.generateAsync({ type: 'blob' });
  downloadBlob(archive, buildArchiveFilename());
  return { filesAdded };
}
