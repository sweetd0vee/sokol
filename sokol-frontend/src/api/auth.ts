import { api } from './client';

export type UserRole = 'admin' | 'auditor';

export type LoginResponse = {
  access_token: string;
  token_type: string;
  username: string;
  display_name: string;
  role: UserRole;
};

export type MeResponse = {
  username: string;
  display_name: string;
  role: UserRole;
};

export async function loginRequest(username: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/v1/auth/login', {
    username,
    password,
  });
  return data;
}

export async function fetchMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/api/v1/auth/me');
  return data;
}
