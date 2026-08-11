import { useMemo, useRef, useState } from 'react';
import { FileUp, Paperclip } from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  ATTACHMENT_GROUP_LABELS,
  ATTACHMENT_SLOT_LABELS,
  type AttachmentFileGroup,
  type AttachmentSlot,
  filesWord,
} from '../../utils/checkAttachments';
import { useEntityAttachments } from '../../hooks/useEntityAttachments';
import { AttachmentFileList, AttachmentsUnavailableNotice } from '../attachments/AttachmentFileList';
import {
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  FORM_ROW_4,
  FORM_SECTION_CLASS,
  FORM_SECTION_TITLE_CLASS,
} from '../../constants/formLayout';

type DocumentFields = {
  documentNumber: string;
  onDocumentNumberChange: (value: string) => void;
  documentDate: Date | null;
  onDocumentDateChange: (value: Date | null) => void;
};

type CheckAttachmentsSectionProps = {
  checkId?: string | null;
  order: DocumentFields;
  program: DocumentFields;
  az: DocumentFields;
  dz: DocumentFields;
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
      className="flex min-h-[6.5rem] w-full flex-col items-center justify-center gap-2 rounded-lg bg-gray-100 px-2 py-4 text-center leading-relaxed transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300/50"
    >
      <span className="text-sm font-semibold text-gray-800">{label}</span>
      {fileCount > 0 && (
        <span className="text-xs text-gray-500">
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
  filesBySlot: ReturnType<typeof useEntityAttachments>['filesBySlot'];
  canPersist: boolean;
  onAddFiles: (group: AttachmentFileGroup, newFiles: File[]) => void;
  onRemoveFile: (group: AttachmentFileGroup, clientId: string) => void;
  onClose: () => void;
};

function AttachmentFilesModal({
  slot,
  groups,
  filesBySlot,
  canPersist,
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
        {!canPersist && (
          <AttachmentsUnavailableNotice message="Сохраните проверку, чтобы прикрепить файлы." />
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
                  disabled={!canPersist}
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
                  disabled={!canPersist}
                  className="sr-only"
                  onChange={(event) => {
                    const picked = Array.from(event.target.files ?? []);
                    if (picked.length > 0) {
                      onAddFiles(group, picked);
                    }
                  }}
                />
              </div>

              <AttachmentFileList
                items={groupFiles}
                onRemove={(clientId) => onRemoveFile(group, clientId)}
                emptyMessage={
                  canPersist
                    ? 'Файлы не прикреплены. Можно загрузить несколько файлов.'
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
        labelClassName={FORM_LABEL_CLASS}
        inputClassName={FORM_INPUT_CLASS}
      />
      <DatePicker
        label="Дата"
        selected={documentDate}
        onChange={onDocumentDateChange}
        className="min-w-0 w-full"
        fieldClassName="w-full"
        labelClassName={FORM_LABEL_CLASS}
        inputClassName={FORM_INPUT_CLASS}
      />
    </div>
  );
}

export function CheckAttachmentsSection({
  checkId = null,
  order,
  program,
  az,
  dz,
}: CheckAttachmentsSectionProps) {
  const { filesBySlot, addFiles, removeFile, countForSlot, canPersist } = useEntityAttachments({
    entityType: 'check',
    entityId: checkId,
  });
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

  const slotCounts = {
    order: countForSlot('order'),
    program: countForSlot('program'),
    az: countForSlot('az'),
    dz: countForSlot('dz') + countForSlot('dz_appendix'),
  };

  return (
    <div className={FORM_SECTION_CLASS}>
      <div className={FORM_SECTION_TITLE_CLASS}>Вложения</div>

      {!canPersist && (
        <div className="mb-4">
          <AttachmentsUnavailableNotice message="Сохраните проверку, чтобы прикрепить файлы." />
        </div>
      )}

      <div className={FORM_ROW_4}>
        <div className="flex min-w-0 flex-col gap-6">
          <AttachmentCard
            label="Приказ"
            fileCount={slotCounts.order}
            onOpen={() => setOpenSlot('order')}
          />
          <DocumentMetaFields {...order} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <AttachmentCard
            label="Программа"
            fileCount={slotCounts.program}
            onOpen={() => setOpenSlot('program')}
          />
          <DocumentMetaFields {...program} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <AttachmentCard label="АЗ" fileCount={slotCounts.az} onOpen={() => setOpenSlot('az')} />
          <DocumentMetaFields {...az} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <AttachmentCard label="ДЗ" fileCount={slotCounts.dz} onOpen={() => setOpenSlot('dz')} />
          <DocumentMetaFields {...dz} />
        </div>
      </div>

      {openSlot && (
        <AttachmentFilesModal
          slot={openSlot}
          groups={modalGroups}
          filesBySlot={filesBySlot}
          canPersist={canPersist}
          onAddFiles={(group, newFiles) => {
            void addFiles(group, newFiles);
          }}
          onRemoveFile={(group, clientId) => {
            void removeFile(group, clientId);
          }}
          onClose={() => setOpenSlot(null)}
        />
      )}
    </div>
  );
}
