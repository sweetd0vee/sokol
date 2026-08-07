import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuditType } from '../../api/settings';
import {
  createAuditor,
  createAuditType,
  createCheckKind,
  createEffectivenessRating,
  deleteAuditor,
  deleteAuditType,
  deleteCheckKind,
  deleteEffectivenessRating,
  fetchAuditors,
  fetchAuditTypes,
  fetchCheckKinds,
  fetchEffectivenessRatings,
  updateAuditor,
  updateAuditType,
  updateCheckKind,
  updateEffectivenessRating,
} from '../../api/settings';
import { Input } from '../ui/Input';
import { Modal, ModalActions } from '../ui/Modal';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ActionButtons } from '../settings/ActionButtons';
import { SingleFieldDictionaryPanel } from '../settings/SingleFieldDictionaryPanel';
import { SettingsTableCard, type TableRow } from '../settings/SettingsTableCard';
import {
  SETTINGS_LIST_OPTIONS,
  type DeleteCandidate,
  type SettingsListKey,
} from '../settings/settingsConstants';
import { filterBySearch } from '../settings/settingsHelpers';

type EntityId = string | number;

const getAuditTypeKey = (type: AuditType, index: number) =>
  String(type.id ?? type.code ?? type.name ?? index);

export function SettingsTab() {
  const queryClient = useQueryClient();
  const [activeList, setActiveList] = useState<SettingsListKey>('auditors');
  const [deleteCandidate, setDeleteCandidate] = useState<DeleteCandidate | null>(null);

  const [auditTypeSearch, setAuditTypeSearch] = useState('');
  const [isAddAuditTypeOpen, setIsAddAuditTypeOpen] = useState(false);
  const [newAuditTypeCode, setNewAuditTypeCode] = useState('');
  const [newAuditTypeName, setNewAuditTypeName] = useState('');
  const [editAuditTypeCandidate, setEditAuditTypeCandidate] = useState<{
    key: string;
    id?: EntityId;
    code: string;
    name: string;
  } | null>(null);
  const [editedAuditTypeCode, setEditedAuditTypeCode] = useState('');
  const [editedAuditTypeName, setEditedAuditTypeName] = useState('');

  const {
    data: auditTypes,
    isLoading: auditTypesLoading,
    error: auditTypesError,
  } = useQuery({
    queryKey: ['settings', 'audit-types'],
    queryFn: fetchAuditTypes,
  });

  const filteredAuditTypes = filterBySearch(
    auditTypes ?? [],
    auditTypeSearch,
    (type) => `${type.code} ${type.name}`,
  );

  const handleRequestDelete = (entity: SettingsListKey, key: string, id?: EntityId) => {
    setDeleteCandidate({ entity, key, id });
  };

  const handleConfirmDelete = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!deleteCandidate) {
      return;
    }
    const { entity, id } = deleteCandidate;
    if (id === undefined || id === null || id === '') {
      setDeleteCandidate(null);
      return;
    }
    try {
      if (entity === 'auditors') {
        await deleteAuditor(id);
        await queryClient.invalidateQueries({ queryKey: ['settings', 'auditors'] });
      } else if (entity === 'auditTypes') {
        await deleteAuditType(id);
        await queryClient.invalidateQueries({ queryKey: ['settings', 'audit-types'] });
      } else if (entity === 'checkKinds') {
        await deleteCheckKind(id);
        await queryClient.invalidateQueries({ queryKey: ['settings', 'check-kinds'] });
      } else if (entity === 'ratings') {
        await deleteEffectivenessRating(id);
        await queryClient.invalidateQueries({ queryKey: ['settings', 'effectiveness-ratings'] });
      }
    } finally {
      setDeleteCandidate(null);
    }
  };

  const handleConfirmAddAuditType = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmedCode = newAuditTypeCode.trim();
    const trimmedName = newAuditTypeName.trim();
    if (!trimmedCode || !trimmedName) {
      return;
    }
    try {
      const created = await createAuditType({ code: trimmedCode, name: trimmedName });
      queryClient.setQueryData<AuditType[]>(['settings', 'audit-types'], (current = []) => [
        ...current,
        created,
      ]);
      setNewAuditTypeCode('');
      setNewAuditTypeName('');
      setIsAddAuditTypeOpen(false);
    } catch {
      // keep modal open; user can retry
    }
  };

  const handleConfirmEditAuditType = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!editAuditTypeCandidate?.id) {
      return;
    }
    const trimmedCode = editedAuditTypeCode.trim();
    const trimmedName = editedAuditTypeName.trim();
    if (!trimmedCode || !trimmedName) {
      return;
    }
    try {
      await updateAuditType(editAuditTypeCandidate.id, { code: trimmedCode, name: trimmedName });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'audit-types'] });
      setEditAuditTypeCandidate(null);
    } catch {
      // keep modal open; user can retry
    }
  };

  const auditTypeRows: TableRow[] = filteredAuditTypes.map((type, index) => {
    const key = getAuditTypeKey(type, index);
    const identifier = type.id;
    return {
      key,
      cells: [
        type.code,
        type.name,
        <ActionButtons
          key={`${key}-actions`}
          onEdit={() => {
            setEditedAuditTypeCode(type.code);
            setEditedAuditTypeName(type.name);
            setEditAuditTypeCandidate({ key, code: type.code, name: type.name, id: identifier });
          }}
          onDelete={() => handleRequestDelete('auditTypes', key, identifier)}
        />,
      ],
    };
  });

  return (
    <div className="w-full space-y-4 text-left">
      <div className="space-y-3">
        <PageHeader title="Справочники" />
        <SegmentedControl
          value={activeList}
          options={SETTINGS_LIST_OPTIONS}
          onChange={setActiveList}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {activeList === 'auditors' && (
          <SingleFieldDictionaryPanel
            title="Аудиторы"
            columnLabel="ФИО"
            fieldLabel="ФИО аудитора"
            addModalTitle="Новый аудитор"
            editModalTitle="Редактирование аудитора"
            placeholder="Введите ФИО"
            queryKey={['settings', 'auditors']}
            api={{
              fetchAll: fetchAuditors,
              create: (payload) => createAuditor({ full_name: payload.full_name }),
              update: (id, payload) => updateAuditor(id, { full_name: payload.full_name }),
              remove: deleteAuditor,
            }}
            getId={(item) => item.id}
            getValue={(item) => item.full_name}
            fieldKey="full_name"
            onRequestDelete={(key, id) => handleRequestDelete('auditors', key, id)}
          />
        )}

        {activeList === 'auditTypes' && (
          <SettingsTableCard
            title="Вид аудита"
            columns={['Код', 'Название', 'Действия']}
            rows={auditTypeRows}
            isLoading={auditTypesLoading}
            error={auditTypesError}
            onAdd={() => {
              setNewAuditTypeCode('');
              setNewAuditTypeName('');
              setIsAddAuditTypeOpen(true);
            }}
            searchValue={auditTypeSearch}
            onSearchChange={setAuditTypeSearch}
            searchPlaceholder="Поиск"
          />
        )}

        {activeList === 'checkKinds' && (
          <SingleFieldDictionaryPanel
            title="Виды проверок"
            columnLabel="Вид"
            fieldLabel="Вид"
            addModalTitle="Новый вид проверки"
            editModalTitle="Редактирование вида проверки"
            placeholder="Введите вид проверки"
            queryKey={['settings', 'check-kinds']}
            api={{
              fetchAll: fetchCheckKinds,
              create: (payload) => createCheckKind({ label: payload.label }),
              update: (id, payload) => updateCheckKind(id, { label: payload.label }),
              remove: deleteCheckKind,
            }}
            getId={(item) => item.id}
            getValue={(item) => item.label}
            fieldKey="label"
            onRequestDelete={(key, id) => handleRequestDelete('checkKinds', key, id)}
          />
        )}

        {activeList === 'ratings' && (
          <SingleFieldDictionaryPanel
            title="Оценки эффективности"
            columnLabel="Оценка"
            fieldLabel="Оценка"
            addModalTitle="Новая оценка эффективности"
            editModalTitle="Редактирование оценки"
            placeholder="Введите оценку"
            queryKey={['settings', 'effectiveness-ratings']}
            api={{
              fetchAll: fetchEffectivenessRatings,
              create: (payload) => createEffectivenessRating({ label: payload.label }),
              update: (id, payload) => updateEffectivenessRating(id, { label: payload.label }),
              remove: deleteEffectivenessRating,
            }}
            getId={(item) => item.id}
            getValue={(item) => item.label}
            fieldKey="label"
            searchText={(item) => `${item.code ?? ''} ${item.label}`}
            onRequestDelete={(key, id) => handleRequestDelete('ratings', key, id)}
          />
        )}
      </div>

      {isAddAuditTypeOpen && (
        <Modal title="Новый вид аудита">
          <form onSubmit={handleConfirmAddAuditType} className="mt-4 space-y-4">
            <Input
              label="Код"
              value={newAuditTypeCode}
              onChange={setNewAuditTypeCode}
              placeholder="Введите код"
            />
            <Input
              label="Название"
              value={newAuditTypeName}
              onChange={setNewAuditTypeName}
              placeholder="Введите название"
            />
            <ModalActions
              submitDisabled={!newAuditTypeCode.trim() || !newAuditTypeName.trim()}
              onCancel={() => setIsAddAuditTypeOpen(false)}
            />
          </form>
        </Modal>
      )}

      {editAuditTypeCandidate && (
        <Modal title="Редактирование вида аудита">
          <form onSubmit={handleConfirmEditAuditType} className="mt-4 space-y-4">
            <Input
              label="Код"
              value={editedAuditTypeCode}
              onChange={setEditedAuditTypeCode}
              placeholder="Введите код"
            />
            <Input
              label="Название"
              value={editedAuditTypeName}
              onChange={setEditedAuditTypeName}
              placeholder="Введите название"
            />
            <ModalActions
              submitDisabled={!editedAuditTypeCode.trim() || !editedAuditTypeName.trim()}
              onCancel={() => setEditAuditTypeCandidate(null)}
            />
          </form>
        </Modal>
      )}

      {deleteCandidate && (
        <Modal title="Удаление записи">
          <form onSubmit={handleConfirmDelete} className="mt-2 space-y-6">
            <p className="text-sm text-gray-600">
              Вы уверены, что хотите удалить запись из таблицы?
            </p>
            <ModalActions
              submitLabel="Да"
              cancelLabel="Нет"
              onCancel={() => setDeleteCandidate(null)}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
