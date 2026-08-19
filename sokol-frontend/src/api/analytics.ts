import { api } from './client';
import type { EffectivenessMatrixRow, NamedCount, PeriodGranularity } from '../utils/checkAnalytics';

export type ChecksAnalyticsSummary = {
  total: number;
  not_started: number;
  in_progress: number;
  completed: number;
};

export type ChecksAnalyticsPeriodPoint = {
  key: string;
  label: string;
  sortKey: number;
  total: number;
  not_started: number;
  in_progress: number;
  completed: number;
  cumulative: number;
};

export type AnalyticsFilterOptions = {
  auditors?: string[];
  departments: string[];
  anchorDates: string[];
};

export type ChecksAnalyticsResponse = {
  universeTotal: number;
  filteredTotal: number;
  granularity: PeriodGranularity;
  summary: ChecksAnalyticsSummary;
  completionShare: number;
  periodSeries: ChecksAnalyticsPeriodPoint[];
  viewDistribution: NamedCount[];
  typeDistribution: NamedCount[];
  departmentMap: NamedCount[];
  effectivenessMatrix: EffectivenessMatrixRow[];
  filterOptions: AnalyticsFilterOptions & { auditors: string[] };
};

export type RecommendationsSummary = {
  total: number;
  byStatus: {
    completed: number;
    unresolved: number;
    on_control: number;
    in_progress: number;
  };
  byMateriality: {
    низкий: number;
    средний: number;
    высокий: number;
  };
  byAdditional: {
    on_time: number;
    deadline_violated: number;
    on_control: number;
  };
  withExtensions: number;
  withCompletionDate: number;
  completionRate: number;
  violationRate: number;
};

export type RecommendationPeriodPoint = {
  key: string;
  label: string;
  sortKey: number;
  total: number;
  completed: number;
  unresolved: number;
  on_control: number;
  in_progress: number;
  low: number;
  medium: number;
  high: number;
  cumulative: number;
  cumulativeCompleted: number;
};

export type RecommendationMaterialityBreakdown = {
  низкий: number;
  средний: number;
  высокий: number;
};

export type RecommendationObjectDistributionItem = NamedCount & {
  materiality: RecommendationMaterialityBreakdown;
};

export type RecommendationsAnalyticsResponse = {
  universeTotal: number;
  filteredTotal: number;
  granularity: PeriodGranularity;
  summary: RecommendationsSummary;
  periodSeries: RecommendationPeriodPoint[];
  cumulativeSeries: RecommendationPeriodPoint[];
  materialityDistribution: NamedCount[];
  indicatorDistribution: NamedCount[];
  checkLinks: NamedCount[];
  objectDistribution: RecommendationObjectDistributionItem[];
  statusDistribution: NamedCount[];
  additionalStatusDistribution: NamedCount[];
  filterOptions: AnalyticsFilterOptions & { auditors: string[] };
};

export type MonitoringAnalyticsResponse = {
  universeTotal: number;
  filteredTotal: number;
  granularity: PeriodGranularity;
  summary: RecommendationsSummary;
  periodSeries: RecommendationPeriodPoint[];
  statusDistribution: NamedCount[];
  additionalStatusDistribution: NamedCount[];
  filterOptions: AnalyticsFilterOptions & { auditors: string[] };
};

export type DvaPortfolioPoint = {
  key: string;
  label: string;
  sortKey: number;
  checks: number;
  recommendations: number;
};

export type DvaAuditorLoadRow = {
  name: string;
  checks: number;
  recommendations: number;
  value: number;
};

export type DvaAuditorMatrix = {
  periods: Array<{ key: string; label: string; sortKey: number }>;
  rows: Array<{
    auditor: string;
    total: number;
    byPeriod: Record<string, { checks: number; recommendations: number }>;
  }>;
};

export type DvaAnalyticsResponse = {
  universeChecksTotal: number;
  universeRecommendationsTotal: number;
  filteredChecksTotal: number;
  filteredRecommendationsTotal: number;
  granularity: PeriodGranularity;
  checkSummary: ChecksAnalyticsSummary;
  recommendationSummary: RecommendationsSummary;
  completionShare: number;
  portfolioSeries: DvaPortfolioPoint[];
  auditorLoad: DvaAuditorLoadRow[];
  auditorMatrix: DvaAuditorMatrix;
  documentReadiness: Array<{ name: string; filled: number; empty: number }>;
  auditorChecksTreemap: NamedCount[];
  auditorRecommendationsTreemap: NamedCount[];
  departmentMap: NamedCount[];
  filterOptions: AnalyticsFilterOptions & { auditors: string[] };
};

export type PlanningCoverage = {
  covered: number;
  uncovered: number;
  total: number;
  coverageRate: number;
  uncoveredRate: number;
  coveredDepartments: string[];
  uncoveredDepartments: string[];
  donut: Array<{ name: string; value: number; color: string }>;
  checksByDepartment: NamedCount[];
};

export type PlanningAnalyticsResponse = {
  universeChecksTotal: number;
  universeRecommendationsTotal: number;
  filteredChecksTotal: number;
  filteredRecommendationsTotal: number;
  granularity: PeriodGranularity;
  coverage: PlanningCoverage;
  departmentAnalytics: Array<{
    name: string;
    checks: number;
    recommendations: number;
    highMateriality: number;
  }>;
  highMaterialityByDepartment: NamedCount[];
  highMaterialityTotal: number;
  filterOptions: AnalyticsFilterOptions;
};

export type AnalyticsQueryParams = {
  granularity: PeriodGranularity;
  years?: string[];
  quarters?: string[];
  months?: string[];
  auditors?: string[];
  departments?: string[];
  statuses?: string[];
  additionalStatuses?: string[];
  materialityLevels?: string[];
};

function appendList(params: URLSearchParams, key: string, values: string[] | undefined) {
  (values ?? []).filter(Boolean).forEach((value) => {
    params.append(key, value);
  });
}

function toSearchParams(input: AnalyticsQueryParams): URLSearchParams {
  const params = new URLSearchParams();
  params.set('granularity', input.granularity);
  appendList(params, 'years', input.years);
  appendList(params, 'quarters', input.quarters);
  appendList(params, 'months', input.months);
  appendList(params, 'auditors', input.auditors);
  appendList(params, 'departments', input.departments);
  appendList(params, 'statuses', input.statuses);
  appendList(params, 'additionalStatuses', input.additionalStatuses);
  appendList(params, 'materialityLevels', input.materialityLevels);
  return params;
}

export async function fetchChecksAnalytics(
  input: AnalyticsQueryParams,
): Promise<ChecksAnalyticsResponse> {
  const { data } = await api.get<ChecksAnalyticsResponse>('/api/v1/analytics/checks', {
    params: toSearchParams(input),
  });
  return data;
}

export async function fetchRecommendationsAnalytics(
  input: AnalyticsQueryParams,
): Promise<RecommendationsAnalyticsResponse> {
  const { data } = await api.get<RecommendationsAnalyticsResponse>('/api/v1/analytics/recommendations', {
    params: toSearchParams(input),
  });
  return data;
}

export async function fetchMonitoringAnalytics(
  input: AnalyticsQueryParams,
): Promise<MonitoringAnalyticsResponse> {
  const { data } = await api.get<MonitoringAnalyticsResponse>('/api/v1/analytics/monitoring', {
    params: toSearchParams(input),
  });
  return data;
}

export async function fetchDvaAnalytics(input: AnalyticsQueryParams): Promise<DvaAnalyticsResponse> {
  const { data } = await api.get<DvaAnalyticsResponse>('/api/v1/analytics/dva', {
    params: toSearchParams(input),
  });
  return data;
}

export async function fetchPlanningAnalytics(
  input: AnalyticsQueryParams,
): Promise<PlanningAnalyticsResponse> {
  const { data } = await api.get<PlanningAnalyticsResponse>('/api/v1/analytics/planning', {
    params: toSearchParams(input),
  });
  return data;
}
