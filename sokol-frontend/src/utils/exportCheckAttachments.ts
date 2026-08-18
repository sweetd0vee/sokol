import JSZip from 'jszip';
import type { Check } from '../types/check';
import { fetchAttachmentBlob, fetchAttachments } from '../api/attachments';
import {
  ATTACHMENT_EXPORT_FOLDER_LABELS,
  type AttachmentFileGroup,
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
  selectedGroups: AttachmentFileGroup[],
): Promise<{ filesAdded: number }> {
  if (checks.length === 0 || selectedGroups.length === 0) {
    return { filesAdded: 0 };
  }

  const zip = new JSZip();
  const usedCheckFolders = new Set<string>();
  let filesAdded = 0;

  for (const check of checks) {
    const checkFolder = uniqueName(buildCheckFolderName(check), usedCheckFolders);

    for (const group of selectedGroups) {
      const { items } = await fetchAttachments({
        entity_type: 'check',
        entity_id: check.id,
        slot: group,
      });
      if (items.length === 0) {
        continue;
      }

      const groupFolder = ATTACHMENT_EXPORT_FOLDER_LABELS[group];
      const usedFilenames = new Set<string>();

      for (const attachment of items) {
        const blob = await fetchAttachmentBlob(attachment.id);
        const baseName = sanitizePathSegment(attachment.original_name) || `file-${attachment.id}`;
        const filename = uniqueName(baseName, usedFilenames);
        zip.file(`${checkFolder}/${groupFolder}/${filename}`, blob);
        filesAdded += 1;
      }
    }
  }

  if (filesAdded === 0) {
    return { filesAdded: 0 };
  }

  const archive = await zip.generateAsync({ type: 'blob' });
  downloadBlob(archive, buildArchiveFilename());
  return { filesAdded };
}
