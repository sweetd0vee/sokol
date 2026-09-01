import type { AnalyticsSelectionSummaryItem } from './AnalyticsSelectionSummary';

export function filterSelectionItem(
  label: string,
  values: string[],
  emptyLabel: string,
  onRemove: (value: string) => void,
): AnalyticsSelectionSummaryItem {
  return {
    label,
    chips: values.map((value) => ({ value, label: value })),
    emptyLabel,
    onRemove,
  };
}
