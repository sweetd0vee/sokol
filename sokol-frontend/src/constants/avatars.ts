import profileAvatarUrl from '../assets/profile-avatar.svg';
import avatarAmber from '../assets/avatars/avatar-amber.svg';
import avatarSand from '../assets/avatars/avatar-sand.svg';
import avatarSage from '../assets/avatars/avatar-sage.svg';
import avatarAurora from '../assets/avatars/avatar-aurora.svg';
import avatarOcean from '../assets/avatars/avatar-ocean.svg';
import avatarLilac from '../assets/avatars/avatar-lilac.svg';
import avatarGraphite from '../assets/avatars/avatar-graphite.svg';
import avatarBloom from '../assets/avatars/avatar-bloom.svg';
import avatarHoney from '../assets/avatars/avatar-honey.svg';
import avatarPeach from '../assets/avatars/avatar-peach.svg';
import avatarViolet from '../assets/avatars/avatar-violet.svg';
import { AVATAR_STORAGE_KEY } from './storage';

type AvatarPreset = {
  id: string;
  label: string;
  src: string;
};

const DEFAULT_AVATAR_ID = 'default';

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: DEFAULT_AVATAR_ID, label: 'Котик', src: profileAvatarUrl },
  { id: 'amber', label: 'Лисичка', src: avatarAmber },
  { id: 'sand', label: 'Зайчик', src: avatarSand },
  { id: 'sage', label: 'Мишка', src: avatarSage },
  { id: 'aurora', label: 'Панда', src: avatarAurora },
  { id: 'ocean', label: 'Пингвин', src: avatarOcean },
  { id: 'lilac', label: 'Сова', src: avatarLilac },
  { id: 'graphite', label: 'Коала', src: avatarGraphite },
  { id: 'bloom', label: 'Ёжик', src: avatarBloom },
  { id: 'honey', label: 'Корги', src: avatarHoney },
  { id: 'peach', label: 'Красная панда', src: avatarPeach },
  { id: 'violet', label: 'Тигрёнок', src: avatarViolet },
];

const AVATAR_BY_ID = Object.fromEntries(AVATAR_PRESETS.map((preset) => [preset.id, preset]));

function isAvatarPresetId(value: string | null | undefined): value is string {
  return Boolean(value && value in AVATAR_BY_ID);
}

/** Старые data URL от загрузки фото игнорируем — только пресеты. */
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
