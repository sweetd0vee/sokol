import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteAttachment,
  fetchAttachments,
  uploadAttachment,
  type AttachmentEntityType,
  type StoredAttachment,
} from '../api/attachments';
import { createAttachmentId, type PersistedAttachmentListItem } from '../utils/fileAttachments';
import { toApiError } from '../api/errors';

function storedToItem(stored: StoredAttachment): PersistedAttachmentListItem & { slot: string } {
  return {
    clientId: String(stored.id),
    serverId: stored.id,
    name: stored.original_name,
    size: stored.size_bytes,
    status: 'saved',
    slot: stored.slot,
  };
}

function groupBySlot(items: PersistedAttachmentListItem[]): Record<string, PersistedAttachmentListItem[]> {
  return items.reduce<Record<string, PersistedAttachmentListItem[]>>((acc, item) => {
    const slotItems = acc[item.slot] ?? [];
    slotItems.push(item);
    acc[item.slot] = slotItems;
    return acc;
  }, {});
}

type PendingItem = PersistedAttachmentListItem & { slot: string };

export function useEntityAttachments({
  entityType,
  entityId,
}: {
  entityType: AttachmentEntityType;
  entityId?: number | string | null;
}) {
  const canPersist = entityId != null && entityId !== '' && entityId !== '0';
  const queryClient = useQueryClient();
  const queryKey = ['attachments', entityType, String(entityId ?? '')];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchAttachments({ entity_type: entityType, entity_id: entityId! }),
    enabled: canPersist,
  });

  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);

  useEffect(() => {
    setPendingItems([]);
  }, [entityType, entityId]);

  const savedBySlot = useMemo(() => {
    const grouped = groupBySlot((data?.items ?? []).map(storedToItem));
    for (const item of pendingItems) {
      const slotItems = grouped[item.slot] ?? [];
      slotItems.push(item);
      grouped[item.slot] = slotItems;
    }
    return grouped;
  }, [data?.items, pendingItems]);

  const countForSlot = useCallback(
    (slot: string) => savedBySlot[slot]?.length ?? 0,
    [savedBySlot],
  );

  const addFiles = useCallback(
    async (slot: string, files: File[]) => {
      if (!canPersist || files.length === 0) {
        return;
      }

      for (const file of files) {
        const clientId = createAttachmentId();
        setPendingItems((current) => [
          ...current,
          {
            clientId,
            slot,
            name: file.name,
            size: file.size,
            status: 'uploading',
          },
        ]);

        try {
          await uploadAttachment({
            entity_type: entityType,
            entity_id: entityId!,
            slot,
            file,
          });
          setPendingItems((current) => current.filter((item) => item.clientId !== clientId));
          await queryClient.invalidateQueries({ queryKey });
        } catch (error) {
          const message = toApiError(error).message;
          setPendingItems((current) =>
            current.map((item) =>
              item.clientId === clientId
                ? { ...item, status: 'error', errorMessage: message }
                : item,
            ),
          );
        }
      }
    },
    [canPersist, entityId, entityType, queryClient, queryKey],
  );

  const removeFile = useCallback(
    async (slot: string, clientId: string) => {
      const item = savedBySlot[slot]?.find((entry) => entry.clientId === clientId);
      if (!item) {
        return;
      }

      if (item.status === 'uploading') {
        return;
      }

      if (!item.serverId) {
        setPendingItems((current) => current.filter((entry) => entry.clientId !== clientId));
        return;
      }

      await deleteAttachment(item.serverId);
      await queryClient.invalidateQueries({ queryKey });
    },
    [queryClient, queryKey, savedBySlot],
  );

  return {
    filesBySlot: savedBySlot,
    addFiles,
    removeFile,
    countForSlot,
    canPersist,
    isLoading: canPersist && (isLoading || isFetching),
  };
}
