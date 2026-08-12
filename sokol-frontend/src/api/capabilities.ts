import { api } from './client';

export type ApiCapabilities = {
  max_upload_mb: number;
  max_upload_bytes: number;
};

export async function fetchCapabilities(): Promise<ApiCapabilities> {
  const { data } = await api.get<ApiCapabilities>('/api/v1/capabilities');
  return data;
}
