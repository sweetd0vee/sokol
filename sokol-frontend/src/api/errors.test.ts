import { describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import {
  getBlobErrorMessage,
  getErrorMessage,
  getRetryAfterSeconds,
  parseRetryAfterSeconds,
  shouldRetryRequest,
  toApiError,
} from './errors';

describe('toApiError', () => {
  it('maps axios validation detail array to readable message', () => {
    const error = new AxiosError('Bad Request');
    error.response = {
      status: 422,
      data: {
        detail: [{ loc: ['body', 'check_name'], msg: 'Field required' }],
      },
      statusText: 'Unprocessable Entity',
      headers: {},
      config: {} as never,
    };

    const apiError = toApiError(error);
    expect(apiError.code).toBe('http_422');
    expect(apiError.message).toContain('check_name');
    expect(apiError.message).toContain('Field required');
  });

  it('keeps X-Request-ID from the response', () => {
    const error = new AxiosError('Bad Request');
    error.response = {
      status: 400,
      data: { detail: 'Нет' },
      statusText: 'Bad Request',
      headers: { 'x-request-id': 'req-42' },
      config: {} as never,
    };
    expect(toApiError(error).requestId).toBe('req-42');
  });

  it('maps timeout to dedicated code', () => {
    const error = new AxiosError('timeout');
    error.code = 'ECONNABORTED';

    const apiError = toApiError(error);
    expect(apiError.code).toBe('timeout');
    expect(apiError.message).toContain('время ожидания');
  });

  it('maps network error without response', () => {
    const error = new AxiosError('Network Error');
    error.response = undefined;

    const apiError = toApiError(error);
    expect(apiError.code).toBe('network_error');
    expect(apiError.message).toContain('API');
  });

  it('passes through native Error', () => {
    const apiError = toApiError(new Error('boom'));
    expect(apiError.code).toBe('unknown_error');
    expect(apiError.message).toBe('boom');
  });
});

describe('getErrorMessage', () => {
  it('keeps API detail for 404', () => {
    const error = new AxiosError('Not Found');
    error.response = {
      status: 404,
      data: { detail: 'Рекомендация не найдена' },
      statusText: 'Not Found',
      headers: {},
      config: {} as never,
    };
    expect(getErrorMessage(error)).toBe('Рекомендация не найдена');
  });

  it('returns Russian not-found when 404 has no payload', () => {
    const error = new AxiosError('Not Found');
    error.response = {
      status: 404,
      data: {},
      statusText: 'Not Found',
      headers: {},
      config: {} as never,
    };
    expect(getErrorMessage(error)).toBe('Запись не найдена.');
    expect(getErrorMessage(error, 'fallback')).toBe('Запись не найдена.');
  });

  it('uses fallback when api error message is empty', () => {
    const error = { code: 'custom', message: '' };
    expect(getErrorMessage(error, 'fallback')).toBe('fallback');
  });
});

describe('retry-after', () => {
  it('parses delay-seconds and HTTP-date', () => {
    expect(parseRetryAfterSeconds('15')).toBe(15);
    expect(parseRetryAfterSeconds(15)).toBe(15);
    const now = 1_700_000_000_000;
    const future = new Date(now + 8_000).toUTCString();
    expect(parseRetryAfterSeconds(future, now)).toBe(8);
    expect(parseRetryAfterSeconds('0')).toBeUndefined();
    expect(parseRetryAfterSeconds('bogus')).toBeUndefined();
  });

  it('caps long delays and reads axios headers', () => {
    expect(parseRetryAfterSeconds('9999')).toBe(300);
    const error = new AxiosError('Service Unavailable');
    error.response = {
      status: 503,
      data: { detail: 'очередь' },
      statusText: 'Service Unavailable',
      headers: { 'retry-after': '15' },
      config: {} as never,
    };
    expect(toApiError(error).retryAfterSeconds).toBe(15);
    expect(getRetryAfterSeconds(error)).toBe(15);
  });

  it('does not retry 401/403/404', () => {
    expect(shouldRetryRequest(0, { code: 'http_401', message: 'no', status: 401 })).toBe(false);
    expect(shouldRetryRequest(0, { code: 'http_404', message: 'no', status: 404 })).toBe(false);
    expect(shouldRetryRequest(0, { code: 'http_500', message: 'no', status: 500 })).toBe(true);
    expect(shouldRetryRequest(1, { code: 'http_500', message: 'no', status: 500 })).toBe(false);
  });
});

describe('getBlobErrorMessage', () => {
  it('extracts FastAPI detail from blob responses', async () => {
    const error = new AxiosError('Bad Request');
    error.response = {
      status: 400,
      data: new Blob([JSON.stringify({ detail: 'Раздел II не найден.' })], {
        type: 'application/json',
      }),
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    };

    await expect(getBlobErrorMessage(error)).resolves.toBe('Раздел II не найден.');
  });

  it('extracts FastAPI detail after the interceptor wrapped a blob 400', async () => {
    const axiosError = new AxiosError('Bad Request');
    axiosError.response = {
      status: 400,
      data: new Blob(
        [JSON.stringify({ detail: 'В документе не найден Раздел II. Загрузите АЗ с заполненным Разделом II.' })],
        { type: 'application/json' },
      ),
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    };

    await expect(getBlobErrorMessage(toApiError(axiosError))).resolves.toBe(
      'В документе не найден Раздел II. Загрузите АЗ с заполненным Разделом II.',
    );
  });

  it('extracts 503 queue detail from blob responses', async () => {
    const error = new AxiosError('Service Unavailable');
    error.response = {
      status: 503,
      data: new Blob(
        [JSON.stringify({ detail: 'Сейчас обрабатывается слишком много документов. Повторите через несколько секунд — запрос встанет в очередь.' })],
        { type: 'application/json' },
      ),
      statusText: 'Service Unavailable',
      headers: {},
      config: {} as never,
    };

    await expect(getBlobErrorMessage(error)).resolves.toContain('очеред');
  });
});
