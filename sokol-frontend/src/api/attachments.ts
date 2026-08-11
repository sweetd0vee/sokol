import { api } from './client';

export type AttachmentEntityType = 'check' | 'recommendation';

export type StoredAttachment = {
  id: number;
  entity_type: AttachmentEntityType;
  entity_id: number;
  slot: string;
  check_serial_number: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

type AttachmentListResponse = {
  items: StoredAttachment[];
  total: number;
};

type AttachmentUploadResponse = {
  attachment: StoredAttachment;
};

type StorageStatusResponse = {
  enabled: boolean;
  reachable: boolean;
  bucket_layout: string;
};

export async function fetchStorageStatus(): Promise<StorageStatusResponse> {
  const { data } = await api.get<StorageStatusResponse>('/api/v1/attachments/storage/status');
  return data;
}

export async function fetchAttachments(params: {
  entity_type: AttachmentEntityType;
  entity_id: number | string;
  slot?: string;
}): Promise<{ items: StoredAttachment[]; total: number }> {
  const { data } = await api.get<AttachmentListResponse>('/api/v1/attachments', {
    params: {
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      slot: params.slot,
    },
  });
  return data;
}

export async function uploadAttachment(params: {
  entity_type: AttachmentEntityType;
  entity_id: number | string;
  slot: string;
  file: File;
}): Promise<StoredAttachment> {
  const form = new FormData();
  form.append('entity_type', params.entity_type);
  form.append('entity_id', String(params.entity_id));
  form.append('slot', params.slot);
  form.append('file', params.file);

  const { data } = await api.post<AttachmentUploadResponse>('/api/v1/attachments', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.attachment;
}

export async function downloadAttachment(attachmentId: number | string): Promise<void> {
  const { data, headers } = await api.get<Blob>(`/api/v1/attachments/${attachmentId}/download`, {
    responseType: 'blob',
  });
  const disposition = String(headers['content-disposition'] ?? '');
  const match = /filename="([^"]+)"/i.exec(disposition);
  const filename = match?.[1] || `attachment-${attachmentId}`;
  const objectUrl = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function attachmentDownloadUrl(attachmentId: number | string): string {
  const base = api.defaults.baseURL?.replace(/\/$/, '') ?? '';
  return `${base}/api/v1/attachments/${attachmentId}/download`;
}

export async function deleteAttachment(attachmentId: number | string): Promise<void> {
  await api.delete(`/api/v1/attachments/${attachmentId}`);
}
