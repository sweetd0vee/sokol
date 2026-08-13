import { createContext, useContext } from 'react';
import type { Check } from '../types/check';
import type { Recommendation } from '../types/recommendation';

export type SokolDataContextValue = {
  checks: Check[];
  recommendations: Recommendation[];
  isChecksLoading: boolean;
  isRecommendationsLoading: boolean;
  isChecksError: boolean;
  isRecommendationsError: boolean;
  checksError: Error | null;
  recommendationsError: Error | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  addCheck: (check: Check) => Promise<Check>;
  updateCheck: (check: Check) => Promise<Check>;
  deleteCheck: (id: string) => Promise<void>;
  addRecommendation: (recommendation: Recommendation) => Promise<Recommendation>;
  addRecommendationsForCheck: (
    serialNumber: string,
    items: Recommendation[],
  ) => Promise<Recommendation[]>;
  updateRecommendation: (recommendation: Recommendation) => Promise<Recommendation>;
  deleteRecommendation: (id: string) => Promise<void>;
  removeRecommendationsByIds: (ids: string[]) => Promise<void>;
  getRecommendationsByCheckKey: (serialNumber: string) => Recommendation[];
  replaceRecommendationsForCheck: (
    serialNumber: string,
    items: Recommendation[],
  ) => Promise<void>;
};

export const SokolDataContext = createContext<SokolDataContextValue | null>(null);

export function useSokolData() {
  const context = useContext(SokolDataContext);
  if (!context) {
    throw new Error('useSokolData must be used within SokolDataProvider');
  }
  return context;
}
