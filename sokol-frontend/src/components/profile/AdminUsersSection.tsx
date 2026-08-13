import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createUser, fetchUsers, type AppUser } from '../../api/users';
import { getErrorMessage } from '../../api/errors';
import type { UserRole } from '../../api/auth';
import { Input } from '../ui/Input';
import { FORM_SAVE_BUTTON_CLASS, FORM_SECTION_CLASS, FORM_SECTION_TITLE_CLASS } from '../../constants/formLayout';

const MIN_PASSWORD_LENGTH = 4;
const CREATED_USER_ROLE: UserRole = 'auditor';

function formatRole(role: UserRole) {
  return role === 'admin' ? 'Администратор' : 'Аудитор';
}

export function AdminUsersSection() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: users = [], isLoading, error: loadError } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Введите логин (Фамилия И.О.).');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Пароль — не менее ${MIN_PASSWORD_LENGTH} символов.`);
      return;
    }

    setSaving(true);
    try {
      await createUser({
        username: trimmedUsername,
        password,
        role: CREATED_USER_ROLE,
      });
      setUsername('');
      setPassword('');
      setSuccess(`Пользователь «${trimmedUsername}» добавлен.`);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Не удалось добавить пользователя.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <form className={FORM_SECTION_CLASS} onSubmit={handleSubmit}>
        <h3 className={FORM_SECTION_TITLE_CLASS}>Добавление пользователя</h3>
        <p className="text-sm text-gray-500">
          Логин совпадает с ФИО в формате «Фамилия И.О.». Новые пользователи создаются с ролью
          «Аудитор» и также добавляются в справочник аудиторов.
        </p>
        <div className="flex max-w-md flex-col gap-3">
          <Input
            label="Логин (Фамилия И.О.)"
            value={username}
            onChange={setUsername}
            placeholder="Иванов И.И."
            inputClassName="py-1.5 text-sm"
          />
          <Input
            label="Пароль"
            value={password}
            onChange={setPassword}
            type="password"
            autoComplete="new-password"
            inputClassName="py-1.5 text-sm"
          />
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-700" role="status">
              {success}
            </p>
          )}
          <button
            type="submit"
            className={`${FORM_SAVE_BUTTON_CLASS} self-start`}
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </div>
      </form>

      <div className={FORM_SECTION_CLASS}>
        <h3 className={FORM_SECTION_TITLE_CLASS}>Пользователи приложения</h3>
        {isLoading && <p className="text-sm text-gray-500">Загрузка…</p>}
        {loadError && (
          <p className="text-sm text-red-600" role="alert">
            {getErrorMessage(loadError, 'Не удалось загрузить список пользователей.')}
          </p>
        )}
        {!isLoading && !loadError && users.length === 0 && (
          <p className="text-sm text-gray-500">Пользователи не найдены.</p>
        )}
        {!isLoading && !loadError && users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="py-2 pr-4 font-medium">Логин</th>
                  <th className="py-2 pr-4 font-medium">Роль</th>
                  <th className="py-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {users.map((entry: AppUser) => (
                  <tr key={entry.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4">{entry.username}</td>
                    <td className="py-2 pr-4">{formatRole(entry.role)}</td>
                    <td className="py-2">{entry.is_active ? 'Активен' : 'Отключён'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
