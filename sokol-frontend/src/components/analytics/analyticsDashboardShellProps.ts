import type { AnalyticsSelectionSummaryMetric } from './AnalyticsSelectionSummary';
import type { AnalyticsDashboardShellProps } from './AnalyticsDashboardShell';
import {
  toAnalyticsFilterSidebarProps,
  type AnalyticsFilterController,
} from './analyticsFilterSidebarProps';

type AnalyticsDashboardShellController = AnalyticsFilterController & {
  bootstrapQuery: AnalyticsDashboardShellProps['bootstrapQuery'];
  analyticsQuery: AnalyticsDashboardShellProps['analyticsQuery'];
  data: AnalyticsDashboardShellProps['data'];
  isWaitingForFilteredData?: boolean;
  periodSliceLabel: string;
  activePeriodValues: string[];
  removeActivePeriodValue: (value: string) => void;
  removeAuditor: (value: string) => void;
  removeDepartment: (value: string) => void;
};

type AnalyticsDashboardShellExtras = {
  loadingTitle: string;
  errorTitle: string;
  selectionMetrics: AnalyticsSelectionSummaryMetric[];
  canExport: boolean;
  onExport: () => void;
  selectedCount: number;
  justAdded: boolean;
  onAddToConstructor: () => void;
  includeAuditors?: boolean;
  mainClassName?: string;
  showFetchingBadge?: boolean;
};

export function toAnalyticsDashboardShellProps(
  controller: AnalyticsDashboardShellController,
  extras: AnalyticsDashboardShellExtras,
): Omit<AnalyticsDashboardShellProps, 'children'> {
  const includeAuditors = extras.includeAuditors !== false;
  return {
    loadingTitle: extras.loadingTitle,
    errorTitle: extras.errorTitle,
    bootstrapQuery: controller.bootstrapQuery,
    analyticsQuery: controller.analyticsQuery,
    data: controller.data,
    isWaitingForFilteredData: controller.isWaitingForFilteredData,
    showFetchingBadge: extras.showFetchingBadge,
    ...(extras.mainClassName !== undefined ? { mainClassName: extras.mainClassName } : {}),
    selectionMetrics: extras.selectionMetrics,
    periodSliceLabel: controller.periodSliceLabel,
    activePeriodValues: controller.activePeriodValues,
    removeActivePeriodValue: controller.removeActivePeriodValue,
    selectedAuditors: controller.selectedAuditors,
    removeAuditor: controller.removeAuditor,
    selectedDepartments: controller.selectedDepartments,
    removeDepartment: controller.removeDepartment,
    includeAuditors,
    filterSidebar: toAnalyticsFilterSidebarProps(controller, {
      canExport: extras.canExport,
      onExport: extras.onExport,
      selectedCount: extras.selectedCount,
      justAdded: extras.justAdded,
      onAddToConstructor: extras.onAddToConstructor,
      includeAuditors,
    }),
  };
}
