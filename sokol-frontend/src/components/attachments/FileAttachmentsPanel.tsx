import { useMemo, useRef, useState } from 'react';
import { FileUp, Paperclip, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  type AttachedFileItem,
  countFilesForSlot,
  createAttachmentId,
  filesWord,
  formatFileSize,
  getFileExtension,
} from '../../utils/fileAttachments';

type AttachmentSlotConfig = {
  id: string;
  label: string;
};

type FileAttachmentsPanelProps = {
  title?: string;
  slots: AttachmentSlotConfig[];
  columnsClassName?: string;
  embedded?: boolean;
  compact?: boolean;
  hideSlotLabel?: boolean;
  className?: string;
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
        'flex w-full items-center justify-center rounded-lg border border-[#b8bec8] bg-white text-center leading-relaxed transition hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300/50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700/40',
        compact
          ? 'min-h-[6.5rem] flex-col gap-2 px-2 py-4'
          : 'min-h-[12rem] flex-col gap-2 px-4 py-5',
      ].join(' ')}
    >
      {!hideLabel && (
        <span
          className={compact ? 'text-sm font-semibold text-gray-800 dark:text-slate-200' : 'text-lg font-semibold text-gray-800 dark:text-slate-200'}
        >
          {label}
        </span>
      )}
      {fileCount > 0 && (
        <span className="text-xs text-gray-500 dark:text-slate-400">
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
  files,
  onAddFiles,
  onRemoveFile,
  onClose,
}: {
  title: string;
  slotId: string;
  files: Record<string, AttachedFileItem[]>;
  onAddFiles: (slotId: string, newFiles: File[]) => void;
  onRemoveFile: (slotId: string, id: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const slotFiles = files[slotId] ?? [];

  return (
    <Modal title={title} wide onClose={onClose}>
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-start gap-3">
          <Button
            type="button"
            variant="secondary"
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
            className="sr-only"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              if (picked.length > 0) {
                onAddFiles(slotId, picked);
              }
            }}
          />
        </div>

        {slotFiles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-400">
            Файлы не прикреплены.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-slate-700 dark:border-slate-600 dark:bg-slate-800">
            {slotFiles.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{item.file.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {getFileExtension(item.file.name)} · {formatFileSize(item.file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveFile(slotId, item.id)}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/30"
                  aria-label={`Удалить ${item.file.name}`}
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
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
  columnsClassName = 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4',
  embedded = false,
  compact = false,
  hideSlotLabel = false,
  className = '',
}: FileAttachmentsPanelProps) {
  const emptyFiles = useMemo(
    () => Object.fromEntries(slots.map((slot) => [slot.id, [] as AttachedFileItem[]])),
    [slots],
  );
  const [files, setFiles] = useState<Record<string, AttachedFileItem[]>>(emptyFiles);
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);

  const openSlot = slots.find((slot) => slot.id === openSlotId);

  const addFiles = (slotId: string, newFiles: File[]) => {
    setFiles((current) => ({
      ...current,
      [slotId]: [
        ...(current[slotId] ?? []),
        ...newFiles.map((file) => ({
          id: createAttachmentId(),
          file,
        })),
      ],
    }));
  };

  const removeFile = (slotId: string, id: string) => {
    setFiles((current) => ({
      ...current,
      [slotId]: (current[slotId] ?? []).filter((item) => item.id !== id),
    }));
  };

  const content = (
    <>
      {title && <div className="text-xl font-semibold text-gray-900 dark:text-slate-100">{title}</div>}
      <div className={`grid gap-4 ${columnsClassName}`}>
        {slots.map((slot) => (
          <AttachmentCard
            key={slot.id}
            label={slot.label}
            fileCount={countFilesForSlot(files, slot.id)}
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
          files={files}
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
    <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-slate-700 dark:bg-slate-800">
      {content}
    </div>
  );
}
