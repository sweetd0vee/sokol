import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { ConstructorWidget, ConstructorWidgetDraft, ConstructorWidgetLayout } from './constructorTypes';
import { createConstructorInstanceId, packNewLayouts } from './constructorLayout';
import { AnalyticsConstructorContext } from './analyticsConstructorState';

const STORAGE_KEY = 'sokol.analytics.constructor.v1';

function loadWidgets(): ConstructorWidget[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ConstructorWidget[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistWidgets(widgets: ConstructorWidget[]) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  } catch {
    // Quota or private mode — keep the board in memory only.
  }
}

export function AnalyticsConstructorProvider({ children }: { children: ReactNode }) {
  const [widgets, setWidgets] = useState<ConstructorWidget[]>(loadWidgets);

  const addWidgets = useCallback((drafts: ConstructorWidgetDraft[]) => {
    if (drafts.length === 0) {
      return 0;
    }
    setWidgets((prev) => {
      const layouts = packNewLayouts(
        prev.map((widget) => widget.layout),
        drafts.map((draft) => draft.size),
      );
      const next = [
        ...prev,
        ...drafts.map((draft, index) => ({
          ...draft,
          instanceId: createConstructorInstanceId(draft.kind, draft.sectionId),
          layout: layouts[index] as ConstructorWidgetLayout,
        })),
      ];
      persistWidgets(next);
      return next;
    });
    return drafts.length;
  }, []);

  const removeWidget = useCallback((instanceId: string) => {
    setWidgets((prev) => {
      const next = prev.filter((widget) => widget.instanceId !== instanceId);
      persistWidgets(next);
      return next;
    });
  }, []);

  const clearBoard = useCallback(() => {
    setWidgets([]);
    persistWidgets([]);
  }, []);

  const updateLayout = useCallback((nextLayout: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
    setWidgets((prev) => {
      const byId = new Map(nextLayout.map((item) => [item.i, item]));
      let changed = false;
      const next = prev.map((widget) => {
        const item = byId.get(widget.instanceId);
        if (!item) {
          return widget;
        }
        if (
          item.x === widget.layout.x
          && item.y === widget.layout.y
          && item.w === widget.layout.w
          && item.h === widget.layout.h
        ) {
          return widget;
        }
        changed = true;
        return {
          ...widget,
          layout: {
            ...widget.layout,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          },
        };
      });
      if (!changed) {
        return prev;
      }
      persistWidgets(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ widgets, addWidgets, removeWidget, clearBoard, updateLayout }),
    [addWidgets, clearBoard, removeWidget, updateLayout, widgets],
  );

  return (
    <AnalyticsConstructorContext.Provider value={value}>{children}</AnalyticsConstructorContext.Provider>
  );
}
