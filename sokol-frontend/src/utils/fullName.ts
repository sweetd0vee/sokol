const FULL_NAME_SHORT_REGEX = /^[A-Za-zА-Яа-яЁё-]+ [A-ZА-ЯЁ]\.[A-ZА-ЯЁ]\.$/;

export function normalizeFullNameShort(value: string): string {
  const compact = value.trim().replace(/\s+/g, ' ');
  const match = compact.match(/^([A-Za-zА-Яа-яЁё-]+)\s+([A-Za-zА-Яа-яЁё])\.?\s*([A-Za-zА-Яа-яЁё])\.?$/);
  if (!match) {
    return compact;
  }
  const [, lastName, firstInitial, middleInitial] = match;
  return `${lastName} ${firstInitial.toUpperCase()}.${middleInitial.toUpperCase()}.`;
}

export function isValidFullNameShort(value: string): boolean {
  return FULL_NAME_SHORT_REGEX.test(value);
}
