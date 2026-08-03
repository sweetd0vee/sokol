import { useCallback, useState } from 'react';

export function useExportSections<T extends string>(allIds: readonly T[]) {
  const [selectedSections, setSelectedSections] = useState<T[]>(() => []);

  const isSelected = useCallback(
    (id: T) => selectedSections.includes(id),
    [selectedSections],
  );

  const toggleSection = useCallback((id: T) => {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedSections([...allIds]);
  }, [allIds]);

  const clearAll = useCallback(() => {
    setSelectedSections([]);
  }, []);

  return {
    selectedSections,
    isSelected,
    toggleSection,
    selectAll,
    clearAll,
    selectedCount: selectedSections.length,
    totalCount: allIds.length,
  };
}
