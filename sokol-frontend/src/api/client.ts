import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import { AUTH_UNAUTHORIZED_EVENT } from '../constants/paths';
import { clearStoredAuth, readAccessToken } from '../utils/authSession';
import { toApiError } from './errors';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = readAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Let the browser set multipart boundary for FormData.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const headers = config.headers;
    if (headers && typeof headers.delete === 'function') {
      headers.delete('Content-Type');
    } else if (headers) {
      delete headers['Content-Type'];
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
      clearStoredAuth();
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
    return Promise.reject(toApiError(error));
  }
);
