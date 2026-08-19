import { useCallback, useMemo, useState } from 'react';
import {
  cycleSortConfig,
  DEFAULT_LIST_PAGE_SIZE,
  sortListItems,
  type SortConfig,
} from '../utils/listTable';

export function useClientTable<T, K extends string>({
  items,
  getSortValue,
  resetKey,
}: {
  items: T[];
  getSortValue: (item: T, key: K) => string | number | null;
  resetKey: string;
}) {
  const [sortConfig, setSortConfig] = useState<SortConfig<K>>({
    key: null,
    direction: 'asc',
  });
  const [pageState, setPageState] = useState({ resetKey, pageSize: DEFAULT_LIST_PAGE_SIZE, page: 1 });

  if (pageState.resetKey !== resetKey) {
    setPageState({ ...pageState, resetKey, page: 1 });
  }

  const pageSize = pageState.pageSize;

  const sortedItems = useMemo(
    () => sortListItems(items, sortConfig, getSortValue),
    [items, sortConfig, getSortValue],
  );

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const currentPage = Math.min(pageState.page, totalPages);
  const pagedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedItems.slice(startIndex, startIndex + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  const toggleSort = useCallback((key: K) => {
    setSortConfig((prev) => cycleSortConfig(prev, key));
  }, []);

  const setCurrentPage = useCallback((page: number | ((prev: number) => number)) => {
    setPageState((prev) => ({
      ...prev,
      page: typeof page === 'function' ? page(prev.page) : page,
    }));
  }, []);

  const setPageSize = useCallback((nextSize: number) => {
    setPageState((prev) => ({ ...prev, pageSize: nextSize, page: 1 }));
  }, []);

  const rangeLabel =
    sortedItems.length > 0
      ? `Показано ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sortedItems.length)} из ${sortedItems.length}`
      : 'Показано 0 из 0';

  return {
    sortConfig,
    toggleSort,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    sortedItems,
    pagedItems,
    rangeLabel,
  };
}
