import { describe, expect, it } from 'vitest';
import {
  resolveStorageAvailability,
  STORAGE_STATUS_MESSAGES,
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
});
