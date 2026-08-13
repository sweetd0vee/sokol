import { NavLink } from 'react-router-dom';
import {
  FileText,
  ClipboardList,
  BarChart3,
  FileCheck,
  Settings,
  Wrench,
  CalendarClock,
} from 'lucide-react';

const TABS = [
  { id: 'checks', path: '/checks', label: 'Проверки', icon: ClipboardList },
  { id: 'recommendations', path: '/recommendations', label: 'Рекомендации', icon: FileText },
  { id: 'analytics', path: '/analytics', label: 'Аналитика', icon: BarChart3 },
  { id: 'planning', path: '/planning', label: 'Планирование', icon: CalendarClock },
  { id: 'tools', path: '/tools', label: 'Инструменты', icon: Wrench },
  { id: 'kantsler', path: '/kantsler', label: 'Канцлер', icon: FileCheck },
  { id: 'settings', path: '/settings', label: 'Настройки', icon: Settings },
] as const;

export function Sidebar() {
  return (
    <aside className="w-56 min-h-screen bg-[#003366] flex flex-col shrink-0">
      <div className="flex h-[88px] items-center justify-center border-b border-sber-light/30 px-4">
        <h1 className="text-3xl font text-white">SOKOL</h1>
      </div>
      <nav className="flex flex-col p-2 flex-1">
        {TABS.map(({ id, path, label, icon: Icon }) => (
          <NavLink
            key={id}
            to={path}
            className={({ isActive }) =>
`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                isActive
                  ? 'bg-sber-light text-white'
                  : 'text-white/85 hover:bg-[#0066CC] hover:text-white'
              }`
            }
          >
            <Icon size={20} />
            <span className="font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
