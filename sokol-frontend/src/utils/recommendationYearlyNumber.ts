import type { Recommendation } from '../types/recommendation';
import { parseDateValue } from './dates';

function getRecommendationYear(recommendation: Recommendation): number | null {
  const deadlineMs = parseDateValue(recommendation.deadline);
  if (deadlineMs === null) {
    return null;
  }
  return new Date(deadlineMs).getFullYear();
}

function formatYearlyId(year: number, yearlyNumber: number): string {
  return `${String(year).slice(-2)}-${yearlyNumber}`;
}

function compareRecommendationsForYearlyNumber(a: Recommendation, b: Recommendation) {
  const dateA = parseDateValue(a.deadline) ?? 0;
  const dateB = parseDateValue(b.deadline) ?? 0;
  if (dateA !== dateB) {
    return dateA - dateB;
  }

  const idA = Number(a.id);
  const idB = Number(b.id);
  if (!Number.isNaN(idA) && !Number.isNaN(idB)) {
    return idA - idB;
  }

  return a.id.localeCompare(b.id, 'ru', { numeric: true, sensitivity: 'base' });
}

/** Порядковый номер рекомендации внутри календарного года по сроку исполнения. */
export function buildRecommendationYearlyNumbers(recommendations: Recommendation[]): Map<string, number> {
  const byYear = new Map<number, Recommendation[]>();

  for (const recommendation of recommendations) {
    const year = getRecommendationYear(recommendation);
    if (year === null) {
      continue;
    }
    const group = byYear.get(year) ?? [];
    group.push(recommendation);
    byYear.set(year, group);
  }

  const result = new Map<string, number>();

  for (const group of byYear.values()) {
    const sorted = [...group].sort(compareRecommendationsForYearlyNumber);
    sorted.forEach((recommendation, index) => {
      result.set(recommendation.id, index + 1);
    });
  }

  return result;
}

export function getRecommendationYearlyNumber(
  recommendation: Recommendation,
  yearlyNumbers: Map<string, number>,
): number | null {
  return yearlyNumbers.get(recommendation.id) ?? null;
}

export function getRecommendationYearlyId(
  recommendation: Recommendation,
  yearlyNumbers: Map<string, number>,
): string | null {
  const year = getRecommendationYear(recommendation);
  const yearlyNumber = getRecommendationYearlyNumber(recommendation, yearlyNumbers);
  if (year === null || yearlyNumber === null) {
    return null;
  }

  return formatYearlyId(year, yearlyNumber);
}

export function getRecommendationYearlySortValue(
  recommendation: Recommendation,
  yearlyNumbers: Map<string, number>,
): number | null {
  const year = getRecommendationYear(recommendation);
  const yearlyNumber = getRecommendationYearlyNumber(recommendation, yearlyNumbers);
  if (year === null || yearlyNumber === null) {
    return null;
  }

  return year * 10000 + yearlyNumber;
}

const DRAFT_RECOMMENDATION_ID = '__draft__';

/** Номер рекомендации внутри календарного года — та же цифра, что в ID после дефиса. */
export function resolveRecommendationYearlyDisplayNumber(
  recommendations: Recommendation[],
  options: {
    recommendationId?: string | number | null;
    deadline?: string;
    fallback?: Recommendation | null;
  },
): number | null {
  const previewDeadline = options.deadline?.trim() || options.fallback?.deadline?.trim() || '';
  if (!previewDeadline) {
    return null;
  }

  const previewId =
    options.recommendationId !== undefined &&
    options.recommendationId !== null &&
    String(options.recommendationId)
      ? String(options.recommendationId)
      : DRAFT_RECOMMENDATION_ID;

  const previewRecommendation: Recommendation = {
    ...(options.fallback ?? {
      id: previewId,
      serial_number: '',
      sequence_number: 1,
      name: '',
      description: '',
      indicator: 'не указан',
      materiality_level: 'средний',
      audit_object: '',
      deadline: previewDeadline,
      auditor: '',
      manager: '',
      status: 'unresolved',
      additional_status: 'on_time',
    }),
    id: previewId,
    deadline: previewDeadline,
  };

  const others = recommendations.filter((item) => String(item.id) !== previewId);
  const numbers = buildRecommendationYearlyNumbers([...others, previewRecommendation]);
  return numbers.get(previewId) ?? null;
}
