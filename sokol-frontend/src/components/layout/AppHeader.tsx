import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { resolveAvatarSrc } from '../../constants/avatars';
import { LIST_CHROME_RIGHT_INSET_CLASS } from '../../constants/formLayout';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentUserName } from '../../hooks/useCurrentUserName';
import { useStoredAvatar } from '../../hooks/useStoredAvatar';

export function AppHeader() {
  const { logout } = useAuth();
  const currentUserName = useCurrentUserName();
  const location = useLocation();
  const { avatarId, avatarFailed, setAvatarFailed } = useStoredAvatar();
  const displayName = currentUserName || '—';
  const initials = displayName?.trim()?.charAt(0)?.toUpperCase() ?? '—';
  const avatarSrc = resolveAvatarSrc(avatarId);
  const isProfileActive = location.pathname === '/profile';

  return (
    <header className="flex h-[88px] items-center justify-end border-b border-gray-200 bg-white pl-6 pr-8">
      <div className={`flex shrink-0 ${LIST_CHROME_RIGHT_INSET_CLASS}`}>
        <div className="flex w-[334px] items-center justify-between">
        <Link
          to="/profile"
          className={`flex h-10 w-[288px] items-center gap-2 rounded-lg border px-3 text-sm transition ${
            isProfileActive
              ? 'border-sber-dark text-sber-dark '
              : 'border-gray-200 text-gray-700 hover:border-sber-dark/40 hover:text-sber-dark '
          }`}
          title="Профиль"
        >
          <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
            {!avatarFailed && (
              <img
                src={avatarSrc}
                alt="Аватар"
                className="h-full w-full object-cover"
                onError={() => setAvatarFailed(true)}
              />
            )}
            {avatarFailed && (
              <span className="text-sm font-semibold text-sber-dark">{initials}</span>
            )}
          </span>
          <span className="truncate font-medium">{displayName}</span>
        </Link>
        <button
          type="button"
          onClick={logout}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:border-sber-dark/40 hover:text-sber-dark"
          aria-label="Выйти"
          title="Выйти"
        >
          <LogOut size={18} />
        </button>
        </div>
      </div>
    </header>
  );
}
