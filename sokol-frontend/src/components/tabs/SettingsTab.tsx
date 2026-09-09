import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '../../api/errors';
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

const SETTINGS_DELETE_ACTIONS: Record<
  SettingsListKey,
  { remove: (id: EntityId) => Promise<void>; queryKey: readonly unknown[] }
> = {
  auditors: { remove: deleteAuditor, queryKey: queryKeys.settings.auditors },
  departments: { remove: deleteDepartment, queryKey: queryKeys.settings.departments },
  auditTypes: { remove: deleteAuditType, queryKey: queryKeys.settings.auditTypes },
  checkKinds: { remove: deleteCheckKind, queryKey: queryKeys.settings.checkKinds },
  ratings: { remove: deleteEffectivenessRating, queryKey: queryKeys.settings.effectivenessRatings },
};

export function SettingsTab() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [activeList, setActiveList] = useState<SettingsListKey>('auditors');
  const [deleteCandidate, setDeleteCandidate] = useState<DeleteCandidate | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const closeDeleteModal = () => {
    setDeleteCandidate(null);
    setDeleteError('');
    setIsDeleting(false);
  };

  const handleRequestDelete = (entity: SettingsListKey, key: string, id?: EntityId) => {
    setDeleteError('');
    setDeleteCandidate({ entity, key, id });
  };

  const handleConfirmDelete = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!deleteCandidate || isDeleting) {
      return;
    }
    const { entity, id } = deleteCandidate;
    if (id === undefined || id === null || id === '') {
      closeDeleteModal();
      return;
    }
    setIsDeleting(true);
    setDeleteError('');
    try {
      const action = SETTINGS_DELETE_ACTIONS[entity];
      await action.remove(id);
      await queryClient.invalidateQueries({ queryKey: action.queryKey });
      closeDeleteModal();
    } catch (error) {
      setDeleteError(getErrorMessage(error, 'Не удалось удалить запись.'));
      setIsDeleting(false);
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
        <Modal title="Удаление записи" onClose={closeDeleteModal}>
          <form onSubmit={handleConfirmDelete} className="mt-2 space-y-6">
            <p className="text-sm text-gray-600">
              Вы уверены, что хотите удалить запись из таблицы?
            </p>
            {deleteError ? (
              <p className="text-sm text-red-600" role="alert">
                {deleteError}
              </p>
            ) : null}
            <ModalActions
              submitLabel="Да"
              cancelLabel="Нет"
              submitDisabled={isDeleting}
              onCancel={closeDeleteModal}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
