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

/**
 * Sequential grey scale for the Recommendations analytics charts.
 * Values move from light to dark so bar/treemap intensity communicates magnitude.
 */
export const VALUE_GRAY_SCALE = [
  '#F3F4F6', // very light
  '#E5E7EB',
  '#D1D5DB',
  '#BFC6D0',
  '#9CA3AF',
  '#4B5563', // dark grey (still readable with contrast-aware labels)
] as const;

// Backward-compat alias (older code used the violet name).
export const VALUE_VIOLET_SCALE = VALUE_GRAY_SCALE;

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
 * Greyscale palette for Recommendations treemaps / discrete colored blocks.
 * Ordered to alternate dark ↔ light ↔ mid so neighbouring segments stay distinct.
 */
export const RECOMMENDATIONS_PALETTE = [
  '#0F172A', // deep ink grey
  '#E5E7EB', // soft grey
  '#6B7280', // vivid mid-grey
  '#F3F4F6', // pale grey
  '#374151', // dark slate
  '#CBD5E1', // light slate
  '#64748B', // mid slate
  '#D1D5DB', // light grey
  '#94A3B8', // bright slate
  '#F8FAFC', // mist
  '#334155', // indigo-slate
  '#BFC7D0', // orchid-grey
  '#1F2937', // ink slate
  '#AEB7C2', // soft grey
  '#5B6776', // muted slate
  '#E2E8F0', // light slate
];
