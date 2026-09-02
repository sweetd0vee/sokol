import { createContext, useContext } from 'react';
import type { ConstructorWidget, ConstructorWidgetDraft } from './constructorTypes';

export type AnalyticsConstructorContextValue = {
  widgets: ConstructorWidget[];
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
