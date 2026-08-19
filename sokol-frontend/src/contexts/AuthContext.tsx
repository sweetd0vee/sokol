import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { loginRequest } from '../api/auth';
import { getErrorMessage, toApiError } from '../api/errors';
import { AUTH_UNAUTHORIZED_EVENT } from '../constants/paths';
import { AUTH_STORAGE_KEY } from '../constants/storage';
import { AuthContext, type AuthContextValue, type User } from './auth';
import {
  ADMIN_ROLES,
  clearStoredAuth,
  readStoredUser,
  writeProfileName,
  writeStoredUser,
} from '../utils/authSession';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const parsed = readStoredUser();
      if (parsed) {
        setUser(parsed);
      } else if (localStorage.getItem(AUTH_STORAGE_KEY)) {
        clearStoredAuth();
      }
    } catch {
      clearStoredAuth();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    clearStoredAuth();
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      logout();
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
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
      writeStoredUser(userData);
      writeProfileName(data.username);
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
