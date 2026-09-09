import { CHART_VALUE_LABEL_WEIGHT } from './AnalyticsChartPrimitives';

const STACKED_LABEL_MIN_INSIDE_HEIGHT = 14;
const STACKED_LABEL_CHAR_WIDTH = 0.62;
const STACKED_NOTE_FONT_SIZE = 11;
const STACKED_NOTE_PAD_X = 6;
const STACKED_NOTE_PAD_Y = 3;
const STACKED_NOTE_BOX_HEIGHT = STACKED_NOTE_FONT_SIZE + STACKED_NOTE_PAD_Y * 2;
const STACKED_NOTE_ANCHOR_GAP = 16;
const STACKED_TOTAL_FONT_SIZE = 14;
const STACKED_TOTAL_OFFSET = 6;
const STACKED_TOTAL_RESERVE = STACKED_TOTAL_FONT_SIZE + STACKED_TOTAL_OFFSET;

export const STACKED_PERIOD_CHART_TOP_MARGIN = 72;
export const STACKED_PERIOD_CHART_SIDE_MARGIN = 36;
export const STACKED_HORIZONTAL_CHART_RIGHT_MARGIN = 88;
export const HORIZONTAL_BAR_MAX_SIZE = 28;
/** Cap for simple horizontal bars whose labels sit outside the bar. */
export const HORIZONTAL_STRIP_MAX_SIZE = 12;

const STACKED_CALLOUT_BOX_GAP = 4;

type StackedSegmentLabelView = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string | null;
  dataKey?: string | number;
  fill?: string;
  payload?: Record<string, unknown>;
  viewBox?: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
  };
};

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function readLabelValue(value: unknown): number | undefined {
  if (Array.isArray(value)) {
    const start = toFiniteNumber(value[0]) ?? 0;
    const end = toFiniteNumber(value[value.length - 1]);
    if (end === undefined) {
      return undefined;
    }
    return Math.abs(end - start) || end;
  }
  return toFiniteNumber(value);
}

function readLabelGeometry(view: StackedSegmentLabelView) {
  const box = view.viewBox;
  return {
    x: toFiniteNumber(box?.x) ?? toFiniteNumber(view.x),
    y: toFiniteNumber(box?.y) ?? toFiniteNumber(view.y),
    width: toFiniteNumber(box?.width) ?? toFiniteNumber(view.width) ?? 0,
    height: toFiniteNumber(box?.height) ?? toFiniteNumber(view.height) ?? 0,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function readStackValue(
  view: StackedSegmentLabelView,
  key: string,
  stackRow?: unknown,
): number {
  const sources: Array<Record<string, unknown> | undefined> = [
    asRecord(stackRow),
    view.payload,
    view as Record<string, unknown>,
    asRecord(view.payload?.payload),
  ];
  for (const source of sources) {
    if (!source) {
      continue;
    }
    const parsed = toFiniteNumber(source[key]);
    if (parsed !== undefined) {
      return Math.max(0, parsed);
    }
  }
  return 0;
}

function segmentFitsInsideLabel(segmentHeight: number, segmentWidth: number, value: number) {
  if (segmentHeight < STACKED_LABEL_MIN_INSIDE_HEIGHT || value <= 0) {
    return false;
  }
  const roundedStr = String(Math.round(value));
  const fontSizeBase = segmentHeight >= 20 ? 13 : 12;
  const maxFontSizeByWidth =
    segmentWidth > 0 ? Math.floor((segmentWidth - 6) / (roundedStr.length * STACKED_LABEL_CHAR_WIDTH)) : 0;
  const fontSize = Math.max(9, Math.min(fontSizeBase, maxFontSizeByWidth));
  const estimatedTextWidth = roundedStr.length * fontSize * STACKED_LABEL_CHAR_WIDTH;
  return segmentWidth >= estimatedTextWidth + 4 && fontSize >= 9;
}

function estimateTextWidth(text: string, fontSize: number) {
  return text.length * fontSize * STACKED_LABEL_CHAR_WIDTH;
}

function calloutBoxWidth(value: number) {
  return estimateTextWidth(String(Math.round(value)), STACKED_NOTE_FONT_SIZE) + STACKED_NOTE_PAD_X * 2;
}

export function StackedBarSegmentValueLabel({
  stackKeys,
  getColor,
  showStackTotal = false,
  stackRow,
  layout = 'horizontal',
  ...view
}: {
  stackKeys: readonly string[];
  getColor: (key: string) => string;
  showStackTotal?: boolean;
  stackRow?: unknown;
  /** Recharts BarChart layout: `horizontal` = vertical columns, `vertical` = horizontal bars. */
  layout?: 'horizontal' | 'vertical';
  [key: string]: unknown;
}) {
  const labelView = view as StackedSegmentLabelView;
  const { x, y, width: w, height: h } = readLabelGeometry(labelView);
  const key = labelView.dataKey === undefined || labelView.dataKey === null ? '' : String(labelView.dataKey);
  // Recharts 3 LabelList does not forward `payload` to custom content — `value` is the source of truth.
  const numericValue =
    readLabelValue(labelView.value) ?? (key ? readStackValue(labelView, key, stackRow) : undefined);
  const stackValues = stackKeys.map((stackKey) => readStackValue(labelView, stackKey, stackRow));
  const stackTotal = stackValues.reduce((sum, stackValue) => sum + stackValue, 0);
  let topVisibleKey = '';
  for (let index = stackKeys.length - 1; index >= 0; index -= 1) {
    if (stackValues[index] > 0) {
      topVisibleKey = stackKeys[index];
      break;
    }
  }
  const shouldRenderTotal = showStackTotal && key !== '' && key === topVisibleKey && stackTotal > 0;
  if (x === undefined || y === undefined) {
    return null;
  }
  if ((numericValue === undefined || numericValue <= 0) && !shouldRenderTotal) {
    return null;
  }

  const rounded = Math.round(numericValue ?? 0);
  const roundedStr = String(rounded);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const segmentColor = (key ? getColor(key) : undefined) || labelView.fill || '#e5e7eb';
  const stackIndex = Math.max(0, stackKeys.indexOf(key));
  const hasPayloadValues = stackValues.some((stackValue) => stackValue > 0);
  const isHorizontalBar = layout === 'vertical';
  const alongValue = isHorizontalBar ? w : h;
  const pxPerUnit = alongValue > 0 && (numericValue ?? 0) > 0 ? alongValue / (numericValue as number) : 0;
  const valueAfter = hasPayloadValues
    ? stackValues.slice(stackIndex + 1).reduce((sum, stackValue) => sum + stackValue, 0)
    : 0;
  const barTopY = pxPerUnit > 0 ? y - valueAfter * pxPerUnit : y;
  const barRightX = pxPerUnit > 0 ? x + w + valueAfter * pxPerUnit : x + w;
  const canPlaceInside =
    numericValue !== undefined && numericValue > 0 && segmentFitsInsideLabel(h, w, numericValue);
  const totalLabel = shouldRenderTotal ? (
    isHorizontalBar ? (
      <text
        x={barRightX + STACKED_TOTAL_OFFSET}
        y={cy}
        textAnchor="start"
        dominantBaseline="middle"
        fontSize={STACKED_TOTAL_FONT_SIZE}
        fontWeight={CHART_VALUE_LABEL_WEIGHT}
        fill="#111827"
        style={{ pointerEvents: 'none' }}
      >
        {Math.round(stackTotal)}
      </text>
    ) : (
      <text
        x={cx}
        y={barTopY - STACKED_TOTAL_OFFSET - STACKED_TOTAL_FONT_SIZE / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={STACKED_TOTAL_FONT_SIZE}
        fontWeight={CHART_VALUE_LABEL_WEIGHT}
        fill="#111827"
        style={{ pointerEvents: 'none' }}
      >
        {Math.round(stackTotal)}
      </text>
    )
  ) : null;

  if (canPlaceInside) {
    const segmentLabel = (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={h >= 20 ? 13 : 12}
        fontWeight={CHART_VALUE_LABEL_WEIGHT}
        fill="#111827"
        style={{ pointerEvents: 'none' }}
      >
        {roundedStr}
      </text>
    );
    if (!totalLabel) {
      return segmentLabel;
    }
    return (
      <g style={{ pointerEvents: 'none' }}>
        {segmentLabel}
        {totalLabel}
      </g>
    );
  }

  if (numericValue === undefined || numericValue <= 0) {
    return totalLabel;
  }

  const outsideKeys = hasPayloadValues
    ? stackKeys.filter((stackKey, index) => {
        const stackValue = stackValues[index];
        if (stackValue <= 0) {
          return false;
        }
        const segmentAlong = pxPerUnit > 0 ? stackValue * pxPerUnit : stackKey === key ? alongValue : 0;
        return isHorizontalBar
          ? !segmentFitsInsideLabel(h, segmentAlong, stackValue)
          : !segmentFitsInsideLabel(segmentAlong, w, stackValue);
      })
    : stackKeys.filter((stackKey) => stackKey === key);
  const calloutDuplicatesTotal =
    showStackTotal && outsideKeys.length === 1 && Math.round(stackTotal) === rounded;
  if (calloutDuplicatesTotal) {
    return totalLabel;
  }

  const matchedOutsideIndex = outsideKeys.indexOf(key);
  const outsideIndex = hasPayloadValues && matchedOutsideIndex !== -1
    ? matchedOutsideIndex
    : stackIndex;
  const boxWidth = calloutBoxWidth(rounded);
  const halfBox = boxWidth / 2;

  if (isHorizontalBar) {
    const totalReserve = showStackTotal
      ? estimateTextWidth(String(Math.round(stackTotal)), STACKED_TOTAL_FONT_SIZE) + STACKED_TOTAL_OFFSET + 4
      : 0;
    const calloutStartX = barRightX + totalReserve + STACKED_NOTE_ANCHOR_GAP;
    const xOffset = outsideKeys.slice(0, Math.max(0, outsideIndex)).reduce((sum, stackKey) => {
      const stackValue = stackValues[stackKeys.indexOf(stackKey)] ?? 0;
      return sum + calloutBoxWidth(stackValue) + STACKED_CALLOUT_BOX_GAP;
    }, 0);
    const labelCx = calloutStartX + xOffset + halfBox;
    const boxX = labelCx - halfBox;
    const boxY = cy - STACKED_NOTE_BOX_HEIGHT / 2;
    const lineStartX = boxX;

    return (
      <g style={{ pointerEvents: 'none' }}>
        <line
          x1={cx}
          y1={cy}
          x2={lineStartX}
          y2={cy}
          stroke={segmentColor}
          strokeWidth={1.25}
        />
        <rect
          x={boxX}
          y={boxY}
          width={boxWidth}
          height={STACKED_NOTE_BOX_HEIGHT}
          rx={6}
          fill="#ffffff"
          stroke={segmentColor}
          strokeWidth={1.25}
        />
        <text
          x={labelCx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={STACKED_NOTE_FONT_SIZE}
          fontWeight={CHART_VALUE_LABEL_WEIGHT}
          fill="#111827"
        >
          {roundedStr}
        </text>
        {totalLabel}
      </g>
    );
  }

  const outsideCount = Math.max(outsideKeys.length, 1);
  // Keep callouts and stems inside the bar width so narrow periods do not spill sideways.
  const edgePad = Math.min(3, Math.max(0, w * 0.1));
  const spreadLeft = x + edgePad;
  const spreadRight = x + w - edgePad;
  const stemX =
    outsideCount <= 1 || spreadRight <= spreadLeft
      ? cx
      : spreadLeft + ((spreadRight - spreadLeft) * outsideIndex) / (outsideCount - 1);
  const labelCx =
    w >= boxWidth
      ? Math.min(x + w - halfBox, Math.max(x + halfBox, stemX))
      : cx;
  const calloutLift = showStackTotal ? STACKED_TOTAL_RESERVE : 0;
  const noteCenterY = Math.max(
    STACKED_NOTE_BOX_HEIGHT / 2 + 2,
    barTopY - calloutLift - STACKED_NOTE_ANCHOR_GAP - STACKED_NOTE_BOX_HEIGHT / 2,
  );
  const boxX = labelCx - halfBox;
  const boxY = noteCenterY - STACKED_NOTE_BOX_HEIGHT / 2;
  const lineStartY = noteCenterY + STACKED_NOTE_BOX_HEIGHT / 2;

  return (
    <g style={{ pointerEvents: 'none' }}>
      <line
        x1={stemX}
        y1={lineStartY}
        x2={stemX}
        y2={cy}
        stroke={segmentColor}
        strokeWidth={1.25}
      />
      {Math.abs(labelCx - stemX) > 0.5 ? (
        <line
          x1={stemX}
          y1={lineStartY}
          x2={labelCx}
          y2={lineStartY}
          stroke={segmentColor}
          strokeWidth={1.25}
        />
      ) : null}
      <rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={STACKED_NOTE_BOX_HEIGHT}
        rx={6}
        fill="#ffffff"
        stroke={segmentColor}
        strokeWidth={1.25}
      />
      <text
        x={labelCx}
        y={noteCenterY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={STACKED_NOTE_FONT_SIZE}
        fontWeight={CHART_VALUE_LABEL_WEIGHT}
        fill="#111827"
      >
        {roundedStr}
      </text>
      {totalLabel}
    </g>
  );
}
