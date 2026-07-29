export const SETTINGS_LIST_OPTIONS = [
  { value: 'auditors' as const, label: 'Аудиторы' },
  { value: 'auditTypes' as const, label: 'Виды аудита' },
  { value: 'ratings' as const, label: 'Оценки эффективности' },
];

export type SettingsListKey = (typeof SETTINGS_LIST_OPTIONS)[number]['value'];

export type DeleteCandidate = {
  entity: SettingsListKey;
  key: string;
  id?: string | number;
};
