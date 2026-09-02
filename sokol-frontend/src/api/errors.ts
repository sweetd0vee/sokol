import axios from 'axios';
import { API_DISPLAY_URL } from '../config/env';

export type ApiError = {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
};

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
    const message =
      payloadMessage ??
      (status ? `HTTP ${status}` : 'Ошибка сети. Проверьте подключение.');
    return {
      code,
      message,
      status,
      details: data.details ?? error.response?.data,
    };
  }

  if (error instanceof Error) {
    return { code: 'unknown_error', message: error.message };
  }

  return { code: 'unknown_error', message: 'Неизвестная ошибка' };
}

export function getErrorMessage(error: unknown, fallback?: string) {
  const apiError = toApiError(error);
  if (apiError.status === 404 || apiError.code === 'http_404') {
    return '';
  }
  return apiError.message || fallback || 'Произошла ошибка';
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
