import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAuditors, fetchEffectivenessRatings } from '../api/settings';

type SelectOption = { value: string; label: string };

export function toNameOptions(values: string[], extra?: string): SelectOption[] {
  const unique = new Set(values.filter(Boolean));
  if (extra?.trim()) {
    unique.add(extra.trim());
  }
  return [...unique]
    .sort((a, b) => a.localeCompare(b, 'ru'))
    .map((name) => ({ value: name, label: name }));
}

export function useAuditorOptions(extraValue?: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'auditors'],
    queryFn: fetchAuditors,
  });

  const options = useMemo(
    () => toNameOptions((data ?? []).map((auditor) => auditor.full_name), extraValue),
    [data, extraValue],
  );

  return { options, isLoading };
}

export function useEffectivenessRatingOptions(...extraValues: string[]) {
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'effectiveness-ratings'],
    queryFn: fetchEffectivenessRatings,
  });
  const extraValuesKey = extraValues.join('\u0000');

  const options = useMemo(() => {
    const labels = (data ?? []).map((rating) => rating.label);
    extraValuesKey.split('\u0000').forEach((value) => {
      if (value?.trim()) {
        labels.push(value.trim());
      }
    });
    return toNameOptions(labels);
  }, [data, extraValuesKey]);

  return { options, isLoading };
}
