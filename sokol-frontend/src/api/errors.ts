import axios from 'axios';
import { API_DISPLAY_URL } from '../config/env';

export type ApiError = {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
  retryAfterSeconds?: number;
};

const NOT_FOUND_MESSAGE = 'Запись не найдена.';
const MAX_RETRY_AFTER_SECONDS = 5 * 60;

function readHeader(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }
  const record = headers as Record<string, unknown> & { get?: (key: string) => unknown };
  if (typeof record.get === 'function') {
    const value = record.get(name);
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  const direct = record[name] ?? record[name.toLowerCase()];
  if (Array.isArray(direct)) {
    const first = direct[0];
    return first !== null && first !== undefined ? String(first).trim() : undefined;
  }
  if (direct !== null && direct !== undefined && String(direct).trim()) {
    return String(direct).trim();
  }
  return undefined;
}

export function parseRetryAfterSeconds(raw: unknown, nowMs = Date.now()): number | undefined {
  if (raw === null || raw === undefined) {
    return undefined;
  }
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }
  const text = String(value).trim();
  if (!text) {
    return undefined;
  }
  let seconds: number;
  if (/^\d+$/.test(text)) {
    seconds = Number(text);
  } else {
    const dateMs = Date.parse(text);
    if (Number.isNaN(dateMs)) {
      return undefined;
    }
    seconds = Math.ceil((dateMs - nowMs) / 1000);
  }
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }
  return Math.min(Math.floor(seconds), MAX_RETRY_AFTER_SECONDS);
}

function defaultStatusMessage(status?: number): string {
  if (status === 404) {
    return NOT_FOUND_MESSAGE;
  }
  if (status) {
    return `HTTP ${status}`;
  }
  return 'Ошибка сети. Проверьте подключение.';
}

type ErrorPayload = {
  code?: string;
  message?: string;
  detail?: unknown;
  details?: unknown;
};

type ValidationIssue = {
  loc?: Array<string | number>;
  msg?: string;
};

function formatErrorDetail(detail: unknown): string | undefined {
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  if (!Array.isArray(detail) || detail.length === 0) {
    return undefined;
  }
  const messages = detail
    .map((item) => {
      const issue = item as ValidationIssue;
      if (typeof issue?.msg !== 'string' || !issue.msg.trim()) {
        return null;
      }
      const field = Array.isArray(issue.loc)
        ? issue.loc.filter((part) => part !== 'body').join('.')
        : '';
      return field ? `${field}: ${issue.msg}` : issue.msg;
    })
    .filter((value): value is string => Boolean(value));
  return messages.length > 0 ? messages.join('; ') : undefined;
}

function formatPayloadMessage(data: ErrorPayload): string | undefined {
  const detailMessage = formatErrorDetail(data.detail);
  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }
  return detailMessage;
}

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    !axios.isAxiosError(error) &&
    'code' in error &&
    'message' in error &&
    typeof (error as ApiError).code === 'string' &&
    typeof (error as ApiError).message === 'string'
  );
}

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {return error;}

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = (error.response?.data ?? {}) as ErrorPayload;
    const code = data.code ?? (status ? `http_${status}` : 'network_error');
    const payloadMessage = formatPayloadMessage(data);
    if (error.code === 'ECONNABORTED') {
      return {
        code: 'timeout',
        message: 'Превышено время ожидания ответа от сервера. Попробуйте ещё раз.',
        status,
      };
    }
    if (!error.response) {
      return {
        code: 'network_error',
        message: API_UNAVAILABLE_HINT,
      };
    }
    const message = payloadMessage ?? defaultStatusMessage(status);
    const retryAfterSeconds = parseRetryAfterSeconds(
      readHeader(error.response?.headers, 'retry-after'),
    );
    return {
      code,
      message,
      status,
      details: data.details ?? error.response?.data,
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    };
  }

  if (error instanceof Error) {
    return { code: 'unknown_error', message: error.message };
  }

  return { code: 'unknown_error', message: 'Неизвестная ошибка' };
}

export function getErrorMessage(error: unknown, fallback?: string) {
  const apiError = toApiError(error);
  return apiError.message || fallback || 'Произошла ошибка';
}

export function getRetryAfterSeconds(error: unknown): number | undefined {
  return toApiError(error).retryAfterSeconds;
}

export function shouldRetryRequest(failureCount: number, error: unknown, maxRetries = 1): boolean {
  const status = toApiError(error).status;
  if (status === 401 || status === 403 || status === 404) {
    return false;
  }
  return failureCount < maxRetries;
}

const API_UNAVAILABLE_HINT =
  'Не удалось связаться с API. Запустите бэкенд: python -m uvicorn app.main:app --reload --port 8802 ' +
  `(ожидается ${API_DISPLAY_URL}).`;

async function readResponseBody(data: unknown): Promise<string> {
  if (data instanceof Blob) {
    return data.text();
  }
  if (typeof data === 'string') {
    return data;
  }
  if (data && typeof data === 'object') {
    const payload = data as ErrorPayload;
    const payloadMessage = formatPayloadMessage(payload);
    if (payloadMessage) {return payloadMessage;}
    return JSON.stringify(data);
  }
  return '';
}

function errorResponseBlob(error: unknown): Blob | null {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    return error.response.data;
  }
  if (isApiError(error) && error.details instanceof Blob) {
    return error.details;
  }
  return null;
}

async function messageFromErrorBody(text: string, status?: number): Promise<string> {
  if (!text.trim()) {
    if (status === 500 || status === 502 || status === 503) {
      return API_UNAVAILABLE_HINT;
    }
    return status ? `Ошибка API (HTTP ${status}).` : 'Ошибка API.';
  }

  try {
    const payload = JSON.parse(text) as ErrorPayload;
    const payloadMessage = formatPayloadMessage(payload);
    if (payloadMessage) {
      return payloadMessage;
    }
  } catch {
    return text;
  }

  return text;
}

export async function getBlobErrorMessage(error: unknown): Promise<string | null> {
  if (isApiError(error)) {
    if (error.code === 'timeout') {
      return error.message;
    }
    if (error.code === 'network_error') {
      return error.message || API_UNAVAILABLE_HINT;
    }
    const blob = errorResponseBlob(error);
    if (blob) {
      return messageFromErrorBody(await blob.text(), error.status);
    }
    if (error.message && !/^HTTP \d+$/.test(error.message)) {
      return error.message;
    }
    return error.status ? `Ошибка API (HTTP ${error.status}).` : null;
  }

  if (!axios.isAxiosError(error)) {
    return null;
  }
  if (error.code === 'ECONNABORTED') {
    return 'Превышено время ожидания ответа от сервера. Попробуйте ещё раз.';
  }
  if (!error.response) {
    return API_UNAVAILABLE_HINT;
  }

  const status = error.response.status;
  const blob = errorResponseBlob(error);
  const text = blob ? await blob.text() : await readResponseBody(error.response.data);
  return messageFromErrorBody(text, status);
}
