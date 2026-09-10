/** Shared Recharts typography for analytics dashboards. */
export const CHART_AXIS_TICK = { fontSize: 15 } as const;
export const CHART_CATEGORY_AXIS_TICK = { fontSize: 14 } as const;
export const CHART_LEGEND_STYLE = { fontSize: 15, fontWeight: 400, color: '#000000' } as const;
export const CHART_VALUE_LABEL_SIZE = 14;
/** Numeric value / percent labels on chart marks — not bold. */
export const CHART_VALUE_LABEL_WEIGHT = 400;
/** Percent labels on donut rings and status circles — screen pixels. */
export const CHART_SLICE_PERCENT_FONT_SIZE = 15;
export const CHART_TOOLTIP_STYLE = {
  fontSize: 14,
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
} as const;
