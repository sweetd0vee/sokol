import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { PROFILE_EVENT_NAME, PROFILE_STORAGE_KEY } from '../constants/storage';

function readProfileFullName() {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!stored) {return '';}
    const parsed = JSON.parse(stored) as { fullName?: string };
    return parsed?.fullName?.trim() ?? '';
  } catch {
    return '';
  }
}

export function useCurrentUserName() {
  const { user } = useAuth();
  const [profileFullName, setProfileFullName] = useState(() => readProfileFullName());

  useEffect(() => {
    const refreshName = () => {
      setProfileFullName(readProfileFullName());
    };

    const handleProfileChanged = () => {
      refreshName();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === PROFILE_STORAGE_KEY) {
        refreshName();
      }
    };

    window.addEventListener(PROFILE_EVENT_NAME, handleProfileChanged);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(PROFILE_EVENT_NAME, handleProfileChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return useMemo(() => {
    if (profileFullName) {return profileFullName;}
    return user?.displayName?.trim() || user?.shortName?.trim() || '';
  }, [profileFullName, user?.displayName, user?.shortName]);
}
