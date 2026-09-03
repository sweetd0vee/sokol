import { describe, expect, it } from 'vitest';
import {
  createDashboardRecord,
  duplicateDashboardRecord,
  emptyConstructorLibrary,
  ensureActiveDashboard,
  migrateLegacyWidgets,
  parseConstructorLibrary,
  replaceDashboardWidgets,
} from './constructorLibrary';

describe('parseConstructorLibrary', () => {
  it('returns null for invalid payloads', () => {
    expect(parseConstructorLibrary(null)).toBeNull();
    expect(parseConstructorLibrary([])).toBeNull();
    expect(parseConstructorLibrary({ dashboards: 'nope' })).toBeNull();
  });

  it('keeps a valid active dashboard and drops broken rows', () => {
    const parsed = parseConstructorLibrary({
      activeDashboardId: 'b',
      dashboards: [
        { id: 'a', name: 'A', createdAt: '1', updatedAt: '1', widgets: [] },
        { id: 'b', name: 'B', createdAt: '2', updatedAt: '2', widgets: [] },
        { id: 3 },
      ],
    });
    expect(parsed?.activeDashboardId).toBe('b');
    expect(parsed?.dashboards.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('falls back to the first dashboard when the active id is missing', () => {
    const parsed = parseConstructorLibrary({
      activeDashboardId: 'missing',
      dashboards: [{ id: 'a', name: 'A', createdAt: '1', updatedAt: '1', widgets: [] }],
    });
    expect(parsed?.activeDashboardId).toBe('a');
  });
});

describe('migrateLegacyWidgets', () => {
  it('wraps a non-empty widget list into a draft dashboard', () => {
    const migrated = migrateLegacyWidgets([{ instanceId: 'w1' }]);
    expect(migrated?.dashboards).toHaveLength(1);
    expect(migrated?.dashboards[0]?.name).toBe('Черновик');
    expect(migrated?.dashboards[0]?.widgets).toEqual([{ instanceId: 'w1' }]);
    expect(migrated?.activeDashboardId).toBe(migrated?.dashboards[0]?.id);
  });

  it('ignores an empty legacy board', () => {
    expect(migrateLegacyWidgets([])).toBeNull();
  });
});

describe('ensureActiveDashboard', () => {
  it('creates a dashboard when the library is empty', () => {
    const now = new Date('2026-09-03T08:00:00');
    const next = ensureActiveDashboard(emptyConstructorLibrary(), now);
    expect(next.library.dashboards).toHaveLength(1);
    expect(next.dashboardId).toBe(next.library.activeDashboardId);
    expect(next.library.dashboards[0]?.name).toContain('Дашборд');
  });

  it('reuses the current active dashboard', () => {
    const dashboard = createDashboardRecord('Отчёт', [], new Date('2026-09-03T08:00:00'));
    const library = { dashboards: [dashboard], activeDashboardId: dashboard.id };
    const next = ensureActiveDashboard(library);
    expect(next.dashboardId).toBe(dashboard.id);
    expect(next.library.dashboards).toHaveLength(1);
  });
});

describe('replaceDashboardWidgets and duplicateDashboardRecord', () => {
  it('updates widgets and timestamp on the target dashboard only', () => {
    const first = createDashboardRecord('A', [], new Date('2026-09-03T08:00:00'));
    const second = createDashboardRecord('B', [], new Date('2026-09-03T08:00:00'));
    const later = new Date('2026-09-03T09:00:00');
    const next = replaceDashboardWidgets(
      { dashboards: [first, second], activeDashboardId: first.id },
      first.id,
      [{ instanceId: 'w1' } as never],
      later,
    );
    expect(next.dashboards[0]?.widgets).toHaveLength(1);
    expect(next.dashboards[0]?.updatedAt).toBe(later.toISOString());
    expect(next.dashboards[1]?.updatedAt).toBe(second.updatedAt);
  });

  it('copies widgets into a new dashboard id', () => {
    const source = createDashboardRecord('Источник', [{ instanceId: 'w1' } as never]);
    const copy = duplicateDashboardRecord(source, 'Копия');
    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe('Копия');
    expect(copy.widgets).toEqual(source.widgets);
  });
});
