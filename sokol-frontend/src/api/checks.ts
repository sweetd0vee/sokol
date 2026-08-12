import { api } from './client';
import { mapCheckFromApi, mapCheckToCreate, mapCheckToUpdate, type ApiCheck } from './mappers';
import type { Check } from '../types/check';

type CheckListResponse = {
  items: ApiCheck[];
  total: number;
};

type FetchChecksParams = {
  skip?: number;
  limit?: number;
  search?: string;
  status?: string;
  check_type?: string;
};

export async function fetchChecks(params: FetchChecksParams = {}): Promise<{ items: Check[]; total: number }> {
  const { data } = await api.get<CheckListResponse>('/api/v1/checks', { params });
  return {
    items: data.items.map(mapCheckFromApi),
    total: data.total,
  };
}

export async function fetchCheckBySerialNumber(serialNumber: string): Promise<Check | null> {
  const normalized = serialNumber.trim();
  if (!normalized) {
    return null;
  }
  const { items } = await fetchChecks({ search: normalized, limit: 50 });
  return items.find((check) => check.serial_number === normalized) ?? null;
}

export async function createCheck(check: Check): Promise<Check> {
  const { data } = await api.post<ApiCheck>('/api/v1/checks', mapCheckToCreate(check));
  return mapCheckFromApi(data);
}

export async function updateCheck(id: number | string, check: Check): Promise<Check> {
  const { data } = await api.patch<ApiCheck>(`/api/v1/checks/${id}`, mapCheckToUpdate(check));
  return mapCheckFromApi(data);
}

export async function deleteCheck(id: number | string): Promise<void> {
  await api.delete(`/api/v1/checks/${id}`);
}
