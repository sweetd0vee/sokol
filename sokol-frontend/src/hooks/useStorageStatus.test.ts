import { describe, expect, it } from 'vitest';
import {
  resolveStorageAvailability,
  STORAGE_STATUS_MESSAGES,
  STORAGE_STATUS_POLL_MS,
  storageStatusRefetchInterval,
} from './useStorageStatus';

describe('resolveStorageAvailability', () => {
  it('allows upload when MinIO is enabled and reachable', () => {
    expect(
      resolveStorageAvailability({
        status: { enabled: true, reachable: true },
        isLoading: false,
        isError: false,
      }),
    ).toEqual({ kind: 'ok', canUpload: true, message: null });
  });

  it('blocks upload when storage is disabled, even if a previous request is in flight', () => {
    expect(
      resolveStorageAvailability({
        status: { enabled: false, reachable: false },
        isLoading: false,
        isError: false,
      }),
    ).toEqual({
      kind: 'disabled',
      canUpload: false,
      message: STORAGE_STATUS_MESSAGES.disabled,
    });
  });

  it('blocks upload when storage is enabled but unreachable', () => {
    expect(
      resolveStorageAvailability({
        status: { enabled: true, reachable: false },
        isLoading: false,
        isError: false,
      }),
    ).toEqual({
      kind: 'unreachable',
      canUpload: false,
      message: STORAGE_STATUS_MESSAGES.unreachable,
    });
  });

  it('shows a checking state before the first storage status response', () => {
    expect(
      resolveStorageAvailability({
        status: null,
        isLoading: true,
        isError: false,
      }),
    ).toEqual({
      kind: 'checking',
      canUpload: false,
      message: STORAGE_STATUS_MESSAGES.checking,
    });
  });

  it('blocks upload when storage status cannot be fetched', () => {
    expect(
      resolveStorageAvailability({
        status: undefined,
        isLoading: false,
        isError: true,
      }),
    ).toEqual({
      kind: 'unknown',
      canUpload: false,
      message: STORAGE_STATUS_MESSAGES.unknown,
    });
  });

  it('prefers a cached status over a later fetch error', () => {
    expect(
      resolveStorageAvailability({
        status: { enabled: true, reachable: true },
        isLoading: false,
        isError: true,
      }),
    ).toEqual({ kind: 'ok', canUpload: true, message: null });
  });

  it('blocks upload when storage is disabled even if reachable is true', () => {
    expect(
      resolveStorageAvailability({
        status: { enabled: false, reachable: true },
        isLoading: false,
        isError: false,
      }).kind,
    ).toBe('disabled');
  });
});

describe('storageStatusRefetchInterval', () => {
  it('polls while storage is down or the status request failed', () => {
    expect(
      storageStatusRefetchInterval({
        state: { status: 'success', data: { enabled: true, reachable: false } },
      }),
    ).toBe(STORAGE_STATUS_POLL_MS);
    expect(
      storageStatusRefetchInterval({
        state: { status: 'success', data: { enabled: false, reachable: false } },
      }),
    ).toBe(STORAGE_STATUS_POLL_MS);
    expect(storageStatusRefetchInterval({ state: { status: 'error' } })).toBe(STORAGE_STATUS_POLL_MS);
  });

  it('does not poll while MinIO is enabled and reachable', () => {
    expect(
      storageStatusRefetchInterval({
        state: { status: 'success', data: { enabled: true, reachable: true } },
      }),
    ).toBe(false);
  });
});
