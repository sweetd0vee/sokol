import { useQuery } from '@tanstack/react-query';
import { fetchStorageStatus, type StorageStatus } from '../api/attachments';
import { queryKeys } from '../api/queryKeys';

export const STORAGE_STATUS_POLL_MS = 15_000;

export const STORAGE_STATUS_MESSAGES = {
  checking: 'Проверяем доступность хранилища файлов…',
  disabled: 'Хранилище файлов отключено. Загрузка вложений недоступна.',
  unreachable: 'Хранилище файлов недоступно. Загрузка вложений временно отключена.',
  unknown: 'Не удалось проверить хранилище файлов. Загрузка вложений отключена.',
} as const;

export type StorageAvailabilityKind = 'ok' | 'checking' | 'disabled' | 'unreachable' | 'unknown';

export type StorageAvailability = {
  kind: StorageAvailabilityKind;
  canUpload: boolean;
  message: string | null;
};

export function resolveStorageAvailability(input: {
  status?: Pick<StorageStatus, 'enabled' | 'reachable'> | null;
  isLoading: boolean;
  isError: boolean;
}): StorageAvailability {
  const { status, isLoading, isError } = input;

  if (status) {
    if (!status.enabled) {
      return {
        kind: 'disabled',
        canUpload: false,
        message: STORAGE_STATUS_MESSAGES.disabled,
      };
    }
    if (!status.reachable) {
      return {
        kind: 'unreachable',
        canUpload: false,
        message: STORAGE_STATUS_MESSAGES.unreachable,
      };
    }
    return { kind: 'ok', canUpload: true, message: null };
  }

  if (isLoading) {
    return {
      kind: 'checking',
      canUpload: false,
      message: STORAGE_STATUS_MESSAGES.checking,
    };
  }

  if (isError) {
    return {
      kind: 'unknown',
      canUpload: false,
      message: STORAGE_STATUS_MESSAGES.unknown,
    };
  }

  return {
    kind: 'checking',
    canUpload: false,
    message: STORAGE_STATUS_MESSAGES.checking,
  };
}

export function storageStatusRefetchInterval(query: {
  state: {
    status: string;
    data?: Pick<StorageStatus, 'enabled' | 'reachable'>;
  };
}): number | false {
  const status = query.state.data;
  if (query.state.status === 'error' || !status?.enabled || !status?.reachable) {
    return STORAGE_STATUS_POLL_MS;
  }
  return false;
}

export function useStorageStatus() {
  const query = useQuery({
    queryKey: queryKeys.storageStatus,
    queryFn: fetchStorageStatus,
    staleTime: STORAGE_STATUS_POLL_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: storageStatusRefetchInterval,
  });

  const availability = resolveStorageAvailability({
    status: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  });

  return {
    ...availability,
    enabled: query.data?.enabled ?? false,
    reachable: query.data?.reachable ?? false,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
