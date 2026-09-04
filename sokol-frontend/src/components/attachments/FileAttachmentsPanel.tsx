import { useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileUp, Paperclip } from 'lucide-react';
import type { AttachmentEntityType } from '../../api/attachments';
import { fetchCapabilities } from '../../api/capabilities';
import { queryKeys } from '../../api/queryKeys';
import { useEntityAttachments } from '../../hooks/useEntityAttachments';
import { useStorageStatus } from '../../hooks/useStorageStatus';
import { filesWord } from '../../utils/fileAttachments';
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_MAX_UPLOAD_MB,
  formatUploadLimit,
  isFileWithinUploadLimit,
  uploadLimitError,
} from '../../utils/uploadLimits';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AttachmentFileList, AttachmentsUnavailableNotice, StorageStatusNotice } from './AttachmentFileList';

type AttachmentSlotConfig = {
  id: string;
  label: string;
};

type FileAttachmentsPanelProps = {
  title?: string;
  slots: AttachmentSlotConfig[];
  entityType: AttachmentEntityType;
  entityId?: number | string | null;
  unavailableMessage?: string;
  columnsClassName?: string;
  embedded?: boolean;
  compact?: boolean;
  hideSlotLabel?: boolean;
  className?: string;
  canModifyAttachments?: boolean;
};

function AttachmentCard({
  label,
  fileCount,
  onOpen,
  compact = false,
  hideLabel = false,
}: {
  label: string;
  fileCount: number;
  onOpen: () => void;
  compact?: boolean;
  hideLabel?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        'flex w-full items-center justify-center rounded-lg bg-gray-100 text-center leading-relaxed transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300/50 ',
        compact
          ? 'min-h-[6.5rem] flex-col gap-2 px-2 py-4'
          : 'min-h-[12rem] flex-col gap-2 px-4 py-5',
      ].join(' ')}
    >
      {!hideLabel && (
        <span
          className={
            compact
              ? 'text-sm font-semibold text-gray-800 '
              : 'text-lg font-semibold text-gray-800 '
          }
        >
          {label}
        </span>
      )}
      {fileCount > 0 && (
        <span className="text-xs text-gray-500">
          {fileCount} {filesWord(fileCount)}
        </span>
      )}
      <span className={`inline-flex items-center text-sm font-medium text-[#6699FF] ${compact ? 'gap-1' : 'gap-2'}`}>
        <Paperclip size={compact ? 14 : 16} />
        Управление вложениями
      </span>
    </button>
  );
}

function AttachmentFilesModal({
  title,
  slotId,
  items,
  canPersist,
  canModifyAttachments,
  canUploadToStorage,
  storageNotice,
  maxUploadBytes,
  maxUploadMb,
  unavailableMessage,
  onAddFiles,
  onRemoveFile,
  onClose,
}: {
  title: string;
  slotId: string;
  items: ReturnType<typeof useEntityAttachments>['filesBySlot'][string];
  canPersist: boolean;
  canModifyAttachments: boolean;
  canUploadToStorage: boolean;
  storageNotice: ReactNode;
  maxUploadBytes: number;
  maxUploadMb: number;
  unavailableMessage: string;
  onAddFiles: (slotId: string, newFiles: File[]) => void;
  onRemoveFile: (slotId: string, clientId: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const slotFiles = items ?? [];
  const canAddFiles = canPersist && canModifyAttachments && canUploadToStorage;

  return (
    <Modal title={title} wide onClose={onClose}>
      <div className="mt-4 space-y-3">
        {storageNotice}
        {!canPersist && <AttachmentsUnavailableNotice message={unavailableMessage} />}
        {canPersist && canUploadToStorage && (
          <p className="text-sm text-gray-500">
            Максимальный размер одного файла: {formatUploadLimit(maxUploadMb)}.
          </p>
        )}
        {uploadError && (
          <div className="rounded-lg border border-[#e8b4b4] bg-[#fff3f3] px-4 py-2 text-sm font-medium leading-relaxed text-[#a63d3d]">
            {uploadError}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-start gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={!canAddFiles}
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.value = '';
                inputRef.current.click();
              }
            }}
          >
            <span className="inline-flex items-center gap-2">
              <FileUp size={16} />
              Добавить файлы
            </span>
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            disabled={!canAddFiles}
            className="sr-only"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              setUploadError(null);
              const oversized = picked.find((file) => !isFileWithinUploadLimit(file, maxUploadBytes));
              if (oversized) {
                setUploadError(uploadLimitError(oversized, maxUploadMb));
                return;
              }
              if (picked.length > 0) {
                onAddFiles(slotId, picked);
              }
            }}
          />
        </div>

        <AttachmentFileList
          items={slotFiles}
          onRemove={(clientId) => onRemoveFile(slotId, clientId)}
          canRemoveSaved={canModifyAttachments}
          emptyMessage={
            canPersist
              ? canUploadToStorage
                ? 'Файлы не прикреплены.'
                : 'Загрузка файлов недоступна, пока хранилище не восстановится.'
              : 'После сохранения карточки здесь можно будет прикрепить файлы.'
          }
        />
      </div>

      <div className="mt-6 flex justify-end">
        <Button type="button" variant="primary" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </Modal>
  );
}

export function FileAttachmentsPanel({
  title,
  slots,
  entityType,
  entityId = null,
  unavailableMessage = 'Сохраните карточку, чтобы прикрепить файлы.',
  columnsClassName = 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4',
  embedded = false,
  compact = false,
  hideSlotLabel = false,
  className = '',
  canModifyAttachments = true,
}: FileAttachmentsPanelProps) {
  const { filesBySlot, addFiles, removeFile, countForSlot, canPersist } = useEntityAttachments({
    entityType,
    entityId,
  });
  const storage = useStorageStatus();
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const capabilitiesQuery = useQuery({
    queryKey: queryKeys.capabilities,
    queryFn: fetchCapabilities,
    staleTime: 5 * 60 * 1000,
  });
  const maxUploadMb = capabilitiesQuery.data?.max_upload_mb ?? DEFAULT_MAX_UPLOAD_MB;
  const maxUploadBytes = capabilitiesQuery.data?.max_upload_bytes ?? DEFAULT_MAX_UPLOAD_BYTES;

  const openSlot = slots.find((slot) => slot.id === openSlotId);
  const storageNotice = (
    <StorageStatusNotice
      availability={storage}
      onRetry={() => {
        void storage.refetch();
      }}
      isRetrying={storage.isFetching && storage.kind !== 'checking'}
    />
  );

  const content = (
    <>
      {title && <div className="text-xl font-semibold text-gray-900">{title}</div>}
      {storageNotice}
      {!canPersist && !embedded && <AttachmentsUnavailableNotice message={unavailableMessage} />}
      <div className={`grid gap-4 ${columnsClassName}`}>
        {slots.map((slot) => (
          <AttachmentCard
            key={slot.id}
            label={slot.label}
            fileCount={countForSlot(slot.id)}
            onOpen={() => setOpenSlotId(slot.id)}
            compact={compact}
            hideLabel={hideSlotLabel}
          />
        ))}
      </div>

      {openSlot && (
        <AttachmentFilesModal
          title={openSlot.label}
          slotId={openSlot.id}
          items={filesBySlot[openSlot.id]}
          canPersist={canPersist}
          canModifyAttachments={canModifyAttachments}
          canUploadToStorage={storage.canUpload}
          storageNotice={storageNotice}
          maxUploadBytes={maxUploadBytes}
          maxUploadMb={maxUploadMb}
          unavailableMessage={unavailableMessage}
          onAddFiles={addFiles}
          onRemoveFile={removeFile}
          onClose={() => setOpenSlotId(null)}
        />
      )}
    </>
  );

  if (embedded) {
    return <div className={['space-y-4', className].filter(Boolean).join(' ')}>{content}</div>;
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-6">
      {content}
    </div>
  );
}
