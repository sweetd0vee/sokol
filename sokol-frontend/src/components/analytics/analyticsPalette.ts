export const PALETTE = [
  '#003366',
  '#2563EB',
  '#6699FF',
  '#22C55E',
  '#EAB308',
  '#EF4444',
  '#A855F7',
  '#06B6D4',
  '#F97316',
  '#EC4899',
  '#14B8A6',
  '#8B5CF6',
];

/**
 * Blue / cyan / indigo scale for the Checks analytics tab.
 * Ordered to alternate dark ↔ light ↔ mid so neighbouring segments stay distinct.
 */
export const CHECKS_PALETTE = [
  '#002B55', // deep navy
  '#60A5FA', // soft blue
  '#0E7490', // teal-cyan
  '#BFDBFE', // ice
  '#1E3A8A', // indigo
  '#38BDF8', // sky
  '#004E89', // mid navy
  '#93C5FD', // pale sky
  '#1D4ED8', // royal
  '#67E8F9', // bright cyan
  '#075985', // deep cyan
  '#3B82F6', // bright blue
  '#0369A1', // strong cyan-blue
  '#BAE6FD', // light ice
  '#2563EB', // classic blue
  '#7DD3FC', // light cyan
  '#0C4A6E', // ink cyan
  '#A5B4FC', // periwinkle
];

/**
 * Violet / lilac scale for the Recommendations analytics tab.
 * Ordered to alternate dark ↔ light ↔ mid so neighbouring segments stay distinct.
 */
export const RECOMMENDATIONS_PALETTE = [
  '#4C1D95', // deep violet
  '#C4B5FD', // soft lilac
  '#7C3AED', // vivid violet
  '#EDE9FE', // pale lilac
  '#5B21B6', // purple
  '#A78BFA', // light violet
  '#6D28D9', // mid violet
  '#DDD6FE', // lavender
  '#8B5CF6', // bright violet
  '#F5F3FF', // mist lilac
  '#4338CA', // indigo-violet
  '#D8B4FE', // orchid
  '#2E1065', // ink purple
  '#B794F4', // soft purple
  '#6366F1', // indigo
  '#E9D5FF', // light orchid
];

/** Semantic tones for recommendation statuses — aligned with status badges in Recommendations tab. */
export const RECOMMENDATIONS_STATUS_COLORS = {
  completed: '#22C55E',
  unresolved: '#EF4444',
  on_control: '#64748B',
  in_progress: '#F59E0B',
} as const;

export const RECOMMENDATIONS_MATERIALITY_COLORS = {
  низкий: '#A7F7C2',
  средний: '#FBEB8D',
  высокий: '#FF4347',
} as const;

export const RECOMMENDATIONS_ADDITIONAL_STATUS_COLORS = {
  on_time: '#C4B5FD',
  deadline_violated: '#5B21B6',
  on_control: '#8B5CF6',
} as const;

export const RECOMMENDATIONS_INDICATOR_COLORS = {
  'не указан': '#E9D5FF',
  'в процессе': '#C4B5FD',
  ожидает: '#A78BFA',
  'не решено': '#7C3AED',
  исполнено: '#5B21B6',
} as const;

/** «Исполнено» status mint — matches getRecommendationStatusFieldStyle('completed'). */
export const RECOMMENDATIONS_COMPLETED_MINT = '#DCFCE7';

/** Cumulative «Всего» line — same hue family, dark enough to read on white. */
export const RECOMMENDATIONS_CUMULATIVE_LINE_COLOR = '#6BBF8E';
