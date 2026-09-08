function checkBarTooltipLabel(label: unknown, shortNameByKey: Map<string, string>) {
  const key = String(label);
  const shortName = shortNameByKey.get(key);
  return shortName && shortName !== key ? `${key} — ${shortName}` : key;
}

export function CheckKeyAxisTick({
  x = 0,
  y = 0,
  payload,
  shortNameByKey,
  orientation = 'bottom',
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string };
  shortNameByKey: Map<string, string>;
  orientation?: 'bottom' | 'left' | 'top' | 'right';
}) {
  const key = String(payload?.value ?? '');
  const isLeft = orientation === 'left';
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{checkBarTooltipLabel(key, shortNameByKey)}</title>
      <text
        x={isLeft ? -4 : 0}
        dy={isLeft ? 4 : 14}
        textAnchor={isLeft ? 'end' : 'middle'}
        fill="#64748B"
        fontSize={isLeft ? 11 : 9}
      >
        {key}
      </text>
    </g>
  );
}

export { checkBarTooltipLabel };
