import { useCallback, useState } from 'react';
import type { AnalyticsExportFormat } from '../../utils/analyticsExport';

export function useAnalyticsDashboardSession() {
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<AnalyticsExportFormat>('html');
  const [isExporting, setIsExporting] = useState(false);

  const removeAuditor = useCallback((value: string) => {
    setSelectedAuditors((prev) => prev.filter((item) => item !== value));
  }, []);

  const removeDepartment = useCallback((value: string) => {
    setSelectedDepartments((prev) => prev.filter((item) => item !== value));
  }, []);

  const resetEntityFilters = useCallback(() => {
    setSelectedAuditors([]);
    setSelectedDepartments([]);
  }, []);

  return {
    selectedAuditors,
    setSelectedAuditors,
    selectedDepartments,
    setSelectedDepartments,
    exportFormat,
    setExportFormat,
    isExporting,
    setIsExporting,
    removeAuditor,
    removeDepartment,
    resetEntityFilters,
  };
}
