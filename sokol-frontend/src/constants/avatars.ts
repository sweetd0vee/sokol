import { AVATAR_STORAGE_KEY } from './storage';

type AvatarPreset = {
  id: string;
  label: string;
  src: string;
};

const DEFAULT_AVATAR_ID = 'portrait';

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: DEFAULT_AVATAR_ID, label: 'Портрет', src: '/sokol-avatar.png' },
  { id: 'orbit', label: 'Виток', src: '/sokol-avatar-orbit.png' },
  { id: 'plume', label: 'Шлейф', src: '/sokol-avatar-plume.png' },
  { id: 'perch', label: 'Стойка', src: '/sokol-avatar-perch.png' },
];

const AVATAR_BY_ID = Object.fromEntries(AVATAR_PRESETS.map((preset) => [preset.id, preset]));

function isAvatarPresetId(value: string | null | undefined): value is string {
  return Boolean(value && value in AVATAR_BY_ID);
}

/** Старые data URL и пресеты Jira игнорируем — только текущие варианты. */
export function readStoredAvatarId(): string {
  const stored = localStorage.getItem(AVATAR_STORAGE_KEY);
  return isAvatarPresetId(stored) ? stored : DEFAULT_AVATAR_ID;
}

export function resolveAvatarSrc(avatarId: string | null | undefined): string {
  if (isAvatarPresetId(avatarId)) {
    return AVATAR_BY_ID[avatarId].src;
  }
  return AVATAR_BY_ID[DEFAULT_AVATAR_ID].src;
}
