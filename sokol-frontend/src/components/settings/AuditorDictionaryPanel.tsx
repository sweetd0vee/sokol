import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAuditor,
  fetchAuditors,
  updateAuditor,
  type Auditor,
} from '../../api/settings';
import { queryKeys } from '../../api/queryKeys';
import { getErrorMessage } from '../../api/errors';
import { Input } from '../ui/Input';
import { Modal, ModalActions } from '../ui/Modal';
import { ActionButtons } from './ActionButtons';
import { SettingsTableCard, type TableRow } from './SettingsTableCard';

type EntityId = string | number;

type AuditorDictionaryPanelProps = {
  canManage: boolean;
  onRequestDelete: (key: string, id?: EntityId) => void;
};

type AuditorDraft = {
  id?: EntityId;
  fullName: string;
  code: string;
};

const EMPTY_DRAFT: AuditorDraft = { fullName: '', code: '' };
const normalizeAuditorCodeInput = (value: string) =>
  value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);

export function AuditorDictionaryPanel({
  canManage,
  onRequestDelete,
}: AuditorDictionaryPanelProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<AuditorDraft | null>(null);
  const [addDraft, setAddDraft] = useState<AuditorDraft>(EMPTY_DRAFT);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { data = [], isLoading, error } = useQuery({
    queryKey: queryKeys.settings.auditors,
    queryFn: fetchAuditors,
  });

  const normalizedSearch = search.trim().toLocaleLowerCase('ru-RU');
  const auditors = normalizedSearch
    ? data.filter((auditor) =>
        `${auditor.full_name} ${auditor.code}`
          .toLocaleLowerCase('ru-RU')
          .includes(normalizedSearch),
      )
    : data;

  const closeAdd = () => {
    setIsAddOpen(false);
    setAddDraft(EMPTY_DRAFT);
    setSaveError('');
  };

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    const fullName = addDraft.fullName.trim();
    const code = addDraft.code.trim().toUpperCase();
    if (!fullName || code.length !== 3) {
      return;
    }
    setIsSaving(true);
    setSaveError('');
    try {
      await createAuditor({ full_name: fullName, code });
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.auditors });
      closeAdd();
    } catch (saveFailure) {
      setSaveError(getErrorMessage(saveFailure, 'Не удалось добавить аудитора.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editDraft?.id) {
      return;
    }
    const fullName = editDraft.fullName.trim();
    const code = editDraft.code.trim().toUpperCase();
    if (!fullName || code.length !== 3) {
      return;
    }
    setIsSaving(true);
    setSaveError('');
    try {
      await updateAuditor(editDraft.id, { full_name: fullName, code });
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.auditors });
      setEditDraft(null);
    } catch (saveFailure) {
      setSaveError(getErrorMessage(saveFailure, 'Не удалось изменить аудитора.'));
    } finally {
      setIsSaving(false);
    }
  };

  const rows: TableRow[] = auditors.map((auditor: Auditor, index) => {
    const key = String(auditor.id ?? `${auditor.code}-${index}`);
    const cells: TableRow['cells'] = [auditor.full_name, auditor.code];
    if (canManage) {
      cells.push(
        <ActionButtons
          key={`${key}-actions`}
          onEdit={() => {
            setSaveError('');
            setEditDraft({
              id: auditor.id,
              fullName: auditor.full_name,
              code: auditor.code,
            });
          }}
          onDelete={() => onRequestDelete(key, auditor.id)}
        />,
      );
    }
    return { key, cells };
  });

  return (
    <>
      <SettingsTableCard
        title="Аудиторы"
        columns={canManage ? ['ФИО', 'Код', 'Действия'] : ['ФИО', 'Код']}
        rows={rows}
        isLoading={isLoading}
        error={error}
        onAdd={
          canManage
            ? () => {
                setSaveError('');
                setAddDraft(EMPTY_DRAFT);
                setIsAddOpen(true);
              }
            : undefined
        }
        searchValue={search}
        onSearchChange={setSearch}
      />

      {canManage && isAddOpen ? (
        <Modal title="Новый аудитор">
          <form onSubmit={handleAdd} className="mt-4 space-y-4">
            <Input
              label="ФИО аудитора"
              value={addDraft.fullName}
              onChange={(fullName) => setAddDraft((current) => ({ ...current, fullName }))}
              placeholder="Введите ФИО"
            />
            <Input
              label="Код"
              value={addDraft.code}
              onChange={(code) =>
                setAddDraft((current) => ({
                  ...current,
                  code: normalizeAuditorCodeInput(code),
                }))
              }
              placeholder="Три буквы, например GAO"
            />
            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
            <ModalActions
              submitDisabled={
                !addDraft.fullName.trim() || addDraft.code.length !== 3 || isSaving
              }
              onCancel={closeAdd}
            />
          </form>
        </Modal>
      ) : null}

      {canManage && editDraft ? (
        <Modal title="Редактирование аудитора">
          <form onSubmit={handleEdit} className="mt-4 space-y-4">
            <Input
              label="ФИО аудитора"
              value={editDraft.fullName}
              onChange={(fullName) =>
                setEditDraft((current) => current && { ...current, fullName })
              }
              placeholder="Введите ФИО"
            />
            <Input
              label="Код"
              value={editDraft.code}
              onChange={(code) =>
                setEditDraft(
                  (current) =>
                    current && {
                      ...current,
                      code: normalizeAuditorCodeInput(code),
                    },
                )
              }
              placeholder="Три буквы, например GAO"
            />
            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
            <ModalActions
              submitDisabled={
                !editDraft.fullName.trim() || editDraft.code.length !== 3 || isSaving
              }
              onCancel={() => {
                setEditDraft(null);
                setSaveError('');
              }}
            />
          </form>
        </Modal>
      ) : null}
    </>
  );
}
