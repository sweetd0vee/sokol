import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import { AUTH_UNAUTHORIZED_EVENT } from '../constants/paths';
import { clearStoredAuth, readAccessToken } from '../utils/authSession';
import { createRequestId } from '../utils/clientObservability';
import { toApiError } from './errors';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60_000,
});

api.interceptors.request.use((config) => {
  const token = readAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const headers = config.headers;
  if (headers && typeof headers.get === 'function') {
    if (!headers.get('X-Request-ID')) {
      headers.set('X-Request-ID', createRequestId());
    }
  } else if (headers && !headers['X-Request-ID'] && !headers['x-request-id']) {
    headers['X-Request-ID'] = createRequestId();
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
