import { useRef, useState, type ReactNode } from 'react';
import { FileUp } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  ATTACHMENT_GROUP_LABELS,
  ATTACHMENT_SLOT_LABELS,
  type AttachmentFileGroup,
  type AttachmentSlot,
} from '../../utils/checkAttachments';
import { useEntityAttachments } from '../../hooks/useEntityAttachments';
import { AttachmentFileList, AttachmentsUnavailableNotice } from './AttachmentFileList';
import {
  formatUploadLimit,
  isFileWithinUploadLimit,
  uploadLimitError,
} from '../../utils/uploadLimits';

type AttachmentFilesModalProps = {
  slot: AttachmentSlot;
  groups: AttachmentFileGroup[];
  filesBySlot: ReturnType<typeof useEntityAttachments>['filesBySlot'];
  canPersist: boolean;
  canUploadToStorage: boolean;
  storageNotice: ReactNode;
  maxUploadBytes: number;
  maxUploadMb: number;
  onAddFiles: (group: AttachmentFileGroup, newFiles: File[]) => void;
  onRemoveFile: (group: AttachmentFileGroup, clientId: string) => void;
  onClose: () => void;
  canRemoveSaved: boolean;
  canModify?: boolean;
  unavailableMessage?: string;
};

export function AttachmentFilesModal({
  slot,
  groups,
  filesBySlot,
  canPersist,
  canUploadToStorage,
  storageNotice,
  maxUploadBytes,
  maxUploadMb,
  onAddFiles,
  onRemoveFile,
  onClose,
  canRemoveSaved,
  canModify = true,
  unavailableMessage = 'Сохраните проверку, чтобы прикрепить файлы.',
}: AttachmentFilesModalProps) {
  const inputRefs = useRef<Partial<Record<AttachmentFileGroup, HTMLInputElement | null>>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const canAddFiles = canPersist && canUploadToStorage && canModify;

  const handlePickFiles = (group: AttachmentFileGroup) => {
    const input = inputRefs.current[group];
    if (input) {
      input.value = '';
      input.click();
    }
  };

  return (
    <Modal title={ATTACHMENT_SLOT_LABELS[slot]} wide onClose={onClose}>
      <div className="mt-4 space-y-6">
        {storageNotice}
        {!canPersist && (
          <AttachmentsUnavailableNotice message={unavailableMessage} />
        )}
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

        {groups.map((group) => {
          const groupFiles = filesBySlot[group] ?? [];
          return (
            <div key={group} className="space-y-3">
              <div className="flex flex-wrap items-center justify-start gap-3">
                <h4 className="text-base font-semibold text-gray-900">
                  {ATTACHMENT_GROUP_LABELS[group]}
                </h4>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canAddFiles}
                  onClick={() => handlePickFiles(group)}
                >
                  <span className="inline-flex items-center gap-2">
                    <FileUp size={16} />
                    Добавить файлы
                  </span>
                </Button>
                <input
                  ref={(element) => {
                    inputRefs.current[group] = element;
                  }}
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
                      onAddFiles(group, picked);
                    }
                  }}
                />
              </div>

              <AttachmentFileList
                items={groupFiles}
                onRemove={(clientId) => onRemoveFile(group, clientId)}
                canRemoveSaved={canRemoveSaved}
                emptyMessage={
                  canPersist
                    ? canUploadToStorage
                      ? 'Файлы не прикреплены. Можно загрузить несколько файлов.'
                      : 'Загрузка файлов недоступна, пока хранилище не восстановится.'
                    : 'После сохранения проверки здесь можно будет прикрепить файлы.'
                }
              />
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <Button type="button" variant="primary" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </Modal>
  );
}
