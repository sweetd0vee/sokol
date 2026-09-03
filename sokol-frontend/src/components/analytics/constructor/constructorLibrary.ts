import {
  CONSTRUCTOR_LIBRARY_STORAGE_KEY,
  CONSTRUCTOR_WIDGETS_LEGACY_KEY,
} from '../../../constants/storage';
import type { ConstructorWidget } from './constructorTypes';

export type ConstructorDashboardRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  widgets: ConstructorWidget[];
};

export type ConstructorLibrary = {
  dashboards: ConstructorDashboardRecord[];
  activeDashboardId: string | null;
};

export function createDashboardId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `dashboard-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultDashboardName(now = new Date()) {
  return `Дашборд ${now.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function createDashboardRecord(
  name: string,
  widgets: ConstructorWidget[] = [],
  now = new Date(),
): ConstructorDashboardRecord {
  const stamp = now.toISOString();
  return {
    id: createDashboardId(),
    name: name.trim() || defaultDashboardName(now),
    createdAt: stamp,
    updatedAt: stamp,
    widgets,
  };
}

function isDashboardRecord(item: unknown): item is ConstructorDashboardRecord {
  if (!item || typeof item !== 'object') {
    return false;
  }
  const record = item as ConstructorDashboardRecord;
  return typeof record.id === 'string'
    && typeof record.name === 'string'
    && Array.isArray(record.widgets);
}

export function parseConstructorLibrary(raw: unknown): ConstructorLibrary | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Partial<ConstructorLibrary>;
  if (!Array.isArray(value.dashboards)) {
    return null;
  }
  const dashboards = value.dashboards.filter(isDashboardRecord);
  const activeDashboardId =
    typeof value.activeDashboardId === 'string'
    && dashboards.some((item) => item.id === value.activeDashboardId)
      ? value.activeDashboardId
      : (dashboards[0]?.id ?? null);
  return { dashboards, activeDashboardId };
}

export function migrateLegacyWidgets(widgets: unknown): ConstructorLibrary | null {
  if (!Array.isArray(widgets) || widgets.length === 0) {
    return null;
  }
  const dashboard = createDashboardRecord('Черновик', widgets as ConstructorWidget[]);
  return { dashboards: [dashboard], activeDashboardId: dashboard.id };
}

export function emptyConstructorLibrary(): ConstructorLibrary {
  return { dashboards: [], activeDashboardId: null };
}

export function persistConstructorLibrary(library: ConstructorLibrary) {
  try {
    window.localStorage.setItem(CONSTRUCTOR_LIBRARY_STORAGE_KEY, JSON.stringify(library));
  } catch {
    // Quota or private mode — keep the library in memory only.
  }
}

export function loadConstructorLibrary(): ConstructorLibrary {
  if (typeof window === 'undefined') {
    return emptyConstructorLibrary();
  }
  try {
    const raw = window.localStorage.getItem(CONSTRUCTOR_LIBRARY_STORAGE_KEY);
    const parsed = raw ? parseConstructorLibrary(JSON.parse(raw) as unknown) : null;
    if (parsed) {
      return parsed;
    }
  } catch {
    // Ignore corrupt library JSON.
  }
  try {
    const legacy = window.sessionStorage.getItem(CONSTRUCTOR_WIDGETS_LEGACY_KEY);
    if (legacy) {
      const migrated = migrateLegacyWidgets(JSON.parse(legacy) as unknown);
      if (migrated) {
        persistConstructorLibrary(migrated);
        window.sessionStorage.removeItem(CONSTRUCTOR_WIDGETS_LEGACY_KEY);
        return migrated;
      }
    }
  } catch {
    // Ignore corrupt legacy JSON.
  }
  return emptyConstructorLibrary();
}

export function ensureActiveDashboard(library: ConstructorLibrary, now = new Date()) {
  const existing = library.dashboards.find((item) => item.id === library.activeDashboardId);
  if (existing) {
    return { library, dashboardId: existing.id };
  }
  const created = createDashboardRecord(defaultDashboardName(now), [], now);
  return {
    library: {
      dashboards: [created, ...library.dashboards],
      activeDashboardId: created.id,
    },
    dashboardId: created.id,
  };
}

export function replaceDashboardWidgets(
  library: ConstructorLibrary,
  dashboardId: string,
  widgets: ConstructorWidget[],
  now = new Date(),
): ConstructorLibrary {
  return {
    ...library,
    dashboards: library.dashboards.map((item) =>
      item.id === dashboardId
        ? { ...item, widgets, updatedAt: now.toISOString() }
        : item,
    ),
  };
}

export function duplicateDashboardRecord(
  source: ConstructorDashboardRecord,
  name: string,
  now = new Date(),
): ConstructorDashboardRecord {
  return createDashboardRecord(name, source.widgets.map((widget) => ({ ...widget })), now);
}
