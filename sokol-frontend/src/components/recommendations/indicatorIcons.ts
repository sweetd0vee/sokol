import { AlertTriangle, Check, Clock, Hourglass } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  RecommendationAdditionalIndicator,
  RecommendationIndicator,
} from '../../types/recommendation';

export type IndicatorIconKey = RecommendationIndicator | RecommendationAdditionalIndicator;

export const INDICATOR_ICONS: Partial<
  Record<IndicatorIconKey, { Icon: LucideIcon; className: string }>
> = {
  'в процессе': { Icon: Clock, className: 'text-yellow-500' },
  'на контроле': { Icon: Hourglass, className: 'text-gray-500' },
  'не решено': { Icon: AlertTriangle, className: 'text-red-500' },
  исполнено: { Icon: Check, className: 'text-[rgb(37,235,103)]' },
  'в срок': { Icon: Check, className: 'text-[rgb(37,235,103)]' },
  'срок нарушен': { Icon: AlertTriangle, className: 'text-red-500' },
};
