import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { visibleNavItems } from '../../constants/nav';

export function Sidebar() {
  const { isAdmin } = useAuth();
  const tabs = visibleNavItems(isAdmin);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-[#003366]">
      <div className="flex h-[88px] items-center justify-center border-b border-sber-light/30 px-4">
        <h1 className="text-3xl font text-white">SOKOL</h1>
      </div>
      <nav className="flex flex-col p-2 flex-1">
        {tabs.map(({ id, path, label, icon: Icon }) => (
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
