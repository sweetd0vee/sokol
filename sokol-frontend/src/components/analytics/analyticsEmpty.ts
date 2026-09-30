import type { ChecksAnalyticsSummary, RecommendationsSummary } from '../../api/analytics';

export const EMPTY_CHECKS_SUMMARY: ChecksAnalyticsSummary = {
  total: 0,
  not_started: 0,
  in_progress: 0,
  completed: 0,
};

export const EMPTY_RECOMMENDATION_SUMMARY: RecommendationsSummary = {
  total: 0,
  byStatus: { completed: 0, unresolved: 0, on_control: 0, in_progress: 0 },
  byMateriality: { низкий: 0, средний: 0, высокий: 0 },
  byAdditional: { on_time: 0, deadline_violated: 0, on_control: 0, in_progress: 0 },
  withExtensions: 0,
  withCompletionDate: 0,
  completionRate: 0,
  violationRate: 0,
};
