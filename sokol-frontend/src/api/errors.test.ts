import { describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import { getBlobErrorMessage, getErrorMessage, toApiError } from './errors';

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
  it('returns empty string for 404', () => {
    const error = new AxiosError('Not Found');
    error.response = {
      status: 404,
      data: { detail: 'missing' },
      statusText: 'Not Found',
      headers: {},
      config: {} as never,
    };
    expect(getErrorMessage(error)).toBe('');
  });

  it('uses fallback when api error message is empty', () => {
    const error = { code: 'custom', message: '' };
    expect(getErrorMessage(error, 'fallback')).toBe('fallback');
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
});
