import type { ConstructorPayload, ConstructorWidget, ConstructorWidgetLayout } from './constructorTypes';

export type ConstructorSizeHint = Pick<ConstructorWidgetLayout, 'w' | 'h' | 'minW' | 'minH'>;

export const CONSTRUCTOR_GRID_COLS = 12;
export const CONSTRUCTOR_GRID_MARGIN = 10;
export const CONSTRUCTOR_ROW_HEIGHT = 76;

const MATRIX_CHARTS: ReadonlySet<ConstructorPayload['chart']> = new Set([
  'effectiveness-matrix',
  'materiality-matrix',
  'status-matrix',
  'auditor-documents-matrix',
  'check-lifecycle',
]);

export function isConstructorMatrixChart(chart: ConstructorPayload['chart']): boolean {
  return MATRIX_CHARTS.has(chart);
}

/** Convert a content height in pixels to react-grid-layout row units. */
export function pixelHeightToGridRows(px: number, minH = 1): number {
  return Math.max(
    minH,
    Math.ceil((px + CONSTRUCTOR_GRID_MARGIN) / (CONSTRUCTOR_ROW_HEIGHT + CONSTRUCTOR_GRID_MARGIN)),
  );
}

function clampSize(size: ConstructorSizeHint): ConstructorSizeHint {
  const width = Math.min(Math.max(size.w, 1), CONSTRUCTOR_GRID_COLS);
  const height = Math.max(size.h, 1);
  return {
    w: width,
    h: height,
    minW: Math.min(Math.max(size.minW, 1), width),
    minH: Math.max(size.minH, 1),
  };
}

/** Place newly added widgets under the current board, wrapping at 12 columns. */
export function packNewLayouts(
  existing: Array<Pick<ConstructorWidgetLayout, 'x' | 'y' | 'w' | 'h'>>,
  sizes: ConstructorSizeHint[],
): ConstructorWidgetLayout[] {
  const maxY =
    existing.length === 0 ? 0 : Math.max(...existing.map((item) => item.y + item.h));
  const placed: ConstructorWidgetLayout[] = [];
  let x = 0;
  let y = maxY;
  let rowHeight = 0;

  for (const rawSize of sizes) {
    const size = clampSize(rawSize);
    if (x > 0 && x + size.w > CONSTRUCTOR_GRID_COLS) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    placed.push({ x, y, ...size });
    x += size.w;
    rowHeight = Math.max(rowHeight, size.h);
    if (x >= CONSTRUCTOR_GRID_COLS) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
  }

  return placed;
}

export function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex
    || fromIndex < 0
    || toIndex < 0
    || fromIndex >= items.length
    || toIndex >= items.length
  ) {
    return items;
  }
  const next = items.slice();
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) {
    return items;
  }
  next.splice(toIndex, 0, item);
  return next;
}

/** Change list order only; keep each widget's board layout as-is. */
export function reorderConstructorWidgets(
  widgets: ConstructorWidget[],
  fromIndex: number,
  toIndex: number,
): ConstructorWidget[] {
  return moveArrayItem(widgets, fromIndex, toIndex);
}

export function createConstructorInstanceId(kind: string, sectionId: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${kind}-${sectionId}-${random}`;
}
