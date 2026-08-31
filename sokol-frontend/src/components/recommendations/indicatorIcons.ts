import { AlertTriangle, Check, Clock, Hourglass, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  RecommendationAdditionalIndicator,
  RecommendationIndicator,
} from '../../types/recommendation';

export type IndicatorIconKey = RecommendationIndicator | RecommendationAdditionalIndicator;

export type IndicatorIconMeta = {
  Icon: LucideIcon;
  className: string;
  filled?: boolean;
};

export const INDICATOR_ICONS: Partial<Record<IndicatorIconKey, IndicatorIconMeta>> = {
  'в процессе': { Icon: Clock, className: 'text-yellow-500' },
  'на контроле': { Icon: Hourglass, className: 'text-gray-500' },
  'не решено': { Icon: AlertTriangle, className: 'text-red-500' },
  исполнено: { Icon: Check, className: 'text-[rgb(37,235,103)]' },
  'исполнено в ходе аудита': { Icon: Star, className: 'text-[#003366]', filled: true },
  'в срок': { Icon: Check, className: 'text-[rgb(37,235,103)]' },
  'срок нарушен': { Icon: AlertTriangle, className: 'text-red-500' },
};

export function indicatorIconRenderProps(meta: IndicatorIconMeta | undefined) {
  if (meta?.filled) {
    return { strokeWidth: 1.75, fill: 'currentColor' as const };
  }
  return { strokeWidth: 2.25 };
}
