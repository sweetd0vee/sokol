import { useCallback, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Check } from '../types/check';
import type { Recommendation } from '../types/recommendation';
import { createCheck, deleteCheck as deleteCheckApi, fetchChecks, updateCheck as updateCheckApi } from '../api/checks';
import {
  batchRecommendations,
  batchDeleteRecommendations,
  createRecommendation,
  deleteRecommendation as deleteRecommendationApi,
  fetchRecommendations,
  updateRecommendation as updateRecommendationApi,
} from '../api/recommendations';
import { useAuth } from '../hooks/useAuth';
import { SokolDataContext, type SokolDataContextValue } from './sokolData';

interface SokolDataProviderProps {
  children: ReactNode;
}

const LIST_FETCH_LIMIT = 10000;

export function SokolDataProvider({ children }: SokolDataProviderProps) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const checksQuery = useQuery({
    queryKey: ['checks'],
    queryFn: () => fetchChecks({ limit: LIST_FETCH_LIMIT }),
    enabled: isAuthenticated,
  });

  const recommendationsQuery = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => fetchRecommendations({ limit: LIST_FETCH_LIMIT }),
    enabled: isAuthenticated,
  });

  const checks = useMemo(() => checksQuery.data?.items ?? [], [checksQuery.data?.items]);
  const recommendations = useMemo(
    () => recommendationsQuery.data?.items ?? [],
    [recommendationsQuery.data?.items],
  );

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

  const addRecommendationsForCheck = useCallback(
    async (serialNumber: string, items: Recommendation[]) => {
      const result = await batchRecommendations(serialNumber, items, 'append');
      await invalidateAll();
      return result.items;
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

  const removeRecommendationsByIds = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }
      await batchDeleteRecommendations(ids);
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
    async (serialNumber: string, items: Recommendation[]) => {
      await batchRecommendations(serialNumber, items, 'replace');
      await invalidateAll();
    },
    [invalidateAll],
  );

  const value = useMemo<SokolDataContextValue>(
    () => ({
      checks,
      recommendations,
      isChecksLoading: checksQuery.isLoading,
      isRecommendationsLoading: recommendationsQuery.isLoading,
      isChecksError: checksQuery.isError,
      isRecommendationsError: recommendationsQuery.isError,
      checksError: (checksQuery.error ?? null) as Error | null,
      recommendationsError: (recommendationsQuery.error ?? null) as Error | null,
      isLoading: checksQuery.isLoading || recommendationsQuery.isLoading,
      isError: checksQuery.isError || recommendationsQuery.isError,
      error: (checksQuery.error ?? recommendationsQuery.error) as Error | null,
      refetch,
      addCheck,
      updateCheck,
      deleteCheck,
      addRecommendation,
      addRecommendationsForCheck,
      updateRecommendation,
      deleteRecommendation,
      removeRecommendationsByIds,
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
      addRecommendationsForCheck,
      updateRecommendation,
      deleteRecommendation,
      removeRecommendationsByIds,
      getRecommendationsByCheckKey,
      replaceRecommendationsForCheck,
    ],
  );

  return <SokolDataContext.Provider value={value}>{children}</SokolDataContext.Provider>;
}
