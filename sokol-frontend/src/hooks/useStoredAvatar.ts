import { useEffect, useState } from 'react';
import { readStoredAvatarId } from '../constants/avatars';
import { AVATAR_EVENT_NAME } from '../constants/storage';

export function useStoredAvatar() {
  const [avatarId, setAvatarId] = useState(() => readStoredAvatarId());
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    const handleAvatarChanged = (event: Event) => {
      const custom = event as CustomEvent<string>;
      if (custom.detail) {
        setAvatarId(custom.detail);
        setAvatarFailed(false);
      }
    };

    window.addEventListener(AVATAR_EVENT_NAME, handleAvatarChanged);
    return () => window.removeEventListener(AVATAR_EVENT_NAME, handleAvatarChanged);
  }, []);

  return {
    avatarId,
    avatarFailed,
    setAvatarFailed,
  };
}
