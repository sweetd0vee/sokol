import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import {
  createCheckKind,
  createDepartment,
  createEffectivenessRating,
  deleteAuditor,
  deleteAuditType,
  deleteCheckKind,
  deleteDepartment,
  deleteEffectivenessRating,
  fetchCheckKinds,
  fetchDepartments,
  fetchEffectivenessRatings,
  updateCheckKind,
  updateDepartment,
  updateEffectivenessRating,
} from '../../api/settings';
import { useAuth } from '../../hooks/useAuth';
import { Modal, ModalActions } from '../ui/Modal';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { AuditorDictionaryPanel } from '../settings/AuditorDictionaryPanel';
import { AuditTypesDictionaryPanel } from '../settings/AuditTypesDictionaryPanel';
import { SingleFieldDictionaryPanel } from '../settings/SingleFieldDictionaryPanel';
import {
  SETTINGS_LIST_OPTIONS,
  type DeleteCandidate,
  type SettingsListKey,
} from '../settings/settingsConstants';

type EntityId = string | number;

export function SettingsTab() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [activeList, setActiveList] = useState<SettingsListKey>('auditors');
  const [deleteCandidate, setDeleteCandidate] = useState<DeleteCandidate | null>(null);

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
        await queryClient.invalidateQueries({ queryKey: queryKeys.settings.auditors });
      } else if (entity === 'departments') {
        await deleteDepartment(id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.settings.departments });
      } else if (entity === 'auditTypes') {
        await deleteAuditType(id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.settings.auditTypes });
      } else if (entity === 'checkKinds') {
        await deleteCheckKind(id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.settings.checkKinds });
      } else if (entity === 'ratings') {
        await deleteEffectivenessRating(id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.settings.effectivenessRatings });
      }
    } finally {
      setDeleteCandidate(null);
    }
  };

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
          <AuditorDictionaryPanel
            canManage={isAdmin}
            onRequestDelete={(key, id) => handleRequestDelete('auditors', key, id)}
          />
        )}

        {activeList === 'departments' && (
          <SingleFieldDictionaryPanel
            title="Департаменты"
            columnLabel="Название"
            fieldLabel="Название департамента"
            addModalTitle="Новый департамент"
            editModalTitle="Редактирование департамента"
            placeholder="Введите название"
            queryKey={['settings', 'departments']}
            api={{
              fetchAll: fetchDepartments,
              create: (payload) => createDepartment({ name: payload.name }),
              update: (id, payload) => updateDepartment(id, { name: payload.name }),
              remove: deleteDepartment,
            }}
            getId={(item) => item.id}
            getValue={(item) => item.name}
            fieldKey="name"
            onRequestDelete={(key, id) => handleRequestDelete('departments', key, id)}
            canManage={isAdmin}
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
            canManage={isAdmin}
          />
        )}

        {activeList === 'auditTypes' && (
          <AuditTypesDictionaryPanel
            canManage={isAdmin}
            onRequestDelete={(key, id) => handleRequestDelete('auditTypes', key, id)}
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
            canManage={isAdmin}
          />
        )}
      </div>

      {isAdmin && deleteCandidate && (
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
