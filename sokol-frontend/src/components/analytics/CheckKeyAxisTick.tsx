import { checkBarTooltipLabel } from './checkBarTooltip';

type ShortNameLookup = Map<string, string> | Record<string, string>;

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
  const names: ShortNameLookup = shortNameByKey ?? shortNames ?? {};
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
