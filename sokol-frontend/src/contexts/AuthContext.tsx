import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { loginRequest } from '../api/auth';
import { getErrorMessage, toApiError } from '../api/errors';
import { AUTH_STORAGE_KEY, PROFILE_EVENT_NAME, PROFILE_STORAGE_KEY } from '../constants/storage';
import { AuthContext, type AuthContextValue, type User, type UserRole } from './auth';

interface AuthProviderProps {
  children: ReactNode;
}

const ADMIN_ROLES = new Set<UserRole>(['admin', 'department_head']);
const KNOWN_ROLES = new Set<UserRole>(['admin', 'department_head', 'auditor']);

function parseStoredUser(raw: string): User | null {
  try {
    const parsed = JSON.parse(raw) as Partial<User> & { username?: string };
    const shortName = parsed?.shortName?.trim() || parsed?.username?.trim() || '';
    const accessToken = parsed?.accessToken?.trim() || '';
    const role = parsed?.role && KNOWN_ROLES.has(parsed.role) ? parsed.role : null;
    if (!shortName || !accessToken || !role) {
      return null;
    }
    return {
      shortName,
      displayName: parsed.displayName?.trim() || shortName,
      role: role as UserRole,
      accessToken,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = parseStoredUser(stored);
        if (parsed) {
          setUser(parsed);
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      logout();
    };
    window.addEventListener('sokol:auth-unauthorized', onUnauthorized);
    return () => window.removeEventListener('sokol:auth-unauthorized', onUnauthorized);
  }, [logout]);

  const login = useCallback(async (shortName: string, password: string): Promise<boolean> => {
    if (!shortName.trim() || !password.trim()) {
      return false;
    }

    try {
      const data = await loginRequest(shortName.trim(), password.trim());
      const userData: User = {
        shortName: data.username,
        displayName: data.display_name || data.username,
        role: data.role,
        accessToken: data.access_token,
      };
      setUser(userData);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ fullName: data.username }));
      window.dispatchEvent(new CustomEvent(PROFILE_EVENT_NAME, { detail: data.username }));
      return true;
    } catch (error) {
      const apiError = toApiError(error);
      throw new Error(getErrorMessage(apiError, 'Неверный логин или пароль'));
    }
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user?.accessToken,
    isLoading,
    isAdmin: !!user?.role && ADMIN_ROLES.has(user.role),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
