import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Settings,
  Wrench,
} from 'lucide-react';

export type AppNavItem = {
  id: string;
  path: string;
  label: string;
  icon: typeof ClipboardList;
  adminOnly?: boolean;
};

export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  { id: 'checks', path: '/checks', label: 'Проверки', icon: ClipboardList },
  { id: 'recommendations', path: '/recommendations', label: 'Рекомендации', icon: FileText },
  { id: 'analytics', path: '/analytics', label: 'Аналитика', icon: BarChart3 },
  { id: 'planning', path: '/planning', label: 'Планирование', icon: CalendarClock },
  { id: 'constructor', path: '/constructor', label: 'Конструктор', icon: LayoutDashboard },
  { id: 'tools', path: '/tools', label: 'Инструменты', icon: Wrench },
  { id: 'settings', path: '/settings', label: 'Настройки', icon: Settings, adminOnly: true },
];

export function visibleNavItems(isAdmin: boolean): AppNavItem[] {
  return APP_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
}
