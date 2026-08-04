import { useMemo, useRef, useState } from 'react';
import { FileUp, Paperclip, Trash2 } from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  ATTACHMENT_GROUP_LABELS,
  ATTACHMENT_SLOT_LABELS,
  type AttachmentFileGroup,
  type AttachmentSlot,
  type CheckAttachmentItem,
  countSlotFiles,
  createAttachmentId,
  filesWord,
  formatFileSize,
  getFileExtension,
} from '../../utils/checkAttachments';
import { FORM_ROW_4, FORM_SECTION_TITLE_CLASS, formSectionClass } from '../../constants/formLayout';

const EMPTY_FILES: Record<AttachmentFileGroup, CheckAttachmentItem[]> = {
  order: [],
  program: [],
  az: [],
  dz: [],
  dz_appendix: [],
};

type DocumentFields = {
  documentNumber: string;
  onDocumentNumberChange: (value: string) => void;
  documentDate: Date | null;
  onDocumentDateChange: (value: Date | null) => void;
};

type CheckAttachmentsSectionProps = {
  order: DocumentFields;
  program: DocumentFields;
  az: DocumentFields;
  dz: DocumentFields;
  filled?: boolean;
};

type AttachmentCardProps = {
  label: string;
  fileCount: number;
  onOpen: () => void;
};

function AttachmentCard({ label, fileCount, onOpen }: AttachmentCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[6.5rem] w-full flex-col items-center justify-center gap-2 rounded-lg border border-[#b8bec8] bg-white px-2 py-4 text-center leading-relaxed transition hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300/50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700/40"
    >
      <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">{label}</span>
      {fileCount > 0 && (
        <span className="text-xs text-gray-500 dark:text-slate-400">
          {fileCount} {filesWord(fileCount)}
        </span>
      )}
      <span className="inline-flex items-center gap-1 text-sm font-medium text-[#6699FF]">
        <Paperclip size={14} />
        Управление вложениями
      </span>
    </button>
  );
}

type AttachmentFilesModalProps = {
  slot: AttachmentSlot;
  groups: AttachmentFileGroup[];
  files: Record<AttachmentFileGroup, CheckAttachmentItem[]>;
  onAddFiles: (group: AttachmentFileGroup, newFiles: File[]) => void;
  onRemoveFile: (group: AttachmentFileGroup, id: string) => void;
  onClose: () => void;
};

function AttachmentFilesModal({
  slot,
  groups,
  files,
  onAddFiles,
  onRemoveFile,
  onClose,
}: AttachmentFilesModalProps) {
  const inputRefs = useRef<Partial<Record<AttachmentFileGroup, HTMLInputElement | null>>>({});

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
        {groups.map((group) => {
          const groupFiles = files[group];
          return (
            <div key={group} className="space-y-3">
              <div className="flex flex-wrap items-center justify-start gap-3">
                <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100">{ATTACHMENT_GROUP_LABELS[group]}</h4>
                <Button type="button" variant="secondary" onClick={() => handlePickFiles(group)}>
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
                  className="sr-only"
                  onChange={(event) => {
                    const picked = Array.from(event.target.files ?? []);
                    if (picked.length > 0) {
                      onAddFiles(group, picked);
                    }
                  }}
                />
              </div>

              {groupFiles.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-400">
                  Файлы не прикреплены. Можно загрузить несколько файлов любого формата.
                </p>
              ) : (
                <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-slate-700 dark:border-slate-600 dark:bg-slate-800">
                  {groupFiles.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{item.file.name}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {getFileExtension(item.file.name)} · {formatFileSize(item.file.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveFile(group, item.id)}
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

function DocumentMetaFields({
  documentNumber,
  onDocumentNumberChange,
  documentDate,
  onDocumentDateChange,
}: DocumentFields) {
  return (
    <div className="grid grid-cols-1 gap-y-3">
      <Input
        label="Номер"
        value={documentNumber}
        onChange={onDocumentNumberChange}
        placeholder="Введите номер"
        className="min-w-0 w-full"
        labelClassName="text-sm leading-relaxed"
        inputClassName="text-sm py-1.5 leading-relaxed focus:!border-gray-400 focus:!ring-gray-300/40"
      />
      <DatePicker
        label="Дата"
        selected={documentDate}
        onChange={onDocumentDateChange}
        className="min-w-0 w-full"
        fieldClassName="w-full"
        labelClassName="text-sm leading-relaxed"
        inputClassName="text-sm py-1.5 leading-relaxed focus:!border-gray-400 focus:!ring-gray-300/40"
      />
    </div>
  );
}

export function CheckAttachmentsSection({
  order,
  program,
  az,
  dz,
  filled = false,
}: CheckAttachmentsSectionProps) {
  const [files, setFiles] = useState(EMPTY_FILES);
  const [openSlot, setOpenSlot] = useState<AttachmentSlot | null>(null);

  const modalGroups = useMemo((): AttachmentFileGroup[] => {
    if (openSlot === 'dz') {
      return ['dz', 'dz_appendix'];
    }
    if (openSlot) {
      return [openSlot];
    }
    return [];
  }, [openSlot]);

  const addFiles = (group: AttachmentFileGroup, newFiles: File[]) => {
    setFiles((current) => ({
      ...current,
      [group]: [
        ...current[group],
        ...newFiles.map((file) => ({
          id: createAttachmentId(),
          file,
        })),
      ],
    }));
  };

  const removeFile = (group: AttachmentFileGroup, id: string) => {
    setFiles((current) => ({
      ...current,
      [group]: current[group].filter((item) => item.id !== id),
    }));
  };

  return (
    <div className={formSectionClass(filled)}>
      <div className={FORM_SECTION_TITLE_CLASS}>Вложения</div>

      <div className={FORM_ROW_4}>
        <div className="flex min-w-0 flex-col gap-6">
          <AttachmentCard
            label="Приказ"
            fileCount={countSlotFiles(files, 'order')}
            onOpen={() => setOpenSlot('order')}
          />
          <DocumentMetaFields {...order} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <AttachmentCard
            label="Программа"
            fileCount={countSlotFiles(files, 'program')}
            onOpen={() => setOpenSlot('program')}
          />
          <DocumentMetaFields {...program} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <AttachmentCard
            label="АЗ"
            fileCount={countSlotFiles(files, 'az')}
            onOpen={() => setOpenSlot('az')}
          />
          <DocumentMetaFields {...az} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <AttachmentCard
            label="ДЗ"
            fileCount={countSlotFiles(files, 'dz')}
            onOpen={() => setOpenSlot('dz')}
          />
          <DocumentMetaFields {...dz} />
        </div>
      </div>

      {openSlot && (
        <AttachmentFilesModal
          slot={openSlot}
          groups={modalGroups}
          files={files}
          onAddFiles={addFiles}
          onRemoveFile={removeFile}
          onClose={() => setOpenSlot(null)}
        />
      )}
    </div>
  );
}
