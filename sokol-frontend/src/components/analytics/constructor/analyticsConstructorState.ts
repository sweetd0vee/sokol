import { createContext, useContext } from 'react';
import type { ConstructorDashboardRecord } from './constructorLibrary';
import type { ConstructorWidget, ConstructorWidgetDraft } from './constructorTypes';

export type AnalyticsConstructorContextValue = {
  dashboards: ConstructorDashboardRecord[];
  activeDashboardId: string | null;
  activeDashboard: ConstructorDashboardRecord | null;
  widgets: ConstructorWidget[];
  createDashboard: (name: string) => ConstructorDashboardRecord;
  renameDashboard: (id: string, name: string) => void;
  duplicateDashboard: (id: string, name: string) => ConstructorDashboardRecord | null;
  deleteDashboard: (id: string) => void;
  setActiveDashboard: (id: string | null) => void;
  saveActiveDashboard: () => void;
  addWidgets: (drafts: ConstructorWidgetDraft[]) => number;
  removeWidget: (instanceId: string) => void;
  clearBoard: () => void;
  updateLayout: (next: Array<{ i: string; x: number; y: number; w: number; h: number }>) => void;
};

export const AnalyticsConstructorContext = createContext<AnalyticsConstructorContextValue | null>(null);

export function useAnalyticsConstructor() {
  const context = useContext(AnalyticsConstructorContext);
  if (!context) {
    throw new Error('useAnalyticsConstructor must be used within AnalyticsConstructorProvider');
  }
  return context;
}
