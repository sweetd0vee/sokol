import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { AUTH_STORAGE_KEY, LAST_LOGIN_KEY } from '../constants/storage';
import { AuthContext, type AuthContextValue, type User } from './auth';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<User> & { username?: string };
        const shortName = parsed?.shortName?.trim() || parsed?.username?.trim() || '';
        if (shortName) {
          setUser({
            shortName,
            displayName: parsed.displayName?.trim() || shortName,
          });
        }
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (shortName: string, password: string): Promise<boolean> => {
    if (!shortName.trim() || !password.trim()) {return false;}

    // Простая авторизация — позже будет заменена на Keycloak
    const userData: User = {
      shortName: shortName.trim(),
      displayName: shortName.trim(),
    };
    setUser(userData);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
    localStorage.setItem(LAST_LOGIN_KEY, new Date().toISOString());
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
