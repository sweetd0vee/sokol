import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import { toApiError } from './errors';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiError(error))
);
