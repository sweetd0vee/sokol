import { api } from './client';
import type { UserRole } from './auth';

export type AppUser = {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  aliases?: string | null;
  is_active: boolean;
};

type UserListResponse = {
  items: AppUser[];
  total: number;
};

export type CreateUserPayload = {
  username: string;
  password: string;
  role: UserRole;
  display_name?: string;
  aliases?: string[];
};

export async function fetchUsers(): Promise<AppUser[]> {
  const { data } = await api.get<UserListResponse>('/api/v1/users', {
    params: { limit: 200 },
  });
  return data.items;
}

export async function createUser(payload: CreateUserPayload): Promise<AppUser> {
  const { data } = await api.post<AppUser>('/api/v1/users', payload);
  return data;
}
