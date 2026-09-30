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
import { queryKeys } from '../api/queryKeys';
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
    queryKey: queryKeys.checks,
    queryFn: () => fetchChecks({ limit: LIST_FETCH_LIMIT }),
    enabled: isAuthenticated,
  });

  const recommendationsQuery = useQuery({
    queryKey: queryKeys.recommendations,
    queryFn: () => fetchRecommendations({ limit: LIST_FETCH_LIMIT }),
    enabled: isAuthenticated,
  });

  const checks = useMemo(() => checksQuery.data?.items ?? [], [checksQuery.data?.items]);
  const recommendations = useMemo(
    () => recommendationsQuery.data?.items ?? [],
    [recommendationsQuery.data?.items],
  );
  const checksTotal = checksQuery.data?.total ?? checks.length;
  const recommendationsTotal = recommendationsQuery.data?.total ?? recommendations.length;
  const checksTruncated = checksTotal > checks.length;
  const recommendationsTruncated = recommendationsTotal > recommendations.length;

  const invalidateAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.checks }),
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations }),
    ]);
  }, [queryClient]);

  const refetch = useCallback(async () => {
    await Promise.all([checksQuery.refetch(), recommendationsQuery.refetch()]);
  }, [checksQuery, recommendationsQuery]);

  const runAndInvalidate = useCallback(
    async <T,>(operation: () => Promise<T>) => {
      const result = await operation();
      await invalidateAll();
      return result;
    },
    [invalidateAll],
  );

  const addCheck = useCallback(
    (check: Check) => runAndInvalidate(() => createCheck(check)),
    [runAndInvalidate],
  );

  const updateCheck = useCallback(
    (check: Check) => runAndInvalidate(() => updateCheckApi(check.id, check)),
    [runAndInvalidate],
  );

  const deleteCheck = useCallback(
    (id: string) => runAndInvalidate(() => deleteCheckApi(id)),
    [runAndInvalidate],
  );

  const addRecommendation = useCallback(
    (recommendation: Recommendation) => runAndInvalidate(() => createRecommendation(recommendation)),
    [runAndInvalidate],
  );

  const addRecommendationsForCheck = useCallback(
    async (serialNumber: string, items: Recommendation[]) => {
      const result = await runAndInvalidate(() => batchRecommendations(serialNumber, items, 'append'));
      return result.items;
    },
    [runAndInvalidate],
  );

  const updateRecommendation = useCallback(
    (recommendation: Recommendation) =>
      runAndInvalidate(() => updateRecommendationApi(recommendation.id, recommendation)),
    [runAndInvalidate],
  );

  const deleteRecommendation = useCallback(
    (id: string) => runAndInvalidate(() => deleteRecommendationApi(id)),
    [runAndInvalidate],
  );

  const removeRecommendationsByIds = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }
      await runAndInvalidate(() => batchDeleteRecommendations(ids));
    },
    [runAndInvalidate],
  );

  const getRecommendationsByCheckKey = useCallback(
    (serialNumber: string) =>
      recommendations.filter((item) => item.serial_number === serialNumber),
    [recommendations],
  );

  const replaceRecommendationsForCheck = useCallback(
    async (serialNumber: string, items: Recommendation[]) => {
      await runAndInvalidate(() => batchRecommendations(serialNumber, items, 'replace'));
    },
    [runAndInvalidate],
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
