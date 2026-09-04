import { api } from './client';

export type ApiCapabilities = {
  max_upload_mb: number;
  max_upload_bytes: number;
  docx_max_concurrent?: number;
  docx_max_queue?: number;
  docx_queue_wait_seconds?: number;
};

export async function fetchCapabilities(): Promise<ApiCapabilities> {
  const { data } = await api.get<ApiCapabilities>('/api/v1/capabilities');
  return data;
}
