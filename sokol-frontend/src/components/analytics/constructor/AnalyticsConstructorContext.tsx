import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { ConstructorWidget, ConstructorWidgetDraft, ConstructorWidgetLayout } from './constructorTypes';
import { createConstructorInstanceId, packNewLayouts } from './constructorLayout';
import { AnalyticsConstructorContext } from './analyticsConstructorState';
import {
  createDashboardRecord,
  defaultDashboardName,
  duplicateDashboardRecord,
  ensureActiveDashboard,
  loadConstructorLibrary,
  persistConstructorLibrary,
  replaceDashboardWidgets,
  type ConstructorDashboardRecord,
  type ConstructorLibrary,
} from './constructorLibrary';

function persist(library: ConstructorLibrary) {
  persistConstructorLibrary(library);
}

export function AnalyticsConstructorProvider({ children }: { children: ReactNode }) {
  const [library, setLibrary] = useState<ConstructorLibrary>(loadConstructorLibrary);

  const createDashboard = useCallback((name: string) => {
    const record = createDashboardRecord(name.trim() || defaultDashboardName());
    setLibrary((prev) => {
      const next = {
        dashboards: [record, ...prev.dashboards],
        activeDashboardId: record.id,
      };
      persist(next);
      return next;
    });
    return record;
  }, []);

  const renameDashboard = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setLibrary((prev) => {
      const next = {
        ...prev,
        dashboards: prev.dashboards.map((item) =>
          item.id === id
            ? { ...item, name: trimmed, updatedAt: new Date().toISOString() }
            : item,
        ),
      };
      persist(next);
      return next;
    });
  }, []);

  const duplicateDashboard = useCallback((id: string, name: string) => {
    let created: ConstructorDashboardRecord | null = null;
    setLibrary((prev) => {
      const source = prev.dashboards.find((item) => item.id === id);
      if (!source) {
        return prev;
      }
      created = duplicateDashboardRecord(source, name.trim() || `${source.name} (копия)`);
      const next = {
        dashboards: [created, ...prev.dashboards],
        activeDashboardId: created.id,
      };
      persist(next);
      return next;
    });
    return created;
  }, []);

  const deleteDashboard = useCallback((id: string) => {
    setLibrary((prev) => {
      const dashboards = prev.dashboards.filter((item) => item.id !== id);
      const activeDashboardId =
        prev.activeDashboardId === id
          ? (dashboards[0]?.id ?? null)
          : prev.activeDashboardId;
      const next = { dashboards, activeDashboardId };
      persist(next);
      return next;
    });
  }, []);

  const setActiveDashboard = useCallback((id: string | null) => {
    setLibrary((prev) => {
      if (prev.activeDashboardId === id) {
        return prev;
      }
      if (id !== null && !prev.dashboards.some((item) => item.id === id)) {
        return prev;
      }
      const next = { ...prev, activeDashboardId: id };
      persist(next);
      return next;
    });
  }, []);

  const updateDashboardWidgets = useCallback(
    (dashboardId: string, mutator: (widgets: ConstructorWidget[]) => ConstructorWidget[]) => {
      setLibrary((prev) => {
        const dashboard = prev.dashboards.find((item) => item.id === dashboardId);
        if (!dashboard) {
          return prev;
        }
        const next = replaceDashboardWidgets(prev, dashboardId, mutator(dashboard.widgets));
        persist(next);
        return next;
      });
    },
    [],
  );

  const updateActiveWidgets = useCallback(
    (mutator: (widgets: ConstructorWidget[]) => ConstructorWidget[]) => {
      setLibrary((prev) => {
        const ensured = ensureActiveDashboard(prev);
        const dashboard = ensured.library.dashboards.find((item) => item.id === ensured.dashboardId);
        if (!dashboard) {
          return prev;
        }
        const next = replaceDashboardWidgets(ensured.library, ensured.dashboardId, mutator(dashboard.widgets));
        persist(next);
        return next;
      });
    },
    [],
  );

  const addWidgets = useCallback((drafts: ConstructorWidgetDraft[]) => {
    if (drafts.length === 0) {
      return 0;
    }
    updateActiveWidgets((prev) => {
      const layouts = packNewLayouts(
        prev.map((widget) => widget.layout),
        drafts.map((draft) => draft.size),
      );
      return [
        ...prev,
        ...drafts.map((draft, index) => ({
          ...draft,
          instanceId: createConstructorInstanceId(draft.kind, draft.sectionId),
          layout: layouts[index] as ConstructorWidgetLayout,
        })),
      ];
    });
    return drafts.length;
  }, [updateActiveWidgets]);

  const removeWidget = useCallback((dashboardId: string, instanceId: string) => {
    updateDashboardWidgets(dashboardId, (prev) => prev.filter((widget) => widget.instanceId !== instanceId));
  }, [updateDashboardWidgets]);

  const clearBoard = useCallback((dashboardId: string) => {
    updateDashboardWidgets(dashboardId, () => []);
  }, [updateDashboardWidgets]);

  const updateLayout = useCallback((dashboardId: string, nextLayout: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
    setLibrary((prev) => {
      const dashboard = prev.dashboards.find((item) => item.id === dashboardId);
      if (!dashboard) {
        return prev;
      }
      const byId = new Map(nextLayout.map((item) => [item.i, item]));
      let changed = false;
      const widgets = dashboard.widgets.map((widget) => {
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
      const next = replaceDashboardWidgets(prev, dashboard.id, widgets);
      persist(next);
      return next;
    });
  }, []);

  const activeDashboard = useMemo(
    () => library.dashboards.find((item) => item.id === library.activeDashboardId) ?? null,
    [library.activeDashboardId, library.dashboards],
  );

  const value = useMemo(
    () => ({
      dashboards: library.dashboards,
      activeDashboardId: library.activeDashboardId,
      activeDashboard,
      widgets: activeDashboard?.widgets ?? [],
      createDashboard,
      renameDashboard,
      duplicateDashboard,
      deleteDashboard,
      setActiveDashboard,
      addWidgets,
      removeWidget,
      clearBoard,
      updateLayout,
    }),
    [
      activeDashboard,
      addWidgets,
      clearBoard,
      createDashboard,
      deleteDashboard,
      duplicateDashboard,
      library.activeDashboardId,
      library.dashboards,
      removeWidget,
      renameDashboard,
      setActiveDashboard,
      updateLayout,
    ],
  );

  return (
    <AnalyticsConstructorContext.Provider value={value}>{children}</AnalyticsConstructorContext.Provider>
  );
}
