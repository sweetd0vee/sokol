import { createContext } from 'react';
import type { UserRole } from '../api/auth';

export type { UserRole };

export interface User {
  shortName: string;
  displayName?: string;
  role: UserRole;
  accessToken: string;
}

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  login: (shortName: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
