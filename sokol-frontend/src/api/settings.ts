import { api } from './client';

export type Auditor = {
  id?: string | number;
  full_name: string;
};

export type AuditType = {
  id?: string;
  code: string;
  name: string;
};

export type CheckKind = {
  id?: string;
  label: string;
};

export type EffectivenessRating = {
  id?: string;
  code?: string;
  label: string;
};

type ListResponse<T> = {
  items: T[];
  total: number;
};

export async function fetchAuditors(): Promise<Auditor[]> {
  const { data } = await api.get<ListResponse<Auditor>>('/api/v1/settings/auditors', {
    params: { limit: 200 },
  });
  return data.items;
}

export async function createAuditor(payload: Pick<Auditor, 'full_name'>): Promise<Auditor> {
  const { data } = await api.post<Auditor>('/api/v1/settings/auditors', payload);
  return data;
}

export async function updateAuditor(id: string | number, payload: Pick<Auditor, 'full_name'>): Promise<Auditor> {
  const { data } = await api.patch<Auditor>(`/api/v1/settings/auditors/${id}`, payload);
  return data;
}

export async function deleteAuditor(id: string | number): Promise<void> {
  await api.delete(`/api/v1/settings/auditors/${id}`);
}

export async function fetchAuditTypes(): Promise<AuditType[]> {
  const { data } = await api.get<ListResponse<AuditType>>('/api/v1/settings/audit_types', {
    params: { limit: 200 },
  });
  return data.items;
}

export async function createAuditType(payload: Pick<AuditType, 'code' | 'name'>): Promise<AuditType> {
  const { data } = await api.post<AuditType>('/api/v1/settings/audit_types', payload);
  return data;
}

export async function updateAuditType(id: string | number, payload: Partial<AuditType>): Promise<AuditType> {
  const encodedId = encodeURIComponent(String(id));
  const { data } = await api.patch<AuditType>(`/api/v1/settings/audit_types/${encodedId}`, payload);
  return data;
}

export async function deleteAuditType(id: string | number): Promise<void> {
  const encodedId = encodeURIComponent(String(id));
  await api.delete(`/api/v1/settings/audit_types/${encodedId}`);
}

export async function fetchCheckKinds(): Promise<CheckKind[]> {
  const { data } = await api.get<ListResponse<CheckKind>>('/api/v1/settings/check_kinds', {
    params: { limit: 200 },
  });
  return data.items;
}

export async function createCheckKind(payload: Pick<CheckKind, 'label'>): Promise<CheckKind> {
  const { data } = await api.post<CheckKind>('/api/v1/settings/check_kinds', payload);
  return data;
}

export async function updateCheckKind(
  id: string | number,
  payload: Partial<CheckKind>
): Promise<CheckKind> {
  const encodedId = encodeURIComponent(String(id));
  const { data } = await api.patch<CheckKind>(`/api/v1/settings/check_kinds/${encodedId}`, {
    label: payload.label,
  });
  return data;
}

export async function deleteCheckKind(id: string | number): Promise<void> {
  const encodedId = encodeURIComponent(String(id));
  await api.delete(`/api/v1/settings/check_kinds/${encodedId}`);
}

export async function fetchEffectivenessRatings(): Promise<EffectivenessRating[]> {
  const { data } = await api.get<ListResponse<EffectivenessRating>>(
    '/api/v1/settings/effectiveness_ratings',
    { params: { limit: 200 } },
  );
  return data.items;
}

export async function createEffectivenessRating(
  payload: Pick<EffectivenessRating, 'label'>
): Promise<EffectivenessRating> {
  const { data } = await api.post<EffectivenessRating>('/api/v1/settings/effectiveness_ratings', payload);
  return data;
}

export async function updateEffectivenessRating(
  id: string | number,
  payload: Partial<EffectivenessRating>
): Promise<EffectivenessRating> {
  const encodedId = encodeURIComponent(String(id));
  const { data } = await api.patch<EffectivenessRating>(
    `/api/v1/settings/effectiveness_ratings/${encodedId}`,
    { label: payload.label }
  );
  return data;
}

export async function deleteEffectivenessRating(id: string | number): Promise<void> {
  const encodedId = encodeURIComponent(String(id));
  await api.delete(`/api/v1/settings/effectiveness_ratings/${encodedId}`);
}
