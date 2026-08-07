import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Auditor, AuditType, CheckKind, EffectivenessRating } from '../../api/settings';
import {
  createAuditor,
  deleteAuditor,
  createAuditType,
  deleteAuditType,
  createCheckKind,
  deleteCheckKind,
  createEffectivenessRating,
  deleteEffectivenessRating,
  fetchAuditors,
  fetchAuditTypes,
  fetchCheckKinds,
  fetchEffectivenessRatings,
  updateAuditType,
  updateAuditor,
  updateCheckKind,
  updateEffectivenessRating,
} from '../../api/settings';
import { Input } from '../ui/Input';
import { Modal, ModalActions } from '../ui/Modal';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ActionButtons } from '../settings/ActionButtons';
import { SettingsTableCard, type TableRow } from '../settings/SettingsTableCard';
import {
  SETTINGS_LIST_OPTIONS,
  type DeleteCandidate,
  type SettingsListKey,
} from '../settings/settingsConstants';
import { filterBySearch } from '../settings/settingsHelpers';

const getAuditorKey = (auditor: Auditor, index: number) =>
  String(auditor.id ?? auditor.full_name ?? index);
const getAuditTypeKey = (type: AuditType, index: number) =>
  String(type.id ?? type.code ?? type.name ?? index);
const getCheckKindKey = (kind: CheckKind, index: number) =>
  String(kind.id ?? kind.label ?? index);
const getRatingKey = (rating: EffectivenessRating, index: number) =>
  String(rating.id ?? rating.code ?? rating.label ?? index);

export function SettingsTab() {
  const queryClient = useQueryClient();
  const [activeList, setActiveList] = useState<SettingsListKey>('auditors');
  const [auditorSearch, setAuditorSearch] = useState('');
  const [auditTypeSearch, setAuditTypeSearch] = useState('');
  const [checkKindSearch, setCheckKindSearch] = useState('');
  const [ratingSearch, setRatingSearch] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState<DeleteCandidate | null>(null);
  const [isAddAuditorOpen, setIsAddAuditorOpen] = useState(false);
  const [newAuditorName, setNewAuditorName] = useState('');
  const [editAuditorCandidate, setEditAuditorCandidate] = useState<{
    key: string;
    id?: Auditor['id'];
    name: string;
  } | null>(null);
  const [editedAuditorName, setEditedAuditorName] = useState('');
  const [isAddAuditTypeOpen, setIsAddAuditTypeOpen] = useState(false);
  const [newAuditTypeCode, setNewAuditTypeCode] = useState('');
  const [newAuditTypeName, setNewAuditTypeName] = useState('');
  const [editAuditTypeCandidate, setEditAuditTypeCandidate] = useState<{
    key: string;
    id?: string | number;
    code: string;
    name: string;
  } | null>(null);
  const [editedAuditTypeCode, setEditedAuditTypeCode] = useState('');
  const [editedAuditTypeName, setEditedAuditTypeName] = useState('');
  const [isAddCheckKindOpen, setIsAddCheckKindOpen] = useState(false);
  const [newCheckKindLabel, setNewCheckKindLabel] = useState('');
  const [editCheckKindCandidate, setEditCheckKindCandidate] = useState<{
    key: string;
    id?: string | number;
    label: string;
  } | null>(null);
  const [editedCheckKindLabel, setEditedCheckKindLabel] = useState('');
  const [isAddRatingOpen, setIsAddRatingOpen] = useState(false);
  const [newRatingLabel, setNewRatingLabel] = useState('');
  const [editRatingCandidate, setEditRatingCandidate] = useState<{
    key: string;
    id?: string | number;
    label: string;
  } | null>(null);
  const [editedRatingLabel, setEditedRatingLabel] = useState('');
  const {
    data: auditors,
    isLoading: auditorsLoading,
    error: auditorsError,
  } = useQuery({
    queryKey: ['settings', 'auditors'],
    queryFn: fetchAuditors,
  });
  const {
    data: auditTypes,
    isLoading: auditTypesLoading,
    error: auditTypesError,
  } = useQuery({
    queryKey: ['settings', 'audit-types'],
    queryFn: fetchAuditTypes,
  });
  const {
    data: checkKinds,
    isLoading: checkKindsLoading,
    error: checkKindsError,
  } = useQuery({
    queryKey: ['settings', 'check-kinds'],
    queryFn: fetchCheckKinds,
  });
  const {
    data: effectivenessRatings,
    isLoading: ratingsLoading,
    error: ratingsError,
  } = useQuery({
    queryKey: ['settings', 'effectiveness-ratings'],
    queryFn: fetchEffectivenessRatings,
  });

  const filteredAuditors = filterBySearch(auditors ?? [], auditorSearch, (auditor) => auditor.full_name ?? '');
  const filteredAuditTypes = filterBySearch(auditTypes ?? [], auditTypeSearch, (type) => `${type.code} ${type.name}`);
  const filteredCheckKinds = filterBySearch(
    checkKinds ?? [],
    checkKindSearch,
    (kind) => kind.label,
  );
  const filteredRatings = filterBySearch(
    effectivenessRatings ?? [],
    ratingSearch,
    (rating) => `${rating.code ?? ''} ${rating.label}`,
  );

  const handleDelete = async (entity: SettingsListKey, key: string, id?: string | number) => {
    void key;
    const identifier = id;
    if (identifier === undefined || identifier === null || identifier === '') {
      return;
    }
    if (entity === 'auditors') {
      await deleteAuditor(identifier);
      await queryClient.invalidateQueries({ queryKey: ['settings', 'auditors'] });
      return;
    }
    if (entity === 'auditTypes') {
      await deleteAuditType(identifier);
      await queryClient.invalidateQueries({ queryKey: ['settings', 'audit-types'] });
      return;
    }
    if (entity === 'checkKinds') {
      await deleteCheckKind(identifier);
      await queryClient.invalidateQueries({ queryKey: ['settings', 'check-kinds'] });
      return;
    }
    if (entity === 'ratings') {
      await deleteEffectivenessRating(identifier);
      await queryClient.invalidateQueries({ queryKey: ['settings', 'effectiveness-ratings'] });
    }
  };

  const handleRequestDelete = (entity: SettingsListKey, key: string, id?: string | number) => {
    setDeleteCandidate({ entity, key, id });
  };
  const handleConfirmDelete = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!deleteCandidate) {
      return;
    }
    try {
      await handleDelete(deleteCandidate.entity, deleteCandidate.key, deleteCandidate.id);
    } finally {
      setDeleteCandidate(null);
    }
  };
  const handleCancelDelete = () => {
    setDeleteCandidate(null);
  };
  const handleRequestAddAuditor = () => {
    setNewAuditorName('');
    setIsAddAuditorOpen(true);
  };
  const handleCancelAddAuditor = () => {
    setIsAddAuditorOpen(false);
  };
  const handleConfirmAddAuditor = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmedName = newAuditorName.trim();
    if (!trimmedName) {
      return;
    }
    try {
      const createdAuditor = await createAuditor({ full_name: trimmedName });
      queryClient.setQueryData<Auditor[]>(['settings', 'auditors'], (current = []) => [...current, createdAuditor]);
      setNewAuditorName('');
      setIsAddAuditorOpen(false);
    } catch {
      // keep modal open; user can retry
    }
  };
  const handleRequestEditAuditor = (key: string, name: string, id?: Auditor['id']) => {
    setEditedAuditorName(name);
    setEditAuditorCandidate({ key, name, id });
  };
  const handleCancelEditAuditor = () => {
    setEditAuditorCandidate(null);
  };
  const handleConfirmEditAuditor = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!editAuditorCandidate) {
      return;
    }
    const trimmedName = editedAuditorName.trim();
    if (!trimmedName) {
      return;
    }
    if (editAuditorCandidate.id === undefined || editAuditorCandidate.id === null) {
      return;
    }
    try {
      await updateAuditor(editAuditorCandidate.id, { full_name: trimmedName });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'auditors'] });
      setEditAuditorCandidate(null);
    } catch {
      // keep modal open; user can retry
    }
  };
  const handleRequestEditAuditType = (key: string, code: string, name: string, id?: string | number) => {
    setEditedAuditTypeCode(code);
    setEditedAuditTypeName(name);
    setEditAuditTypeCandidate({ key, code, name, id });
  };
  const handleCancelEditAuditType = () => {
    setEditAuditTypeCandidate(null);
  };
  const handleConfirmEditAuditType = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!editAuditTypeCandidate) {
      return;
    }
    const trimmedCode = editedAuditTypeCode.trim();
    const trimmedName = editedAuditTypeName.trim();
    if (!trimmedCode || !trimmedName) {
      return;
    }
    const identifier = editAuditTypeCandidate.id;
    if (!identifier) {
      return;
    }
    try {
      await updateAuditType(identifier, { code: trimmedCode, name: trimmedName });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'audit-types'] });
      setEditAuditTypeCandidate(null);
    } catch {
      // keep modal open; user can retry
    }
  };
  const handleRequestEditCheckKind = (key: string, label: string, id?: string | number) => {
    setEditedCheckKindLabel(label);
    setEditCheckKindCandidate({ key, label, id });
  };
  const handleCancelEditCheckKind = () => {
    setEditCheckKindCandidate(null);
  };
  const handleConfirmEditCheckKind = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!editCheckKindCandidate) {
      return;
    }
    const trimmedLabel = editedCheckKindLabel.trim();
    if (!trimmedLabel) {
      return;
    }
    const identifier = editCheckKindCandidate.id;
    if (!identifier) {
      return;
    }
    try {
      await updateCheckKind(identifier, { label: trimmedLabel });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'check-kinds'] });
      setEditCheckKindCandidate(null);
    } catch {
      // keep modal open; user can retry
    }
  };
  const handleRequestEditRating = (key: string, label: string, id?: string | number) => {
    setEditedRatingLabel(label);
    setEditRatingCandidate({ key, label, id });
  };
  const handleCancelEditRating = () => {
    setEditRatingCandidate(null);
  };
  const handleConfirmEditRating = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!editRatingCandidate) {
      return;
    }
    const trimmedLabel = editedRatingLabel.trim();
    if (!trimmedLabel) {
      return;
    }
    const identifier = editRatingCandidate.id;
    if (!identifier) {
      return;
    }
    try {
      await updateEffectivenessRating(identifier, { label: trimmedLabel });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'effectiveness-ratings'] });
      setEditRatingCandidate(null);
    } catch {
      // keep modal open; user can retry
    }
  };
  const handleRequestAddAuditType = () => {
    setNewAuditTypeCode('');
    setNewAuditTypeName('');
    setIsAddAuditTypeOpen(true);
  };
  const handleCancelAddAuditType = () => {
    setIsAddAuditTypeOpen(false);
  };
  const handleConfirmAddAuditType = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmedCode = newAuditTypeCode.trim();
    const trimmedName = newAuditTypeName.trim();
    if (!trimmedCode || !trimmedName) {
      return;
    }
    try {
      const createdAuditType = await createAuditType({ code: trimmedCode, name: trimmedName });
      queryClient.setQueryData<AuditType[]>(['settings', 'audit-types'], (current = []) => [...current, createdAuditType]);
      setNewAuditTypeCode('');
      setNewAuditTypeName('');
      setIsAddAuditTypeOpen(false);
    } catch {
      // keep modal open; user can retry
    }
  };
  const handleRequestAddCheckKind = () => {
    setNewCheckKindLabel('');
    setIsAddCheckKindOpen(true);
  };
  const handleCancelAddCheckKind = () => {
    setIsAddCheckKindOpen(false);
  };
  const handleConfirmAddCheckKind = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmedLabel = newCheckKindLabel.trim();
    if (!trimmedLabel) {
      return;
    }
    try {
      const createdCheckKind = await createCheckKind({ label: trimmedLabel });
      queryClient.setQueryData<CheckKind[]>(['settings', 'check-kinds'], (current = []) => [
        ...current,
        createdCheckKind,
      ]);
      setNewCheckKindLabel('');
      setIsAddCheckKindOpen(false);
    } catch {
      // keep modal open; user can retry
    }
  };
  const handleRequestAddRating = () => {
    setNewRatingLabel('');
    setIsAddRatingOpen(true);
  };
  const handleCancelAddRating = () => {
    setIsAddRatingOpen(false);
  };
  const handleConfirmAddRating = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmedLabel = newRatingLabel.trim();
    if (!trimmedLabel) {
      return;
    }
    try {
      const createdRating = await createEffectivenessRating({ label: trimmedLabel });
      queryClient.setQueryData<EffectivenessRating[]>(['settings', 'effectiveness-ratings'], (current = []) => [
        ...current,
        createdRating,
      ]);
      setNewRatingLabel('');
      setIsAddRatingOpen(false);
    } catch {
      // keep modal open; user can retry
    }
  };

  const auditorRows: TableRow[] = filteredAuditors.map((auditor, index) => {
    const key = getAuditorKey(auditor, index);
    return {
      key,
      cells: [
        auditor.full_name,
        <ActionButtons
          key={`${key}-actions`}
          onEdit={() => handleRequestEditAuditor(key, auditor.full_name, auditor.id)}
          onDelete={() => handleRequestDelete('auditors', key, auditor.id)}
        />,
      ],
    };
  });
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
          onEdit={() => handleRequestEditAuditType(key, type.code, type.name, identifier)}
          onDelete={() => handleRequestDelete('auditTypes', key, identifier)}
        />,
      ],
    };
  });
  const checkKindRows: TableRow[] = filteredCheckKinds.map((kind, index) => {
    const key = getCheckKindKey(kind, index);
    const identifier = kind.id;
    return {
      key,
      cells: [
        kind.label,
        <ActionButtons
          key={`${key}-actions`}
          onEdit={() => handleRequestEditCheckKind(key, kind.label, identifier)}
          onDelete={() => handleRequestDelete('checkKinds', key, identifier)}
        />,
      ],
    };
  });
  const ratingRows: TableRow[] = filteredRatings.map((rating, index) => {
    const key = getRatingKey(rating, index);
    const identifier = rating.id;
    return {
      key,
      cells: [
        rating.label,
        <ActionButtons
          key={`${key}-actions`}
          onEdit={() => handleRequestEditRating(key, rating.label, identifier)}
          onDelete={() => handleRequestDelete('ratings', key, identifier)}
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
          <SettingsTableCard
            title="Аудиторы"
            columns={['ФИО', 'Действия']}
            rows={auditorRows}
            isLoading={auditorsLoading}
            error={auditorsError}
            onAdd={handleRequestAddAuditor}
            searchValue={auditorSearch}
            onSearchChange={setAuditorSearch}
            searchPlaceholder="Поиск"
          />
        )}
        {activeList === 'auditTypes' && (
          <SettingsTableCard
            title="Вид аудита"
            columns={['Код', 'Название', 'Действия']}
            rows={auditTypeRows}
            isLoading={auditTypesLoading}
            error={auditTypesError}
            onAdd={handleRequestAddAuditType}
            searchValue={auditTypeSearch}
            onSearchChange={setAuditTypeSearch}
            searchPlaceholder="Поиск"
          />
        )}
        {activeList === 'checkKinds' && (
          <SettingsTableCard
            title="Виды проверок"
            columns={['Вид', 'Действия']}
            rows={checkKindRows}
            isLoading={checkKindsLoading}
            error={checkKindsError}
            onAdd={handleRequestAddCheckKind}
            searchValue={checkKindSearch}
            onSearchChange={setCheckKindSearch}
            searchPlaceholder="Поиск"
          />
        )}
        {activeList === 'ratings' && (
          <SettingsTableCard
            title="Оценки эффективности"
            columns={['Оценка', 'Действия']}
            rows={ratingRows}
            isLoading={ratingsLoading}
            error={ratingsError}
            onAdd={handleRequestAddRating}
            searchValue={ratingSearch}
            onSearchChange={setRatingSearch}
            searchPlaceholder="Поиск"
          />
        )}
      </div>

      {isAddAuditorOpen && (
        <Modal title="Новый аудитор">
          <form onSubmit={handleConfirmAddAuditor} className="mt-4 space-y-4">
            <Input
              label="ФИО аудитора"
              value={newAuditorName}
              onChange={setNewAuditorName}
              placeholder="Введите ФИО"
            />
            <ModalActions submitDisabled={!newAuditorName.trim()} onCancel={handleCancelAddAuditor} />
          </form>
        </Modal>
      )}

      {editAuditorCandidate && (
        <Modal title="Редактирование аудитора">
          <form onSubmit={handleConfirmEditAuditor} className="mt-4 space-y-4">
            <Input
              label="ФИО аудитора"
              value={editedAuditorName}
              onChange={setEditedAuditorName}
              placeholder="Введите ФИО"
            />
            <ModalActions submitDisabled={!editedAuditorName.trim()} onCancel={handleCancelEditAuditor} />
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
              onCancel={handleCancelEditAuditType}
            />
          </form>
        </Modal>
      )}

      {editCheckKindCandidate && (
        <Modal title="Редактирование вида проверки">
          <form onSubmit={handleConfirmEditCheckKind} className="mt-4 space-y-4">
            <Input
              label="Вид"
              value={editedCheckKindLabel}
              onChange={setEditedCheckKindLabel}
              placeholder="Введите вид проверки"
            />
            <ModalActions
              submitDisabled={!editedCheckKindLabel.trim()}
              onCancel={handleCancelEditCheckKind}
            />
          </form>
        </Modal>
      )}

      {editRatingCandidate && (
        <Modal title="Редактирование оценки">
          <form onSubmit={handleConfirmEditRating} className="mt-4 space-y-4">
            <Input
              label="Оценка"
              value={editedRatingLabel}
              onChange={setEditedRatingLabel}
              placeholder="Введите оценку"
            />
            <ModalActions
              submitDisabled={!editedRatingLabel.trim()}
              onCancel={handleCancelEditRating}
            />
          </form>
        </Modal>
      )}

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
              onCancel={handleCancelAddAuditType}
            />
          </form>
        </Modal>
      )}

      {isAddCheckKindOpen && (
        <Modal title="Новый вид проверки">
          <form onSubmit={handleConfirmAddCheckKind} className="mt-4 space-y-4">
            <Input
              label="Вид"
              value={newCheckKindLabel}
              onChange={setNewCheckKindLabel}
              placeholder="Введите вид проверки"
            />
            <ModalActions submitDisabled={!newCheckKindLabel.trim()} onCancel={handleCancelAddCheckKind} />
          </form>
        </Modal>
      )}

      {isAddRatingOpen && (
        <Modal title="Новая оценка эффективности">
          <form onSubmit={handleConfirmAddRating} className="mt-4 space-y-4">
            <Input
              label="Оценка"
              value={newRatingLabel}
              onChange={setNewRatingLabel}
              placeholder="Введите оценку"
            />
            <ModalActions submitDisabled={!newRatingLabel.trim()} onCancel={handleCancelAddRating} />
          </form>
        </Modal>
      )}

      {deleteCandidate && (
        <Modal title="Удаление записи">
          <form onSubmit={handleConfirmDelete} className="mt-2 space-y-6">
            <p className="text-sm text-gray-600">
              Вы уверены, что хотите удалить запись из таблицы?
            </p>
            <ModalActions submitLabel="Да" cancelLabel="Нет" onCancel={handleCancelDelete} />
          </form>
        </Modal>
      )}
    </div>
  );
}
