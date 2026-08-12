import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDepartments } from '../api/settings';
import { toNameOptions } from './useReferenceOptions';

export function useAuditObjectOptions(extraValue?: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'departments'],
    queryFn: fetchDepartments,
  });

  const options = useMemo(
    () => toNameOptions((data ?? []).map((department) => department.name), extraValue),
    [data, extraValue],
  );

  return { options, isLoading };
}
