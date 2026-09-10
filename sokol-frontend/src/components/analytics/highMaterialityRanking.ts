import type { PlanningHighMaterialityDepartmentRow } from '../../api/analytics';
import { unresolvedSharePercent } from '../../utils/dvaAnalytics';
import type { SortDirection } from '../../utils/listTable';

export type HighMaterialitySortKey = 'value' | 'share' | 'checks';

export type HighMaterialitySortState = {
  key: HighMaterialitySortKey;
  direction: SortDirection;
};

export const DEFAULT_HIGH_MATERIALITY_SORT: HighMaterialitySortState = {
  key: 'value',
  direction: 'desc',
};

export function highMaterialityShare(row: PlanningHighMaterialityDepartmentRow) {
  return unresolvedSharePercent(row.value, row.total);
}

export function highMaterialityMetric(
  row: PlanningHighMaterialityDepartmentRow,
  key: HighMaterialitySortKey,
) {
  if (key === 'share') {
    return highMaterialityShare(row);
  }
  if (key === 'checks') {
    return row.checks.length;
  }
  return row.value;
}

export function cycleHighMaterialitySort(
  prev: HighMaterialitySortState,
  key: HighMaterialitySortKey,
): HighMaterialitySortState {
  if (prev.key !== key) {
    return { key, direction: 'desc' };
  }
  return { key, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
}

export function sortHighMaterialityRows(
  rows: PlanningHighMaterialityDepartmentRow[],
  sort: HighMaterialitySortState,
) {
  return [...rows].sort((left, right) => {
    const diff = highMaterialityMetric(right, sort.key) - highMaterialityMetric(left, sort.key);
    const ordered = sort.direction === 'desc' ? diff : -diff;
    return ordered || left.name.localeCompare(right.name, 'ru');
  });
}

export function highMaterialitySortInsight(sort: HighMaterialitySortState) {
  const highest = sort.direction === 'desc';
  if (sort.key === 'share') {
    return highest
      ? 'Сначала департаменты, где красные занимают наибольшую долю рекомендаций.'
      : 'Сначала департаменты с наименьшей долей красных рекомендаций.';
  }
  if (sort.key === 'checks') {
    return highest
      ? 'Сначала департаменты, где красные рекомендации встречаются в большем числе проверок.'
      : 'Сначала департаменты, где красные рекомендации сосредоточены в меньшем числе проверок.';
  }
  return highest
    ? 'Сначала департаменты с наибольшим числом красных рекомендаций.'
    : 'Сначала департаменты с наименьшим числом красных рекомендаций.';
}
