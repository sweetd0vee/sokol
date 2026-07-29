import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../ui/Input';
import { Eye, EyeOff, LogIn } from 'lucide-react';

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

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const normalizedFullName = normalizeFullNameShort(fullName);
      if (!FULL_NAME_SHORT_REGEX.test(normalizedFullName)) {
        setError('Введите Фамилию И.О. в формате, например: Иванов И.О.');
        return;
      }

      const ok = await login(normalizedFullName, password);
      if (!ok) {
        setError('Введите Фамилию И.О. и пароль');
        return;
      }
      navigate('/checks', { replace: true });
    } catch {
      setError('Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900">
      <div className="absolute left-8 top-6 text-2xl font-semibold text-sber-dark dark:text-sber-light">СберБанк</div>
      <div className="w-full max-w-4xl rounded-[32px] border border-gray-200 bg-white p-16 shadow-lg dark:border-slate-700 dark:bg-slate-800">
        <div className="text-center mb-12">
          <h1 className="mt-4 text-6xl font text-sber-dark">SOKOL</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <Input
            label="Фамилия И.О."
            value={fullName}
            onChange={setFullName}
            onBlur={() => setFullName((prev) => normalizeFullNameShort(prev))}
            placeholder="Введите Фамилию И.О."
            inputClassName="py-5 text-xl"
          />
          <Input
            label="Пароль"
            value={password}
            onChange={setPassword}
            type={showPassword ? 'text' : 'password'}
            placeholder="Введите пароль"
            inputClassName="py-5 text-xl"
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="rounded p-2.5 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sber-dark/30 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <EyeOff size={26} /> : <Eye size={26} />}
              </button>
            }
          />
          {error && <p className="text-lg text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-8 py-5 rounded-2xl text-xl font-semibold bg-sber-dark text-white hover:bg-sber-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <LogIn size={26} />
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

      </div>
    </div>
  );
}
