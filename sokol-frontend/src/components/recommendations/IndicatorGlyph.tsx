import type { IndicatorIconMeta } from './indicatorIcons';
import { INDICATOR_ICON_STROKE_WIDTH } from './indicatorIcons';

export function IndicatorGlyph({
  meta,
  size,
  className,
}: {
  meta: IndicatorIconMeta | undefined;
  size: number;
  className?: string;
}) {
  if (!meta) {
    return null;
  }

  const Icon = meta.Icon;
  const colorClass = [meta.className, className].filter(Boolean).join(' ');

  return (
    <Icon
      size={size}
      className={colorClass}
      aria-hidden
      fill="none"
      strokeWidth={INDICATOR_ICON_STROKE_WIDTH}
    />
  );
}
