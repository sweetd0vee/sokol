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

type SettingsCrud<T, TCreate> = {
  fetchAll: () => Promise<T[]>;
  create: (payload: TCreate) => Promise<T>;
  update: (id: string | number, payload: Partial<T>) => Promise<T>;
  remove: (id: string | number) => Promise<void>;
};

function makeSettingsCrud<T, TCreate>(
  path: string,
  options?: {
    encodeId?: boolean;
    toUpdateBody?: (payload: Partial<T>) => unknown;
  },
): SettingsCrud<T, TCreate> {
  const encodeId = options?.encodeId ?? true;
  const resolveId = (id: string | number) =>
    encodeId ? encodeURIComponent(String(id)) : String(id);

  return {
    async fetchAll() {
      const { data } = await api.get<ListResponse<T>>(path, {
        params: { limit: 200 },
      });
      return data.items;
    },
    async create(payload) {
      const { data } = await api.post<T>(path, payload);
      return data;
    },
    async update(id, payload) {
      const body = options?.toUpdateBody ? options.toUpdateBody(payload) : payload;
      const { data } = await api.patch<T>(`${path}/${resolveId(id)}`, body);
      return data;
    },
    async remove(id) {
      await api.delete(`${path}/${resolveId(id)}`);
    },
  };
}

const auditorsCrud = makeSettingsCrud<Auditor, Pick<Auditor, 'full_name'>>(
  '/api/v1/settings/auditors',
  { encodeId: false },
);
const auditTypesCrud = makeSettingsCrud<AuditType, Pick<AuditType, 'code' | 'name'>>(
  '/api/v1/settings/audit_types',
);
const checkKindsCrud = makeSettingsCrud<CheckKind, Pick<CheckKind, 'label'>>(
  '/api/v1/settings/check_kinds',
  { toUpdateBody: (payload) => ({ label: payload.label }) },
);
const ratingsCrud = makeSettingsCrud<EffectivenessRating, Pick<EffectivenessRating, 'label'>>(
  '/api/v1/settings/effectiveness_ratings',
  { toUpdateBody: (payload) => ({ label: payload.label }) },
);

export const fetchAuditors = auditorsCrud.fetchAll;
export const createAuditor = auditorsCrud.create;
export const updateAuditor = auditorsCrud.update;
export const deleteAuditor = auditorsCrud.remove;

export const fetchAuditTypes = auditTypesCrud.fetchAll;
export const createAuditType = auditTypesCrud.create;
export const updateAuditType = auditTypesCrud.update;
export const deleteAuditType = auditTypesCrud.remove;

export const fetchCheckKinds = checkKindsCrud.fetchAll;
export const createCheckKind = checkKindsCrud.create;
export const updateCheckKind = checkKindsCrud.update;
export const deleteCheckKind = checkKindsCrud.remove;

export const fetchEffectivenessRatings = ratingsCrud.fetchAll;
export const createEffectivenessRating = ratingsCrud.create;
export const updateEffectivenessRating = ratingsCrud.update;
export const deleteEffectivenessRating = ratingsCrud.remove;
