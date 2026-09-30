import type { AnalyticsExportFormat } from '../../utils/analyticsExport';
import type { MultiCheckboxOption } from '../ui/MultiCheckboxSelect';
import type { AnalyticsFilterSidebarProps, AnalyticsPeriodSlice } from './AnalyticsFilterSidebar';

export type AnalyticsFilterController = {
  periodSlice: AnalyticsPeriodSlice;
  handlePeriodSliceChange: (next: AnalyticsPeriodSlice) => void;
  yearOptions: MultiCheckboxOption[];
  quarterOptions: MultiCheckboxOption[];
  selectedYears: string[];
  selectedQuarters: string[];
  setSelectedYears: (next: string[]) => void;
  setSelectedQuarters: (next: string[]) => void;
  auditorOptions: MultiCheckboxOption[];
  selectedAuditors: string[];
  setSelectedAuditors: (next: string[]) => void;
  departmentOptions: MultiCheckboxOption[];
  selectedDepartments: string[];
  setSelectedDepartments: (next: string[]) => void;
  resetFilters: () => void;
  exportFormat: AnalyticsExportFormat;
  setExportFormat: (format: AnalyticsExportFormat) => void;
  isExporting: boolean;
};

type AnalyticsFilterSidebarExtras = {
  canExport: boolean;
  onExport: () => void;
  selectedCount: number;
  justAdded: boolean;
  onAddToConstructor: () => void;
  includeAuditors?: boolean;
};

export function toAnalyticsFilterSidebarProps(
  controller: AnalyticsFilterController,
  extras: AnalyticsFilterSidebarExtras,
): Omit<AnalyticsFilterSidebarProps, 'selectionSummary' | 'children'> {
  const includeAuditors = extras.includeAuditors !== false;
  return {
    periodSlice: controller.periodSlice,
    onPeriodSliceChange: controller.handlePeriodSliceChange,
    yearOptions: controller.yearOptions,
    quarterOptions: controller.quarterOptions,
    selectedYears: controller.selectedYears,
    selectedQuarters: controller.selectedQuarters,
    onYearsChange: controller.setSelectedYears,
    onQuartersChange: controller.setSelectedQuarters,
    ...(includeAuditors
      ? {
          auditorOptions: controller.auditorOptions,
          selectedAuditors: controller.selectedAuditors,
          onAuditorsChange: controller.setSelectedAuditors,
        }
      : {}),
    departmentOptions: controller.departmentOptions,
    selectedDepartments: controller.selectedDepartments,
    onDepartmentsChange: controller.setSelectedDepartments,
    onResetFilters: controller.resetFilters,
    exportFormat: controller.exportFormat,
    onExportFormatChange: controller.setExportFormat,
    isExporting: controller.isExporting,
    canExport: extras.canExport,
    onExport: extras.onExport,
    onAddToConstructor: extras.onAddToConstructor,
    canAddToConstructor: extras.selectedCount > 0,
    addToConstructorCount: extras.selectedCount,
    constructorAdded: extras.justAdded,
  };
}
