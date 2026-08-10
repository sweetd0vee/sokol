import type { Check } from '../types/check';
import type { Recommendation } from '../types/recommendation';
import { buildCheckDepartmentDistribution } from './checkAnalytics';

export type DepartmentCoverage = {
  covered: number;
  uncovered: number;
  total: number;
  coverageRate: number;
  coveredDepartments: string[];
  uncoveredDepartments: string[];
  donut: Array<{ name: string; value: number; color: string }>;
};

export type DepartmentAnalyticsRow = {
  name: string;
  checks: number;
  recommendations: number;
  highMateriality: number;
};

export type NamedCount = {
  name: string;
  value: number;
};

/** Departments touched by filtered checks (via linked recommendations). */
export function buildCoveredDepartments(
  checks: Check[],
  recommendations: Recommendation[],
): string[] {
  return buildCheckDepartmentDistribution(checks, recommendations)
    .map((item) => item.name)
    .filter((name) => name !== 'Без департамента');
}

/**
 * Coverage of the department universe for the period:
 * how many known audit objects have at least one related check.
 */
export function buildDepartmentCoverage(
  allDepartments: string[],
  coveredDepartments: string[],
): DepartmentCoverage {
  const coveredSet = new Set(coveredDepartments);
  const universe = [...new Set(allDepartments.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ru'),
  );
  const coveredList = universe.filter((name) => coveredSet.has(name));
  const uncoveredList = universe.filter((name) => !coveredSet.has(name));
  const covered = coveredList.length;
  const uncovered = uncoveredList.length;
  const total = universe.length;
  const coverageRate = total > 0 ? Math.round((covered / total) * 100) : 0;

  return {
    covered,
    uncovered,
    total,
    coverageRate,
    coveredDepartments: coveredList,
    uncoveredDepartments: uncoveredList,
    donut: [
      { name: 'С охватом', value: covered, color: '#22C55E' },
      { name: 'Без охвата', value: uncovered, color: '#CBD5E1' },
    ].filter((item) => item.value > 0),
  };
}

/** Per-department checks, recommendations and high-materiality counts. */
export function buildDepartmentAnalytics(
  checks: Check[],
  recommendations: Recommendation[],
): DepartmentAnalyticsRow[] {
  const checkByDept = new Map(
    buildCheckDepartmentDistribution(checks, recommendations).map((item) => [item.name, item.value]),
  );
  const recByDept = new Map<string, number>();
  const highByDept = new Map<string, number>();

  recommendations.forEach((item) => {
    const name = item.audit_object.trim() || 'Без департамента';
    recByDept.set(name, (recByDept.get(name) ?? 0) + 1);
    if (item.materiality_level === 'высокий') {
      highByDept.set(name, (highByDept.get(name) ?? 0) + 1);
    }
  });

  const names = new Set([...checkByDept.keys(), ...recByDept.keys()]);
  return [...names]
    .map((name) => ({
      name,
      checks: checkByDept.get(name) ?? 0,
      recommendations: recByDept.get(name) ?? 0,
      highMateriality: highByDept.get(name) ?? 0,
    }))
    .sort((a, b) => b.checks + b.recommendations - (a.checks + a.recommendations))
    .slice(0, 15);
}

/** Ranking of departments by high (red) materiality recommendations. */
export function buildHighMaterialityByDepartment(
  recommendations: Recommendation[],
): NamedCount[] {
  const map = new Map<string, number>();
  recommendations.forEach((item) => {
    if (item.materiality_level !== 'высокий') {
      return;
    }
    const name = item.audit_object.trim() || 'Без департамента';
    map.set(name, (map.get(name) ?? 0) + 1);
  });
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);
}

export const PLANNING_HIGH_MATERIALITY_COLOR = '#FF4347';
