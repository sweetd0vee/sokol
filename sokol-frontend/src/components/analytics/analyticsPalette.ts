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

/**
 * Sequential scale for quantitative charts.
 * Values move from light ice-blue to dark navy so color intensity communicates magnitude.
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
 * Same ramp as `VALUE_BLUE_SCALE` without the deepest navy —
 * used on Recommendations where #002B55 felt too accented.
 */
export const VALUE_BLUE_SCALE_SOFT = [
  '#93C5FD',
  '#60A5FA',
  '#3B82F6',
  '#0E7490',
  '#075985',
] as const;

/**
 * Softer mid/light stops for the Recommendations department treemap
 * so mid-range tiles stay muted instead of electric sky.
 */
export const RECOMMENDATIONS_DEPARTMENT_MAP_SCALE = [
  '#B7D0EF', // muted ice — smallest
  '#8BB0D6', // powder azure
  '#5A8FBF', // steel blue
  '#0E7490',
  '#075985',
] as const;

/**
 * Emerald + blue treemap palette.
 * Stops alternate light blue ↔ deep teal so neighbouring blocks stay distinct.
 * The last color is emerald #0E7490 and is reserved for the largest value.
 */
export const VALUE_EMERALD_SCALE = [
  '#60A5FA', // soft blue
  '#075985', // deep teal
  '#93C5FD', // ice blue
  '#2563EB', // royal blue
  '#7DD3FC', // light cyan
  '#0369A1', // strong cyan-blue
  '#38BDF8', // sky
  '#1E40AF', // indigo
  '#BAE6FD', // pale ice
  '#0E7490', // emerald — largest
] as const;

/**
 * Sequential teal → azure scale for department / auditor treemaps.
 * The largest value stays signature teal #0E7490; lighter stops shift hue
 * toward sky blue so neighbouring blocks stay distinct instead of washing out.
 */
export const VALUE_TEAL_SCALE = [
  '#CBD8EC', // ice blue — smallest
  '#9CBADE', // powder azure
  '#6AA3D2', // steel sky
  '#3792C3', // cerulean
  '#1D81A5', // teal-blue
  '#0E7490', // signature teal — largest
] as const;

/**
 * Twilight indigo scale for the DVA analytics tab.
 * Light stop sits between Checks periwinkle and Monitoring dusty-lilac;
 * values deepen to signature indigo #312E81 so the page has its own
 * identity without leaving the family.
 */
export const DVA_VALUE_SCALE = [
  '#C8B8E8', // dusty iris — smallest
  '#AA9CD3',
  '#8C81BF',
  '#6D65AA',
  '#4F4A96',
  '#312E81', // signature indigo — largest
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

/**
 * Sequential lilac → teal scale for Monitoring donut / circle charts.
 * Small values map to pale lilac rgb(218, 170, 209); large values map to deep teal rgb(14, 116, 144).
 */
export const MONITORING_VALUE_SCALE = [
  '#DAAAD1', // pale lilac — smallest
  '#B19FC4', // dusty orchid
  '#8894B7', // muted periwinkle
  '#6089AA', // steel teal
  '#377F9D', // mid teal
  '#0E7490', // deep teal — largest
] as const;

/**
 * Semantic colors for Monitoring status circles.
 * Teal and dusty lilac stay as-is; in-progress is warm butter yellow #FBEB8D
 * (same swatch as recommendation “в процессе” / materiality “средний”);
 * on-control is light grey rgb(219, 219, 219).
 */
export const MONITORING_STATUS_COLORS = {
  completed: '#0E7490',
  in_progress: '#FBEB8D',
  on_control: '#DBDBDB',
  unresolved: '#DAAAD1',
} as const;

/**
 * DVA auditor-checks treemap: same teal ramp as `VALUE_TEAL_SCALE`,
 * but the lightest stop matches «На контроле» grey so the smallest
 * headcounts stay muted instead of pale blue.
 */
export const DVA_AUDITOR_CHECKS_SCALE = [
  MONITORING_STATUS_COLORS.on_control, // #DBDBDB — smallest
  '#9CBADE',
  '#6AA3D2',
  '#3792C3',
  '#1D81A5',
  '#0E7490', // signature teal — largest
] as const;

/**
 * Materiality donut / stacked bars / matrix circles on Recommendations —
 * same tones as Monitoring status circles.
 */
export const RECOMMENDATIONS_MATERIALITY_CHART_COLORS = {
  низкий: MONITORING_STATUS_COLORS.completed,
  средний: MONITORING_STATUS_COLORS.in_progress,
  высокий: MONITORING_STATUS_COLORS.unresolved,
} as const;

export function getMaterialityChartColor(
  value: keyof typeof RECOMMENDATIONS_MATERIALITY_CHART_COLORS,
) {
  return RECOMMENDATIONS_MATERIALITY_CHART_COLORS[value];
}

/**
 * Additional-status donut uses the same shades as the Statuses chart:
 * on time → teal, deadline violated → dusty lilac, on control → grey.
 */
export const MONITORING_ADDITIONAL_STATUS_COLORS = {
  on_time: MONITORING_STATUS_COLORS.completed,
  deadline_violated: MONITORING_STATUS_COLORS.unresolved,
  on_control: MONITORING_STATUS_COLORS.on_control,
  in_progress: MONITORING_STATUS_COLORS.in_progress,
} as const;

/**
 * Sequential grey → emerald scale for Monitoring bar charts
 * (deadline extensions, completed during audit).
 * Small values reuse «На контроле» grey; large values peak at emerald #0E7490.
 */
export const MONITORING_BAR_BLUE_SCALE = [
  MONITORING_STATUS_COLORS.on_control, // #DBDBDB — smallest
  '#B2C6CC',
  '#89B2BD',
  '#609DAE',
  '#37889F',
  '#0E7490', // emerald — largest
] as const;

export function lastScaleColor(scale: readonly string[], fallback = '#e5e7eb') {
  return scale[scale.length - 1] ?? fallback;
}

function hexToRgb(color: string) {
  const hex = color.replace('#', '');
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  };
}

export function colorWithAlpha(hex: string, alpha: number) {
  const { red, green, blue } = hexToRgb(hex);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/**
 * Transparent KPI chip styles derived from a chart swatch.
 * Light yellow / pink / grey fills stay a bit stronger so they remain visible;
 * saturated emerald uses a thinner wash.
 */
export function kpiAccentStyle(hex: string): {
  backgroundColor: string;
  borderColor: string;
  color: string;
} {
  const { red, green, blue } = hexToRgb(hex);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  const fillAlpha = luminance > 0.7 ? 0.28 : 0.1;
  const borderAlpha = luminance > 0.7 ? 0.48 : 0.26;
  return {
    backgroundColor: colorWithAlpha(hex, fillAlpha),
    borderColor: colorWithAlpha(hex, borderAlpha),
    color: luminance > 0.55 ? interpolateColor(hex, '#0F172A', 0.55) : hex,
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

/**
 * Maps numeric values onto a sequential scale.
 * Zero and other finite values participate in min/max, so a 0 can stretch the ramp.
 * Used by `colorByValue` on donut/treemap charts.
 */
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
 * Maps each distinct numeric value onto a sequential scale.
 * Equal values share a color; larger values are darker. The highest unique
 * value always gets the last scale color.
 */
export function getUniqueValueColors(
  values: number[],
  scale: readonly string[] = VALUE_TEAL_SCALE,
) {
  if (values.length === 0 || scale.length === 0) {
    return [];
  }
  if (scale.length === 1) {
    return values.map(() => scale[0]);
  }

  const unique = [...new Set(values.filter(Number.isFinite))].sort((left, right) => left - right);
  if (unique.length === 0) {
    return values.map(() => scale[0] as string);
  }
  if (unique.length === 1) {
    const peak = scale[scale.length - 1] as string;
    return values.map(() => peak);
  }

  const colorByValue = new Map<number, string>();
  unique.forEach((value, index) => {
    const position = (index / (unique.length - 1)) * (scale.length - 1);
    const startIndex = Math.floor(position);
    const endIndex = Math.min(startIndex + 1, scale.length - 1);
    colorByValue.set(
      value,
      interpolateColor(scale[startIndex] as string, scale[endIndex] as string, position - startIndex),
    );
  });

  const fallback = scale[0] as string;
  return values.map((value) => colorByValue.get(value) ?? fallback);
}

/**
 * Assigns distinct palette colors by value rank.
 * Close values still get different stops, so treemap neighbours do not melt together.
 * The highest value always gets the last scale color.
 */
export function getRankBasedColors(
  values: number[],
  scale: readonly string[] = VALUE_EMERALD_SCALE,
) {
  if (values.length === 0 || scale.length === 0) {
    return [];
  }
  if (scale.length === 1) {
    return values.map(() => scale[0]);
  }

  const ranked = values
    .map((value, index) => ({
      index,
      value: Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY,
    }))
    .sort((left, right) => right.value - left.value || left.index - right.index);

  const peak = scale[scale.length - 1];
  const rest = scale.slice(0, -1);
  const colors = new Array<string>(values.length);

  ranked.forEach((item, rank) => {
    colors[item.index] = rank === 0 ? peak : rest[(rank - 1) % rest.length];
  });

  return colors;
}

/**
 * Assigns sequential colors onto chart items.
 * Non-positive values are ignored when placing the ramp, so visible slices still reach both endpoints.
 */
export function applyValueBasedColors<T extends { value: number }>(
  items: T[],
  scale: readonly string[] = MONITORING_VALUE_SCALE,
): Array<T & { color: string }> {
  const colors = getValueBasedColors(
    items.map((item) => (item.value > 0 ? item.value : Number.NaN)),
    scale,
  );
  const fallback = scale[0] ?? '#e5e7eb';
  return items.map((item, index) => ({
    ...item,
    color: colors[index] ?? fallback,
  }));
}
