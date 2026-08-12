import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AVATAR_PRESETS, readStoredAvatarId, resolveAvatarSrc } from '../../constants/avatars';
import { Input } from '../ui/Input';
import { AVATAR_EVENT_NAME, AVATAR_STORAGE_KEY } from '../../constants/storage';
import { FORM_PAGE_CLASS } from '../../constants/formLayout';

export function ProfilePage() {
  const { user } = useAuth();
  const fullName = user?.shortName ?? user?.displayName ?? '—';
  const [avatarId, setAvatarId] = useState(() => readStoredAvatarId());
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const handleSelectAvatar = (id: string) => {
    setAvatarId(id);
    localStorage.setItem(AVATAR_STORAGE_KEY, id);
    window.dispatchEvent(new CustomEvent(AVATAR_EVENT_NAME, { detail: id }));
    setIsAvatarPickerOpen(false);
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
            value={fullName}
            onChange={() => {}}
            placeholder="Иванов И.О."
            className="w-[288px] max-w-[288px]"
            inputClassName="py-1.5 text-sm bg-gray-50"
            readOnly
          />
          <p className="w-[288px] max-w-[288px] text-left text-sm text-gray-500">
            Логин и ФИО в профиле совпадают и задаются учётной записью.
          </p>
        </div>
      </div>
    </div>
  );
}
