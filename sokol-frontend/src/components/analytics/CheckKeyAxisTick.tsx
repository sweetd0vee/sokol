type ShortNameLookup = Map<string, string> | Record<string, string>;

function lookupShortName(names: ShortNameLookup, key: string) {
  return names instanceof Map ? names.get(key) : names[key];
}

export function checkBarTooltipLabel(label: unknown, shortNames: ShortNameLookup) {
  const key = String(label);
  const shortName = lookupShortName(shortNames, key);
  return shortName && shortName !== key ? `${key} — ${shortName}` : key;
}

export function CheckKeyAxisTick({
  x = 0,
  y = 0,
  payload,
  shortNameByKey,
  shortNames,
  orientation = 'bottom',
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string };
  shortNameByKey?: Map<string, string>;
  shortNames?: Record<string, string>;
  orientation?: 'bottom' | 'left' | 'top' | 'right';
}) {
  const names = shortNameByKey ?? shortNames ?? {};
  const key = String(payload?.value ?? '');
  const isLeft = orientation === 'left';
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{checkBarTooltipLabel(key, names)}</title>
      <text
        x={isLeft ? -4 : 0}
        dy={isLeft ? 4 : 14}
        textAnchor={isLeft ? 'end' : 'middle'}
        fill="#64748B"
        fontSize={isLeft ? 12 : 11}
      >
        {key}
      </text>
    </g>
  );
}
