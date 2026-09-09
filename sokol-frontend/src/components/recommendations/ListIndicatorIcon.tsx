import { IndicatorGlyph } from './IndicatorGlyph';
import {
  INDICATOR_ICONS,
  type IndicatorIconKey,
  type IndicatorIconMeta,
} from './indicatorIcons';

export function ListIndicatorIcon({
  value,
  label,
  icons = INDICATOR_ICONS,
}: {
  value: IndicatorIconKey | undefined;
  label: string;
  icons?: Partial<Record<IndicatorIconKey, IndicatorIconMeta>>;
}) {
  const meta = value ? icons[value] : undefined;
  if (!meta) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <span className="inline-flex items-center justify-center" title={label}>
      <IndicatorGlyph meta={meta} size={18} />
    </span>
  );
}
