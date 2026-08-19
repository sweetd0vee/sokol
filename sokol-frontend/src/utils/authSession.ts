import { AUTH_STORAGE_KEY, PROFILE_EVENT_NAME, PROFILE_STORAGE_KEY } from '../constants/storage';
import type { User, UserRole } from '../contexts/auth';

const KNOWN_ROLES = new Set<UserRole>(['admin', 'department_head', 'auditor']);
export const ADMIN_ROLES = new Set<UserRole>(['admin', 'department_head']);

export function parseStoredUser(raw: string): User | null {
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
      role,
      accessToken,
    };
  } catch {
    return null;
  }
}

export function readStoredUser(): User | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? parseStoredUser(stored) : null;
  } catch {
    return null;
  }
}

export function writeStoredUser(user: User) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function writeProfileName(fullName: string) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ fullName }));
  window.dispatchEvent(new CustomEvent(PROFILE_EVENT_NAME, { detail: fullName }));
}

export function readAccessToken(): string | null {
  return readStoredUser()?.accessToken ?? null;
}
