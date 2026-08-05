import { AlertTriangle, Check, Clock, Hourglass } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RecommendationIndicator } from '../../types/recommendation';

export const INDICATOR_ICONS: Partial<
  Record<RecommendationIndicator, { Icon: LucideIcon; className: string }>
> = {
  'в процессе': { Icon: Clock, className: 'text-yellow-500' },
  ожидает: { Icon: Hourglass, className: 'text-gray-500' },
  'не решено': { Icon: AlertTriangle, className: 'text-red-500' },
  исполнено: { Icon: Check, className: 'text-[rgb(37,235,103)]' },
};
