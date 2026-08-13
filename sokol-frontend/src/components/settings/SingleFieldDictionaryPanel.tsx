import { Input } from '../ui/Input';
import { Modal, ModalActions } from '../ui/Modal';
import { ActionButtons } from './ActionButtons';
import { SettingsTableCard, type TableRow } from './SettingsTableCard';
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
  onRequestDelete?: (key: string, id?: EntityId) => void;
  canManage?: boolean;
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
  canManage = true,
}: SingleFieldDictionaryPanelProps<T>) {
  const dict = useSingleFieldDictionary({
    queryKey,
    api,
    getId,
    getValue,
    fieldKey,
    searchText,
  });

  const rows: TableRow[] = dict.items.map((item) => {
    const cells: TableRow['cells'] = [item.value];

    if (canManage) {
      cells.push(
        <ActionButtons
          key={`${item.key}-actions`}
          onEdit={() => dict.beginEdit(item)}
          onDelete={() => onRequestDelete?.(item.key, item.id)}
        />,
      );
    }

    return {
      key: item.key,
      cells,
    };
  });

  return (
    <>
      <SettingsTableCard
        title={title}
        columns={canManage ? [columnLabel, 'Действия'] : [columnLabel]}
        rows={rows}
        isLoading={dict.isLoading}
        error={dict.error}
        onAdd={canManage ? dict.openAdd : undefined}
        searchValue={dict.search}
        onSearchChange={dict.setSearch}
        searchPlaceholder="Поиск"
      />

      {canManage && dict.isAddOpen && (
        <Modal title={addModalTitle}>
          <form onSubmit={dict.handleConfirmAdd} className="mt-4 space-y-4">
            <Input
              label={fieldLabel}
              value={dict.newValue}
              onChange={dict.setNewValue}
              placeholder={placeholder}
            />
            {dict.saveError && (
              <p className="text-sm text-red-600" role="alert">
                {dict.saveError}
              </p>
            )}
            <ModalActions
              submitDisabled={!dict.newValue.trim() || dict.isSaving}
              onCancel={() => dict.setIsAddOpen(false)}
            />
          </form>
        </Modal>
      )}

      {canManage && dict.editCandidate && (
        <Modal title={editModalTitle}>
          <form onSubmit={dict.handleConfirmEdit} className="mt-4 space-y-4">
            <Input
              label={fieldLabel}
              value={dict.editedValue}
              onChange={dict.setEditedValue}
              placeholder={placeholder}
            />
            {dict.saveError && (
              <p className="text-sm text-red-600" role="alert">
                {dict.saveError}
              </p>
            )}
            <ModalActions
              submitDisabled={!dict.editedValue.trim() || dict.isSaving}
              onCancel={() => dict.setEditCandidate(null)}
            />
          </form>
        </Modal>
      )}
    </>
  );
}
