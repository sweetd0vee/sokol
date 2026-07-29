import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AVATAR_PRESETS, readStoredAvatarId, resolveAvatarSrc } from '../../constants/avatars';
import { Input } from '../ui/Input';
import {
  AVATAR_EVENT_NAME,
  AVATAR_STORAGE_KEY,
  LAST_LOGIN_KEY,
  PROFILE_EVENT_NAME,
  PROFILE_STORAGE_KEY,
} from '../../constants/storage';

type ProfileInfo = {
  fullName: string;
  login: string;
  department: string;
  phone: string;
  email: string;
  address: string;
  workplace: string;
  status: string;
  lastLogin: string;
};

const FULL_NAME_SHORT_REGEX = /^[A-Za-zА-Яа-яЁё-]+ [A-ZА-ЯЁ]\.[A-ZА-ЯЁ]\.$/;

const normalizeFullNameShort = (value: string) => {
  const compact = value.trim().replace(/\s+/g, ' ');
  const match = compact.match(/^([A-Za-zА-Яа-яЁё-]+)\s+([A-Za-zА-Яа-яЁё])\.?\s*([A-Za-zА-Яа-яЁё])\.?$/);
  if (!match) {
    return compact;
  }
  const [, lastName, firstInitial, middleInitial] = match;
  return `${lastName} ${firstInitial.toUpperCase()}.${middleInitial.toUpperCase()}.`;
};

const isValidFullNameShort = (value: string) => FULL_NAME_SHORT_REGEX.test(value);

export function ProfilePage() {
  const { user } = useAuth();
  const displayName = user?.displayName ?? user?.shortName ?? '—';
  const [avatarId, setAvatarId] = useState(() => readStoredAvatarId());
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [fullNameError, setFullNameError] = useState('');
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileInfo>(() => {
    const storedLastLogin = localStorage.getItem(LAST_LOGIN_KEY);
    const lastLogin = storedLastLogin ?? new Date().toISOString();
    if (!storedLastLogin) {
      localStorage.setItem(LAST_LOGIN_KEY, lastLogin);
    }
    const fallback: ProfileInfo = {
      fullName: displayName === '—' ? '' : displayName,
      login: user?.shortName ?? '',
      department: '',
      phone: '',
      email: '',
      address: '',
      workplace: '',
      status: '',
      lastLogin,
    };
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!stored) {
      return fallback;
    }
    try {
      const parsed = JSON.parse(stored) as Partial<ProfileInfo>;
      return { ...fallback, ...parsed, lastLogin: parsed.lastLogin ?? lastLogin };
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent(PROFILE_EVENT_NAME, { detail: profile.fullName }));
  }, [profile]);

  const handleSelectAvatar = (id: string) => {
    setAvatarId(id);
    localStorage.setItem(AVATAR_STORAGE_KEY, id);
    window.dispatchEvent(new CustomEvent(AVATAR_EVENT_NAME, { detail: id }));
    setIsAvatarPickerOpen(false);
  };

  const handleProfileChange = (field: keyof ProfileInfo, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    if (field === 'fullName' && fullNameError) {
      setFullNameError('');
    }
  };
  const handleFullNameBlur = () => {
    const normalized = normalizeFullNameShort(profile.fullName);
    setProfile((prev) => ({ ...prev, fullName: normalized }));
    if (!normalized) {
      setFullNameError('');
      return;
    }
    if (!isValidFullNameShort(normalized)) {
      setFullNameError('Введите в формате: Фамилия И.О. (например: Иванов И.О.)');
      return;
    }
    setFullNameError('');
  };
  const handleOpenChangePassword = () => {
    setOldPassword('');
    setNewPassword('');
    setIsChangePasswordOpen(true);
  };
  const handleCloseChangePassword = () => {
    setIsChangePasswordOpen(false);
  };
  const handleSubmitChangePassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (!oldPassword.trim() || !newPassword.trim()) {
      return;
    }
    setOldPassword('');
    setNewPassword('');
    setIsChangePasswordOpen(false);
  };
  const handleSaveProfile = () => {
    const normalized = normalizeFullNameShort(profile.fullName);
    setProfile((prev) => ({ ...prev, fullName: normalized }));
    if (normalized && !isValidFullNameShort(normalized)) {
      setFullNameError('Введите в формате: Фамилия И.О. (например: Иванов И.О.)');
      return;
    }
    setFullNameError('');
  };

  const selectedSrc = resolveAvatarSrc(avatarId);

  return (
    <div className="w-full max-w-7xl space-y-3">
      <h2 className="text-xl font-bold text-sber-dark dark:text-sber-light">Профиль</h2>

      <div className="space-y-3 rounded-lg border border-[#b8bec8] bg-gray-50 p-3">
        <div className="flex flex-col items-start gap-4">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start">
            <button
              type="button"
              onClick={() => setIsAvatarPickerOpen((prev) => !prev)}
              className="relative h-40 w-40 shrink-0 overflow-hidden rounded-3xl border border-gray-200 bg-gray-100 shadow-sm transition hover:border-sber-dark/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sber-dark/40 dark:border-slate-600 dark:bg-slate-700 sm:h-44 sm:w-44"
              aria-expanded={isAvatarPickerOpen}
              aria-controls="profile-avatar-picker"
              aria-label="Изменить аватар"
              title="Нажмите, чтобы сменить аватар"
            >
              <img src={selectedSrc} alt="Аватар профиля" className="h-full w-full object-cover" />
            </button>
            {isAvatarPickerOpen && (
              <div
                id="profile-avatar-picker"
                className="grid w-fit grid-cols-6 justify-items-center gap-2.5 sm:gap-3"
                role="listbox"
                aria-label="Предложенные аватары"
              >
                {AVATAR_PRESETS.map((preset) => {
                  const isSelected = preset.id === avatarId;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      aria-label={preset.label}
                      title={preset.label}
                      onClick={() => handleSelectAvatar(preset.id)}
                      className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sber-dark/40 sm:h-20 sm:w-20 ${
                        isSelected ? 'border-sber-dark shadow-md' : 'border-transparent hover:border-sber-dark/30'
                      }`}
                    >
                      <img src={preset.src} alt="" className="h-full w-full object-cover" />
                      {isSelected && (
                        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sber-dark" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Input
            label="Фамилия И.О."
            value={profile.fullName}
            onChange={(value) => handleProfileChange('fullName', value)}
            onBlur={handleFullNameBlur}
            placeholder="Иванов И.О."
            className="w-[288px] max-w-[288px]"
            inputClassName="py-1.5 text-sm"
          />
          {fullNameError && (
            <p className="w-[288px] max-w-[288px] text-left text-sm text-red-600">{fullNameError}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleOpenChangePassword}
          className="inline-flex items-center justify-center rounded-lg border-2 border-[#6699FF] px-3 py-1.5 text-sm font-medium text-[#6699FF] transition hover:border-[#3B82F6] hover:bg-[#3B82F6] hover:text-white min-w-[8.75rem]"
        >
          Сменить пароль
        </button>
        <button
          type="button"
          onClick={handleSaveProfile}
          className="inline-flex items-center justify-center rounded-lg bg-[#90EE90] px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-[#7fdc7f] min-w-[8.75rem]"
        >
          Сохранить
        </button>
      </div>

      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-xl dark:border-slate-600 dark:bg-slate-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Смена пароля</h3>
            <form onSubmit={handleSubmitChangePassword} className="mt-4 space-y-4">
              <Input
                label="Введите старый пароль"
                value={oldPassword}
                onChange={setOldPassword}
                type="password"
                placeholder="Старый пароль"
              />
              <Input
                label="Введите новый пароль"
                value={newPassword}
                onChange={setNewPassword}
                type="password"
                placeholder="Новый пароль"
              />
              <div className="flex items-center justify-center gap-3">
                <button
                  type="submit"
                  disabled={!oldPassword.trim() || !newPassword.trim()}
                  className="inline-flex items-center justify-center rounded-lg bg-sber-dark px-6 py-2 text-sm font-semibold text-white transition hover:bg-sber-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={handleCloseChangePassword}
                  className="inline-flex items-center justify-center rounded-lg border border-[#3B82F6] px-6 py-2 text-sm font-medium text-[#3B82F6] transition hover:bg-[#3B82F6] hover:text-white"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
