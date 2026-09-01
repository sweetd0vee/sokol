import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { changePasswordRequest } from '../../api/auth';
import { getErrorMessage } from '../../api/errors';
import { AdminUsersSection } from './AdminUsersSection';
import { AVATAR_PRESETS, readStoredAvatarId, resolveAvatarSrc } from '../../constants/avatars';
import { Input } from '../ui/Input';
import { AVATAR_EVENT_NAME, AVATAR_STORAGE_KEY } from '../../constants/storage';
import { FORM_PAGE_CLASS, FORM_SAVE_BUTTON_CLASS, FORM_SECTION_CLASS, FORM_SECTION_TITLE_CLASS } from '../../constants/formLayout';

const MIN_PASSWORD_LENGTH = 4;

export function ProfilePage() {
  const { user, isAdmin } = useAuth();
  const fullName = user?.shortName ?? user?.displayName ?? '—';
  const [avatarId, setAvatarId] = useState(() => readStoredAvatarId());
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handleSelectAvatar = (id: string) => {
    setAvatarId(id);
    localStorage.setItem(AVATAR_STORAGE_KEY, id);
    window.dispatchEvent(new CustomEvent(AVATAR_EVENT_NAME, { detail: id }));
    setIsAvatarPickerOpen(false);
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword.trim()) {
      setPasswordError('Введите текущий пароль.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Новый пароль — не менее ${MIN_PASSWORD_LENGTH} символов.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Новый пароль и подтверждение не совпадают.');
      return;
    }

    setPasswordSaving(true);
    try {
      await changePasswordRequest(currentPassword.trim(), newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Пароль успешно изменён.');
    } catch (error) {
      setPasswordError(getErrorMessage(error, 'Не удалось сменить пароль.'));
    } finally {
      setPasswordSaving(false);
    }
  };

  const selectedSrc = resolveAvatarSrc(avatarId);

  return (
    <div className={`${FORM_PAGE_CLASS} space-y-3`}>
      <h2 className="text-xl font-bold text-sber-dark">Профиль</h2>

      <div className={FORM_SECTION_CLASS}>
        <div className="space-y-3">
          <div className="flex flex-col items-start gap-4">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start">
              <button
                type="button"
                onClick={() => setIsAvatarPickerOpen((prev) => !prev)}
                className="relative h-40 w-40 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-100 shadow-sm transition hover:border-sber-dark/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sber-dark/40 sm:h-44 sm:w-44"
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
                        className={`relative h-16 w-16 overflow-hidden rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sber-dark/40 sm:h-20 sm:w-20 ${
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

      <form className={FORM_SECTION_CLASS} onSubmit={handleChangePassword}>
        <h3 className={FORM_SECTION_TITLE_CLASS}>Смена пароля</h3>
        <div className="flex max-w-md flex-col gap-3">
          <Input
            label="Текущий пароль"
            value={currentPassword}
            onChange={setCurrentPassword}
            type={showCurrentPassword ? 'text' : 'password'}
            autoComplete="current-password"
            inputClassName="py-1.5 text-sm"
            rightElement={
              <button
                type="button"
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                className="text-gray-500 hover:text-sber-dark"
                aria-label={showCurrentPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          <Input
            label="Новый пароль"
            value={newPassword}
            onChange={setNewPassword}
            type={showNewPassword ? 'text' : 'password'}
            autoComplete="new-password"
            inputClassName="py-1.5 text-sm"
            rightElement={
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="text-gray-500 hover:text-sber-dark"
                aria-label={showNewPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          <Input
            label="Подтверждение нового пароля"
            value={confirmPassword}
            onChange={setConfirmPassword}
            type={showNewPassword ? 'text' : 'password'}
            autoComplete="new-password"
            inputClassName="py-1.5 text-sm"
          />
          {passwordError && (
            <p className="text-sm text-red-600" role="alert">
              {passwordError}
            </p>
          )}
          {passwordSuccess && (
            <p className="text-sm text-green-700" role="status">
              {passwordSuccess}
            </p>
          )}
          <button
            type="submit"
            className={`${FORM_SAVE_BUTTON_CLASS} self-start`}
            disabled={passwordSaving}
            aria-busy={passwordSaving}
          >
            {passwordSaving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </form>

      {isAdmin && <AdminUsersSection />}
    </div>
  );
}
