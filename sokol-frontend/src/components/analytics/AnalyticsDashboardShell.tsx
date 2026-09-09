import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { AnalyticsDashboardFrame } from './AnalyticsDashboardFrame';
import {
  AnalyticsFilterSidebar,
  type AnalyticsFilterSidebarProps,
} from './AnalyticsFilterSidebar';
import {
  AnalyticsSelectionSummary,
  type AnalyticsSelectionSummaryMetric,
} from './AnalyticsSelectionSummary';
import { AnalyticsFilterCaptionProvider } from './analyticsFilterCaptionContext';
import { filterSelectionItem } from './filterSelectionItem';
import { ErrorState, LoadingState } from '../ui/StateMessage';

/** Shared main column class for checks / recommendations / monitoring. */
export const ANALYTICS_DASHBOARD_MAIN_CLASS =
  'relative flex min-w-0 flex-1 flex-col lg:-mt-[84px] lg:self-start';

type AnalyticsDashboardShellProps = {
  loadingTitle: string;
  errorTitle: string;
  bootstrapQuery: UseQueryResult<unknown>;
  analyticsQuery: UseQueryResult<unknown>;
  data: unknown;
  isWaitingForFilteredData?: boolean;
  showFetchingBadge?: boolean;
  /** When omitted, AnalyticsDashboardFrame keeps its default main class (used by DVA). */
  mainClassName?: string;
  selectionMetrics: AnalyticsSelectionSummaryMetric[];
  periodSliceLabel: string;
  activePeriodValues: string[];
  removeActivePeriodValue: (value: string) => void;
  selectedAuditors: string[];
  removeAuditor: (value: string) => void;
  selectedDepartments: string[];
  removeDepartment: (value: string) => void;
  filterSidebar: Omit<
    AnalyticsFilterSidebarProps,
    'selectionSummary' | 'children'
  >;
  children: ReactNode;
};

export function AnalyticsDashboardShell({
  loadingTitle,
  errorTitle,
  bootstrapQuery,
  analyticsQuery,
  data,
  isWaitingForFilteredData = false,
  showFetchingBadge = false,
  mainClassName,
  selectionMetrics,
  periodSliceLabel,
  activePeriodValues,
  removeActivePeriodValue,
  selectedAuditors,
  removeAuditor,
  selectedDepartments,
  removeDepartment,
  filterSidebar,
  children,
}: AnalyticsDashboardShellProps) {
  if (bootstrapQuery.isLoading && !data) {
    return <LoadingState title={loadingTitle} />;
  }

  if ((bootstrapQuery.isError || analyticsQuery.isError) && !data) {
    const error = analyticsQuery.error ?? bootstrapQuery.error;
    return (
      <ErrorState
        title={errorTitle}
        description={error instanceof Error ? error.message : 'неизвестная ошибка'}
      />
    );
  }

  return (
    <AnalyticsFilterCaptionProvider
      periodSliceLabel={periodSliceLabel}
      periods={activePeriodValues}
      auditors={selectedAuditors}
      departments={selectedDepartments}
    >
      <AnalyticsDashboardFrame
        {...(mainClassName !== undefined ? { mainClassName } : {})}
        sidebar={(
          <AnalyticsFilterSidebar
            {...filterSidebar}
            selectionSummary={(
              <AnalyticsSelectionSummary
                metrics={selectionMetrics}
                items={[
                  filterSelectionItem(
                    periodSliceLabel,
                    activePeriodValues,
                    'Все значения',
                    removeActivePeriodValue,
                  ),
                  filterSelectionItem('Аудиторы', selectedAuditors, 'Все аудиторы', removeAuditor),
                  filterSelectionItem(
                    'Департаменты',
                    selectedDepartments,
                    'Все департаменты',
                    removeDepartment,
                  ),
                ]}
              />
            )}
          />
        )}
      >
        {showFetchingBadge && analyticsQuery.isFetching ? (
          <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-md bg-white/90 px-2 py-1 text-xs text-slate-500 shadow-sm">
            Обновление…
          </div>
        ) : null}
        {isWaitingForFilteredData ? <LoadingState title={loadingTitle} /> : children}
      </AnalyticsDashboardFrame>
    </AnalyticsFilterCaptionProvider>
  );
}
