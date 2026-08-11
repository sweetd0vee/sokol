import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import { AUTH_STORAGE_KEY } from '../constants/storage';
import { toApiError } from './errors';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

function readAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return parsed.accessToken?.trim() || null;
  } catch {
    return null;
  }
}

api.interceptors.request.use((config) => {
  const token = readAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Let the browser set multipart boundary for FormData.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers && 'Content-Type' in config.headers) {
      delete config.headers['Content-Type'];
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url ?? '');
    const isLogin = url.includes('/auth/login');
    if (status === 401 && !isLogin) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.dispatchEvent(new Event('sokol:auth-unauthorized'));
    }
    return Promise.reject(toApiError(error));
  }
);
