import { describe, expect, it } from 'vitest';
import type { ConstructorDashboardRecord } from '../components/analytics/constructor/constructorLibrary';
import type { ConstructorWidget } from '../components/analytics/constructor/constructorTypes';
import {
  dashboardSourceSummary,
  defaultConstructorDashboards,
  filterConstructorDashboards,
  getConstructorSortValue,
} from './constructorList';

function dashboard(
  overrides: Partial<ConstructorDashboardRecord> & Pick<ConstructorDashboardRecord, 'id' | 'name'>,
): ConstructorDashboardRecord {
  return {
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
    widgets: [],
    ...overrides,
  };
}

function widget(kind: ConstructorWidget['kind']): ConstructorWidget {
  return { kind } as ConstructorWidget;
}

describe('constructorList', () => {
  it('filters dashboards by name without regard to case', () => {
    const dashboards = [
      dashboard({ id: '1', name: 'Отчёт E2E' }),
      dashboard({ id: '2', name: 'Второй лист' }),
    ];
    expect(filterConstructorDashboards(dashboards, 'отчёт').map((item) => item.id)).toEqual(['1']);
    expect(filterConstructorDashboards(dashboards, '  ')).toHaveLength(2);
  });

  it('orders by updated time descending by default', () => {
    const dashboards = [
      dashboard({ id: 'old', name: 'Старый', updatedAt: '2026-09-01T08:00:00.000Z' }),
      dashboard({ id: 'new', name: 'Новый', updatedAt: '2026-09-03T08:00:00.000Z' }),
    ];
    expect(defaultConstructorDashboards(dashboards).map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('sorts by chart count, sources and timestamps', () => {
    const empty = dashboard({ id: 'empty', name: 'Пустой' });
    const checks = dashboard({
      id: 'checks',
      name: 'Проверки',
      widgets: [widget('checks'), widget('checks')],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    });
    expect(getConstructorSortValue(checks, 'charts')).toBe(2);
    expect(getConstructorSortValue(empty, 'sources')).toBe('Пустой лист');
    expect(getConstructorSortValue(checks, 'sources')).toBe('Проверки');
    expect(dashboardSourceSummary(['checks', 'planning'])).toBe('Проверки, Планирование');
    expect(getConstructorSortValue(checks, 'updatedAt')).toBeGreaterThan(
      getConstructorSortValue(empty, 'updatedAt') as number,
    );
  });
});
