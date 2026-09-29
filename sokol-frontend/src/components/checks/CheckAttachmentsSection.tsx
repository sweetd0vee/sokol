import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import {
  type AttachmentFileGroup,
  type AttachmentSlot,
} from '../../utils/checkAttachments';
import { useEntityAttachments } from '../../hooks/useEntityAttachments';
import { useStorageStatus } from '../../hooks/useStorageStatus';
import { fetchCapabilities } from '../../api/capabilities';
import { queryKeys } from '../../api/queryKeys';
import { AttachmentsUnavailableNotice, StorageStatusNotice } from '../attachments/AttachmentFileList';
import { AttachmentFilesModal } from '../attachments/AttachmentFilesModal';
import { AttachmentSlotCard } from '../attachments/AttachmentSlotCard';
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_MAX_UPLOAD_MB,
} from '../../utils/uploadLimits';
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
  canModify?: boolean;
  checkId?: string | null;
  order: DocumentFields;
  program: DocumentFields;
  az: DocumentFields;
  dz: DocumentFields;
};

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
  canModify = true,
  order,
  program,
  az,
  dz,
}: CheckAttachmentsSectionProps) {
  const { filesBySlot, addFiles, removeFile, countForSlot, canPersist } = useEntityAttachments({
    entityType: 'check',
    entityId: checkId,
  });
  const storage = useStorageStatus();
  const [openSlot, setOpenSlot] = useState<AttachmentSlot | null>(null);
  const capabilitiesQuery = useQuery({
    queryKey: queryKeys.capabilities,
    queryFn: fetchCapabilities,
    staleTime: 5 * 60 * 1000,
  });
  const maxUploadMb = capabilitiesQuery.data?.max_upload_mb ?? DEFAULT_MAX_UPLOAD_MB;
  const maxUploadBytes = capabilitiesQuery.data?.max_upload_bytes ?? DEFAULT_MAX_UPLOAD_BYTES;

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

  const storageNotice = (
    <StorageStatusNotice
      availability={storage}
      onRetry={() => {
        void storage.refetch();
      }}
      isRetrying={storage.isFetching && storage.kind !== 'checking'}
    />
  );

  return (
    <div className={FORM_SECTION_CLASS}>
      <div className={FORM_SECTION_TITLE_CLASS}>Вложения</div>

      {storageNotice}

      {!canPersist && (
        <AttachmentsUnavailableNotice message="Сохраните проверку, чтобы прикрепить файлы." />
      )}

      <div className={FORM_ROW_4}>
        <div className="flex min-w-0 flex-col gap-6">
          <AttachmentSlotCard
            label="Приказ"
            fileCount={slotCounts.order}
            onOpen={() => setOpenSlot('order')}
          />
          <DocumentMetaFields {...order} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <AttachmentSlotCard
            label="Программа"
            fileCount={slotCounts.program}
            onOpen={() => setOpenSlot('program')}
          />
          <DocumentMetaFields {...program} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <AttachmentSlotCard label="АЗ" fileCount={slotCounts.az} onOpen={() => setOpenSlot('az')} />
          <DocumentMetaFields {...az} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <AttachmentSlotCard label="ДЗ" fileCount={slotCounts.dz} onOpen={() => setOpenSlot('dz')} />
          <DocumentMetaFields {...dz} />
        </div>
      </div>

      {openSlot && (
        <AttachmentFilesModal
          slot={openSlot}
          groups={modalGroups}
          filesBySlot={filesBySlot}
          canPersist={canPersist}
          canUploadToStorage={storage.canUpload}
          storageNotice={storageNotice}
          maxUploadBytes={maxUploadBytes}
          maxUploadMb={maxUploadMb}
          onAddFiles={(group, newFiles) => {
            if (!storage.canUpload) {
              return;
            }
            void addFiles(group, newFiles);
          }}
          onRemoveFile={(group, clientId) => {
            void removeFile(group, clientId);
          }}
          onClose={() => setOpenSlot(null)}
          canModify={canModify}
          canRemoveSaved={canModify}
        />
      )}
    </div>
  );
}
