import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import {
  createAuditType,
  fetchAuditTypes,
  updateAuditType,
  type AuditType,
} from '../../api/settings';
import { Input } from '../ui/Input';
import { Modal, ModalActions } from '../ui/Modal';
import { ActionButtons } from './ActionButtons';
import { SettingsTableCard, type TableRow } from './SettingsTableCard';
import { filterBySearch } from './settingsHelpers';

type EntityId = string | number;

const getAuditTypeKey = (type: AuditType, index: number) =>
  String(type.id ?? type.code ?? type.name ?? index);

type AuditTypesDictionaryPanelProps = {
  canManage: boolean;
  onRequestDelete: (key: string, id?: EntityId) => void;
};

export function AuditTypesDictionaryPanel({
  canManage,
  onRequestDelete,
}: AuditTypesDictionaryPanelProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [editCandidate, setEditCandidate] = useState<{
    key: string;
    id?: EntityId;
    code: string;
    name: string;
  } | null>(null);
  const [editedCode, setEditedCode] = useState('');
  const [editedName, setEditedName] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.settings.auditTypes,
    queryFn: fetchAuditTypes,
  });

  const filtered = filterBySearch(data ?? [], search, (type) => `${type.code} ${type.name}`);

  const handleConfirmAdd = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmedCode = newCode.trim();
    const trimmedName = newName.trim();
    if (!trimmedCode || !trimmedName) {
      return;
    }
    try {
      const created = await createAuditType({ code: trimmedCode, name: trimmedName });
      queryClient.setQueryData<AuditType[]>(queryKeys.settings.auditTypes, (current = []) => [
        ...current,
        created,
      ]);
      setNewCode('');
      setNewName('');
      setIsAddOpen(false);
    } catch {
      // keep modal open; user can retry
    }
  };

  const handleConfirmEdit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!editCandidate?.id) {
      return;
    }
    const trimmedCode = editedCode.trim();
    const trimmedName = editedName.trim();
    if (!trimmedCode || !trimmedName) {
      return;
    }
    try {
      await updateAuditType(editCandidate.id, { code: trimmedCode, name: trimmedName });
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.auditTypes });
      setEditCandidate(null);
    } catch {
      // keep modal open; user can retry
    }
  };

  const rows: TableRow[] = filtered.map((type, index) => {
    const key = getAuditTypeKey(type, index);
    const identifier = type.id;
    const cells: TableRow['cells'] = [type.code, type.name];

    if (canManage) {
      cells.push(
        <ActionButtons
          key={`${key}-actions`}
          onEdit={() => {
            setEditedCode(type.code);
            setEditedName(type.name);
            setEditCandidate({ key, code: type.code, name: type.name, id: identifier });
          }}
          onDelete={() => onRequestDelete(key, identifier)}
        />,
      );
    }

    return { key, cells };
  });

  return (
    <>
      <SettingsTableCard
        title="Вид аудита"
        columns={canManage ? ['Код', 'Название', 'Действия'] : ['Код', 'Название']}
        rows={rows}
        isLoading={isLoading}
        error={error}
        onAdd={
          canManage
            ? () => {
                setNewCode('');
                setNewName('');
                setIsAddOpen(true);
              }
            : undefined
        }
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск"
      />

      {canManage && isAddOpen && (
        <Modal title="Новый вид аудита">
          <form onSubmit={handleConfirmAdd} className="mt-4 space-y-4">
            <Input label="Код" value={newCode} onChange={setNewCode} placeholder="Введите код" />
            <Input label="Название" value={newName} onChange={setNewName} placeholder="Введите название" />
            <ModalActions
              submitDisabled={!newCode.trim() || !newName.trim()}
              onCancel={() => setIsAddOpen(false)}
            />
          </form>
        </Modal>
      )}

      {canManage && editCandidate && (
        <Modal title="Редактирование вида аудита">
          <form onSubmit={handleConfirmEdit} className="mt-4 space-y-4">
            <Input label="Код" value={editedCode} onChange={setEditedCode} placeholder="Введите код" />
            <Input
              label="Название"
              value={editedName}
              onChange={setEditedName}
              placeholder="Введите название"
            />
            <ModalActions
              submitDisabled={!editedCode.trim() || !editedName.trim()}
              onCancel={() => setEditCandidate(null)}
            />
          </form>
        </Modal>
      )}
    </>
  );
}
