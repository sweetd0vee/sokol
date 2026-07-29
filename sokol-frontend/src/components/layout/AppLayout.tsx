import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { readStoredAvatarId, resolveAvatarSrc } from '../../constants/avatars';
import { AVATAR_EVENT_NAME } from '../../constants/storage';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentUserName } from '../../hooks/useCurrentUserName';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const { logout } = useAuth();
  const currentUserName = useCurrentUserName();
  const location = useLocation();
  const [avatarId, setAvatarId] = useState(() => readStoredAvatarId());
  const [avatarFailed, setAvatarFailed] = useState(false);
  const displayName = currentUserName || '—';
  const initials = displayName?.trim()?.charAt(0)?.toUpperCase() ?? '—';
  const avatarSrc = resolveAvatarSrc(avatarId);
  const isProfileActive = location.pathname === '/profile';
  const isCompactFormPage =
    location.pathname === '/recommendations/new' ||
    /^\/recommendations\/[^/]+\/edit$/.test(location.pathname) ||
    location.pathname === '/checks/new' ||
    /^\/checks\/[^/]+\/edit$/.test(location.pathname);

  useEffect(() => {
    const handleAvatarChanged = (event: Event) => {
      const custom = event as CustomEvent<string>;
      if (custom.detail) {
        setAvatarId(custom.detail);
        setAvatarFailed(false);
      }
    };

    window.addEventListener(AVATAR_EVENT_NAME, handleAvatarChanged);
    return () => window.removeEventListener(AVATAR_EVENT_NAME, handleAvatarChanged);
  }, []);

  return (
    <div className="flex min-h-screen bg-white dark:bg-slate-900">
      <Sidebar />
      <div className="flex flex-1 flex-col bg-white dark:bg-slate-900">
        <header className="flex h-[88px] items-center justify-end border-b border-gray-200 bg-white pl-6 pr-8 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-2">
          <Link
            to="/profile"
            className={`flex h-10 w-[288px] items-center gap-2 rounded-lg border px-3 text-sm transition ${
              isProfileActive
                ? 'border-sber-dark text-sber-dark dark:border-sber-light dark:text-sber-light'
                : 'border-gray-200 text-gray-700 hover:border-sber-dark/40 hover:text-sber-dark dark:border-slate-600 dark:text-slate-200 dark:hover:border-sber-light/70 dark:hover:text-sber-light'
            }`}
            title="Профиль"
          >
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-slate-700">
              {!avatarFailed && (
                <img
                  src={avatarSrc}
                  alt="Аватар"
                  className="h-full w-full object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              )}
              {avatarFailed && (
                <span className="text-sm font-semibold text-sber-dark dark:text-sber-light">{initials}</span>
              )}
            </span>
            <span className="truncate font-medium">{displayName}</span>
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:border-sber-dark/40 hover:text-sber-dark dark:border-slate-600 dark:text-slate-200 dark:hover:border-sber-light/70 dark:hover:text-sber-light"
            aria-label="Выйти"
            title="Выйти"
          >
            <LogOut size={18} />
          </button>
          </div>
        </header>
        <main
          className={`flex-1 overflow-auto bg-white dark:bg-slate-900 ${
            isCompactFormPage ? 'px-4 py-4' : 'p-8'
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
