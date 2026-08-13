import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '../../api/errors';
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

export type SingleFieldDictionaryItem = {
  key: string;
  id?: EntityId;
  value: string;
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKey],
    queryFn: api.fetchAll,
  });

  const filtered = filterBySearch(data ?? [], search, searchText ?? getValue);

  const items: SingleFieldDictionaryItem[] = filtered.map((item, index) => {
    const value = getValue(item);
    const id = getId(item);
    return {
      key: String(id ?? value ?? index),
      id,
      value,
    };
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [...queryKey] });

  const hasValidId = (id: EntityId | undefined | null): id is EntityId =>
    id !== undefined && id !== null && id !== '';

  const handleConfirmAdd = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = newValue.trim();
    if (!trimmed) {
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const created = await api.create({ [fieldKey]: trimmed });
      queryClient.setQueryData<T[]>([...queryKey], (current = []) => [...current, created]);
      setNewValue('');
      setIsAddOpen(false);
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Не удалось сохранить запись.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmEdit = async (event?: FormEvent) => {
    event?.preventDefault();
    const candidateId = editCandidate?.id;
    if (!hasValidId(candidateId)) {
      return;
    }
    const trimmed = editedValue.trim();
    if (!trimmed) {
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await api.update(candidateId, { [fieldKey]: trimmed });
      await invalidate();
      setEditCandidate(null);
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Не удалось сохранить запись.'));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    search,
    setSearch,
    isLoading,
    error,
    isAddOpen,
    setIsAddOpen: (isOpen: boolean) => {
      setSaveError(null);
      setIsAddOpen(isOpen);
    },
    newValue,
    setNewValue: (value: string) => {
      setSaveError(null);
      setNewValue(value);
    },
    editCandidate,
    setEditCandidate: (candidate: typeof editCandidate) => {
      setSaveError(null);
      setEditCandidate(candidate);
    },
    editedValue,
    setEditedValue: (value: string) => {
      setSaveError(null);
      setEditedValue(value);
    },
    saveError,
    isSaving,
    items,
    handleConfirmAdd,
    handleConfirmEdit,
    openAdd: () => {
      setNewValue('');
      setSaveError(null);
      setIsAddOpen(true);
    },
    beginEdit: (item: SingleFieldDictionaryItem) => {
      setEditedValue(item.value);
      setSaveError(null);
      setEditCandidate({ key: item.key, id: item.id, value: item.value });
    },
  };
}
