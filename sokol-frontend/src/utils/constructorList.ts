import type { ConstructorDashboardRecord } from '../components/analytics/constructor/constructorLibrary';
import { CONSTRUCTOR_SOURCE_LABELS } from '../components/analytics/constructor/constructorTypes';
import { parseDateValue } from './dates';

export type ConstructorSortKey = 'name' | 'charts' | 'sources' | 'updatedAt' | 'createdAt';

export function dashboardSourceKinds(dashboard: ConstructorDashboardRecord) {
  return [...new Set(dashboard.widgets.map((widget) => widget.kind))];
}

export function dashboardSourceSummary(kinds: string[]) {
  if (kinds.length === 0) {
    return 'Пустой лист';
  }
  return kinds
    .map((kind) => CONSTRUCTOR_SOURCE_LABELS[kind as keyof typeof CONSTRUCTOR_SOURCE_LABELS] ?? kind)
    .join(', ');
}

export function getConstructorSortValue(
  dashboard: ConstructorDashboardRecord,
  key: ConstructorSortKey,
) {
  switch (key) {
    case 'name':
      return dashboard.name;
    case 'charts':
      return dashboard.widgets.length;
    case 'sources':
      return dashboardSourceSummary(dashboardSourceKinds(dashboard));
    case 'updatedAt':
      return parseDateValue(dashboard.updatedAt);
    case 'createdAt':
      return parseDateValue(dashboard.createdAt);
    default:
      return '';
  }
}

export function filterConstructorDashboards(
  dashboards: ConstructorDashboardRecord[],
  nameFilter: string,
) {
  const query = nameFilter.trim().toLowerCase();
  if (!query) {
    return dashboards;
  }
  return dashboards.filter((dashboard) => dashboard.name.toLowerCase().includes(query));
}

export function defaultConstructorDashboards(dashboards: ConstructorDashboardRecord[]) {
  return [...dashboards].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
