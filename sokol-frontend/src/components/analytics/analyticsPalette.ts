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
 * Sequential scale for quantitative charts.
 * Values must move from light to dark so color intensity communicates magnitude.
 */
export const VALUE_BLUE_SCALE = [
  '#93C5FD',
  '#60A5FA',
  '#3B82F6',
  '#0E7490',
  '#075985',
  '#002B55',
] as const;

function hexToRgb(color: string) {
  const hex = color.replace('#', '');
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function channelToHex(value: number) {
  return Math.round(value).toString(16).padStart(2, '0');
}

function interpolateColor(from: string, to: string, ratio: number) {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const mix = (left: number, right: number) => left + (right - left) * ratio;
  return `#${channelToHex(mix(start.red, end.red))}${channelToHex(mix(start.green, end.green))}${channelToHex(mix(start.blue, end.blue))}`;
}

export function getValueBasedColors(
  values: number[],
  scale: readonly string[] = VALUE_BLUE_SCALE,
) {
  if (values.length === 0 || scale.length === 0) {
    return [];
  }
  if (scale.length === 1) {
    return values.map(() => scale[0]);
  }

  const finiteValues = values.filter(Number.isFinite);
  const min = finiteValues.length > 0 ? Math.min(...finiteValues) : 0;
  const max = finiteValues.length > 0 ? Math.max(...finiteValues) : 0;

  if (min === max) {
    const middleColor = scale[Math.floor(scale.length / 2)];
    return values.map(() => middleColor);
  }

  return values.map((value) => {
    const normalized = Number.isFinite(value) ? (value - min) / (max - min) : 0;
    const position = Math.max(0, Math.min(1, normalized)) * (scale.length - 1);
    const startIndex = Math.floor(position);
    const endIndex = Math.min(startIndex + 1, scale.length - 1);
    return interpolateColor(scale[startIndex], scale[endIndex], position - startIndex);
  });
}

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

/** «За период» bars on the recommendations period chart — soft lilac. */
export const RECOMMENDATIONS_PERIOD_BAR_COLOR = '#C4B5FD';
