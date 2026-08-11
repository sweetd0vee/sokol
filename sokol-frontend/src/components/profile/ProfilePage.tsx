import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AVATAR_PRESETS, readStoredAvatarId, resolveAvatarSrc } from '../../constants/avatars';
import { Input } from '../ui/Input';
import {
  AVATAR_EVENT_NAME,
  AVATAR_STORAGE_KEY,
  PROFILE_EVENT_NAME,
  PROFILE_STORAGE_KEY,
} from '../../constants/storage';
import { isValidFullNameShort, normalizeFullNameShort } from '../../utils/fullName';
import { FORM_PAGE_CLASS, FORM_SAVE_BUTTON_CLASS } from '../../constants/formLayout';

type ProfileInfo = {
  fullName: string;
};

export function ProfilePage() {
  const { user } = useAuth();
  const displayName = user?.displayName ?? user?.shortName ?? '—';
  const [avatarId, setAvatarId] = useState(() => readStoredAvatarId());
  const [fullNameError, setFullNameError] = useState('');
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileInfo>(() => {
    const fallback: ProfileInfo = {
      fullName: displayName === '—' ? '' : displayName,
    };
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!stored) {
      return fallback;
    }
    try {
      const parsed = JSON.parse(stored) as Partial<ProfileInfo>;
      return { fullName: parsed.fullName ?? fallback.fullName };
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

  const handleFullNameChange = (value: string) => {
    setProfile({ fullName: value });
    if (fullNameError) {
      setFullNameError('');
    }
  };

  const handleFullNameBlur = () => {
    const normalized = normalizeFullNameShort(profile.fullName);
    setProfile({ fullName: normalized });
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

  const handleSaveProfile = () => {
    const normalized = normalizeFullNameShort(profile.fullName);
    setProfile({ fullName: normalized });
    if (normalized && !isValidFullNameShort(normalized)) {
      setFullNameError('Введите в формате: Фамилия И.О. (например: Иванов И.О.)');
      return;
    }
    setFullNameError('');
  };

  const selectedSrc = resolveAvatarSrc(avatarId);

  return (
    <div className={`${FORM_PAGE_CLASS} space-y-3`}>
      <h2 className="text-xl font-bold text-sber-dark">Профиль</h2>

      <div className="space-y-3">
        <div className="flex flex-col items-start gap-4">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start">
            <button
              type="button"
              onClick={() => setIsAvatarPickerOpen((prev) => !prev)}
              className="relative h-40 w-40 shrink-0 overflow-hidden rounded-3xl border border-gray-200 bg-gray-100 shadow-sm transition hover:border-sber-dark/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sber-dark/40 sm:h-44 sm:w-44"
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
            onChange={handleFullNameChange}
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
          onClick={handleSaveProfile}
          className={`${FORM_SAVE_BUTTON_CLASS} min-w-[8.75rem]`}
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}
