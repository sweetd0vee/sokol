import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButtons } from './ActionButtons';
import type { TableRow } from './SettingsTableCard';
import { filterBySearch } from './settingsHelpers';

type EntityId = string | number;

type SingleFieldDictionaryApi<T> = {
  fetchAll: () => Promise<T[]>;
  create: (payload: Record<string, string>) => Promise<T>;
  update: (id: EntityId, payload: Record<string, string>) => Promise<T>;
  remove: (id: EntityId) => Promise<void>;
};

type UseSingleFieldDictionaryOptions<T> = {
  queryKey: readonly unknown[];
  api: SingleFieldDictionaryApi<T>;
  getId: (item: T) => EntityId | undefined;
  getValue: (item: T) => string;
  fieldKey: string;
  searchText?: (item: T) => string;
};

export function useSingleFieldDictionary<T>({
  queryKey,
  api,
  getId,
  getValue,
  fieldKey,
  searchText,
}: UseSingleFieldDictionaryOptions<T>) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [editCandidate, setEditCandidate] = useState<{
    key: string;
    id?: EntityId;
    value: string;
  } | null>(null);
  const [editedValue, setEditedValue] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKey],
    queryFn: api.fetchAll,
  });

  const filtered = filterBySearch(data ?? [], search, searchText ?? getValue);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [...queryKey] });

  const buildRows = (onRequestDelete: (key: string, id?: EntityId) => void): TableRow[] =>
    filtered.map((item, index) => {
      const value = getValue(item);
      const id = getId(item);
      const key = String(id ?? value ?? index);
      return {
        key,
        cells: [
          value,
          <ActionButtons
            key={`${key}-actions`}
            onEdit={() => {
              setEditedValue(value);
              setEditCandidate({ key, id, value });
            }}
            onDelete={() => onRequestDelete(key, id)}
          />,
        ],
      };
    });

  const handleConfirmAdd = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = newValue.trim();
    if (!trimmed) {
      return;
    }
    try {
      const created = await api.create({ [fieldKey]: trimmed });
      queryClient.setQueryData<T[]>([...queryKey], (current = []) => [...current, created]);
      setNewValue('');
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
    const trimmed = editedValue.trim();
    if (!trimmed) {
      return;
    }
    try {
      await api.update(editCandidate.id, { [fieldKey]: trimmed });
      await invalidate();
      setEditCandidate(null);
    } catch {
      // keep modal open; user can retry
    }
  };

  return {
    search,
    setSearch,
    isLoading,
    error,
    isAddOpen,
    setIsAddOpen,
    newValue,
    setNewValue,
    editCandidate,
    setEditCandidate,
    editedValue,
    setEditedValue,
    buildRows,
    handleConfirmAdd,
    handleConfirmEdit,
    openAdd: () => {
      setNewValue('');
      setIsAddOpen(true);
    },
  };
}
