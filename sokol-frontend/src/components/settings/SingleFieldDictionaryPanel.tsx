import { Input } from '../ui/Input';
import { Modal, ModalActions } from '../ui/Modal';
import { SettingsTableCard } from './SettingsTableCard';
import { useSingleFieldDictionary } from './useSingleFieldDictionary';

type EntityId = string | number;

type SingleFieldDictionaryApi<T> = {
  fetchAll: () => Promise<T[]>;
  create: (payload: Record<string, string>) => Promise<T>;
  update: (id: EntityId, payload: Record<string, string>) => Promise<T>;
  remove: (id: EntityId) => Promise<void>;
};

type SingleFieldDictionaryPanelProps<T> = {
  title: string;
  columnLabel: string;
  fieldLabel: string;
  addModalTitle: string;
  editModalTitle: string;
  placeholder: string;
  queryKey: readonly unknown[];
  api: SingleFieldDictionaryApi<T>;
  getId: (item: T) => EntityId | undefined;
  getValue: (item: T) => string;
  fieldKey: string;
  searchText?: (item: T) => string;
  onRequestDelete: (key: string, id?: EntityId) => void;
};

export function SingleFieldDictionaryPanel<T>({
  title,
  columnLabel,
  fieldLabel,
  addModalTitle,
  editModalTitle,
  placeholder,
  queryKey,
  api,
  getId,
  getValue,
  fieldKey,
  searchText,
  onRequestDelete,
}: SingleFieldDictionaryPanelProps<T>) {
  const dict = useSingleFieldDictionary({
    queryKey,
    api,
    getId,
    getValue,
    fieldKey,
    searchText,
  });

  return (
    <>
      <SettingsTableCard
        title={title}
        columns={[columnLabel, 'Действия']}
        rows={dict.buildRows(onRequestDelete)}
        isLoading={dict.isLoading}
        error={dict.error}
        onAdd={dict.openAdd}
        searchValue={dict.search}
        onSearchChange={dict.setSearch}
        searchPlaceholder="Поиск"
      />

      {dict.isAddOpen && (
        <Modal title={addModalTitle}>
          <form onSubmit={dict.handleConfirmAdd} className="mt-4 space-y-4">
            <Input
              label={fieldLabel}
              value={dict.newValue}
              onChange={dict.setNewValue}
              placeholder={placeholder}
            />
            <ModalActions
              submitDisabled={!dict.newValue.trim()}
              onCancel={() => dict.setIsAddOpen(false)}
            />
          </form>
        </Modal>
      )}

      {dict.editCandidate && (
        <Modal title={editModalTitle}>
          <form onSubmit={dict.handleConfirmEdit} className="mt-4 space-y-4">
            <Input
              label={fieldLabel}
              value={dict.editedValue}
              onChange={dict.setEditedValue}
              placeholder={placeholder}
            />
            <ModalActions
              submitDisabled={!dict.editedValue.trim()}
              onCancel={() => dict.setEditCandidate(null)}
            />
          </form>
        </Modal>
      )}
    </>
  );
}
