import { useCallback, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Check } from '../types/check';
import type { Recommendation } from '../types/recommendation';
import { createCheck, deleteCheck as deleteCheckApi, fetchChecks, updateCheck as updateCheckApi } from '../api/checks';
import {
  createRecommendation,
  deleteRecommendation as deleteRecommendationApi,
  fetchRecommendations,
  updateRecommendation as updateRecommendationApi,
} from '../api/recommendations';
import { SokolDataContext, type SokolDataContextValue } from './sokolData';

interface SokolDataProviderProps {
  children: ReactNode;
}

export function SokolDataProvider({ children }: SokolDataProviderProps) {
  const queryClient = useQueryClient();

  const checksQuery = useQuery({
    queryKey: ['checks'],
    queryFn: () => fetchChecks({ limit: 500 }),
  });

  const recommendationsQuery = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => fetchRecommendations({ limit: 1000 }),
  });

  const checks = checksQuery.data?.items ?? [];
  const recommendations = recommendationsQuery.data?.items ?? [];

  const invalidateAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['checks'] }),
      queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
    ]);
  }, [queryClient]);

  const refetch = useCallback(async () => {
    await Promise.all([checksQuery.refetch(), recommendationsQuery.refetch()]);
  }, [checksQuery, recommendationsQuery]);

  const addCheck = useCallback(
    async (check: Check) => {
      const created = await createCheck(check);
      await invalidateAll();
      return created;
    },
    [invalidateAll],
  );

  const updateCheck = useCallback(
    async (check: Check) => {
      const updated = await updateCheckApi(check.id, check);
      await invalidateAll();
      return updated;
    },
    [invalidateAll],
  );

  const deleteCheck = useCallback(
    async (id: string) => {
      await deleteCheckApi(id);
      await invalidateAll();
    },
    [invalidateAll],
  );

  const addRecommendation = useCallback(
    async (recommendation: Recommendation) => {
      const created = await createRecommendation(recommendation);
      await invalidateAll();
      return created;
    },
    [invalidateAll],
  );

  const updateRecommendation = useCallback(
    async (recommendation: Recommendation) => {
      const updated = await updateRecommendationApi(recommendation.id, recommendation);
      await invalidateAll();
      return updated;
    },
    [invalidateAll],
  );

  const deleteRecommendation = useCallback(
    async (id: string) => {
      await deleteRecommendationApi(id);
      await invalidateAll();
    },
    [invalidateAll],
  );

  const getRecommendationsByCheckKey = useCallback(
    (serialNumber: string) =>
      recommendations.filter((item) => item.serial_number === serialNumber),
    [recommendations],
  );

  const replaceRecommendationsForCheck = useCallback(
    async (serialNumber: string, items: Recommendation[], previousSerialNumber?: string) => {
      const keysToReplace = new Set(
        [serialNumber, previousSerialNumber].filter((value): value is string => Boolean(value)),
      );
      const existing = recommendations.filter((item) => keysToReplace.has(item.serial_number));
      await Promise.all(existing.map((item) => deleteRecommendationApi(item.id)));
      await Promise.all(
        items.map((item) =>
          createRecommendation({
            ...item,
            serial_number: serialNumber,
          }),
        ),
      );
      await invalidateAll();
    },
    [invalidateAll, recommendations],
  );

  const value = useMemo<SokolDataContextValue>(
    () => ({
      checks,
      recommendations,
      isLoading: checksQuery.isLoading || recommendationsQuery.isLoading,
      isError: checksQuery.isError || recommendationsQuery.isError,
      error: (checksQuery.error ?? recommendationsQuery.error) as Error | null,
      refetch,
      addCheck,
      updateCheck,
      deleteCheck,
      addRecommendation,
      updateRecommendation,
      deleteRecommendation,
      getRecommendationsByCheckKey,
      replaceRecommendationsForCheck,
    }),
    [
      checks,
      recommendations,
      checksQuery.isLoading,
      checksQuery.isError,
      checksQuery.error,
      recommendationsQuery.isLoading,
      recommendationsQuery.isError,
      recommendationsQuery.error,
      refetch,
      addCheck,
      updateCheck,
      deleteCheck,
      addRecommendation,
      updateRecommendation,
      deleteRecommendation,
      getRecommendationsByCheckKey,
      replaceRecommendationsForCheck,
    ],
  );

  return <SokolDataContext.Provider value={value}>{children}</SokolDataContext.Provider>;
}
