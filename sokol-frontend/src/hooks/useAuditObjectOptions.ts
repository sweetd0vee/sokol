import { useMemo } from 'react';
import { useSokolData } from '../contexts/sokolData';
import { toNameOptions } from './useReferenceOptions';

export function useAuditObjectOptions(extraValue?: string) {
  const { recommendations } = useSokolData();

  const options = useMemo(
    () => toNameOptions(recommendations.map((item) => item.audit_object), extraValue),
    [recommendations, extraValue],
  );

  return { options };
}
