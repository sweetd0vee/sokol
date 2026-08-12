import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../ui/Input';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { isValidFullNameShort, normalizeFullNameShort } from '../../utils/fullName';

const SIMPLE_LOGINS = new Set(['admin', 'auditor']);

function normalizeLogin(value: string): string {
  const trimmed = value.trim();
  if (SIMPLE_LOGINS.has(trimmed.toLowerCase())) {
    return trimmed.toLowerCase();
  }
  return normalizeFullNameShort(trimmed);
}

function isValidLogin(value: string): boolean {
  return SIMPLE_LOGINS.has(value.toLowerCase()) || isValidFullNameShort(value);
}

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
      const normalizedLogin = normalizeLogin(fullName);
      if (!isValidLogin(normalizedLogin)) {
        setError('Введите логин admin / auditor или Фамилию И.О., например: Иванов И.О.');
        return;
      }

      const ok = await login(normalizedLogin, password.trim());
      if (!ok) {
        setError('Введите логин и пароль');
        return;
      }
      navigate('/checks', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="absolute left-8 top-6 text-2xl font-semibold text-sber-dark">СберБанк</div>
      <div className="w-full max-w-4xl rounded-[32px] border border-gray-200 bg-white p-16 shadow-lg">
        <div className="text-center mb-12">
          <h1 className="mt-4 text-6xl font text-sber-dark">SOKOL</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <Input
            label="Логин"
            value={fullName}
            onChange={setFullName}
            onBlur={() => setFullName((prev) => normalizeLogin(prev))}
            placeholder="admin или Фамилия И.О."
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
                className="rounded p-2.5 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sber-dark/30"
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <EyeOff size={26} /> : <Eye size={26} />}
              </button>
            }
          />
          {error && <p className="text-lg text-red-600">{error}</p>}
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
