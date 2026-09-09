type ShortNameLookup = Map<string, string> | Record<string, string>;

function lookupShortName(names: ShortNameLookup, key: string) {
  return names instanceof Map ? names.get(key) : names[key];
}

export function checkBarTooltipLabel(label: unknown, shortNames: ShortNameLookup) {
  const key = String(label);
  const shortName = lookupShortName(shortNames, key);
  return shortName && shortName !== key ? `${key} — ${shortName}` : key;
}
