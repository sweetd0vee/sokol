import type { IndicatorIconMeta } from './indicatorIcons';
import { indicatorIconRenderProps } from './indicatorIcons';

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
  const fillRatio = meta.filled ? (meta.fillRatio ?? 1) : 0;

  if (meta.filled && fillRatio < 1) {
    const clipTopPercent = ((1 - fillRatio) * 100).toFixed(2);
    return (
      <span
        className={['relative inline-flex shrink-0', colorClass].filter(Boolean).join(' ')}
        style={{ width: size, height: size }}
      >
        <Icon
          size={size}
          className="absolute inset-0"
          fill="currentColor"
          stroke="none"
          aria-hidden
          style={{ clipPath: `inset(${clipTopPercent}% 0 0 0)` }}
        />
        <Icon size={size} className="absolute inset-0" fill="none" strokeWidth={2} aria-hidden />
      </span>
    );
  }

  return <Icon size={size} className={colorClass} aria-hidden {...indicatorIconRenderProps(meta)} />;
}
