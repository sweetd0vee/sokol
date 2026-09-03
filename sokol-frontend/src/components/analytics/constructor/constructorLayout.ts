import type { ConstructorWidget, ConstructorWidgetLayout } from './constructorTypes';

export type ConstructorSizeHint = Pick<ConstructorWidgetLayout, 'w' | 'h' | 'minW' | 'minH'>;

const COLS = 12;

function clampSize(size: ConstructorSizeHint): ConstructorSizeHint {
  const width = Math.min(Math.max(size.w, 1), COLS);
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
    if (x > 0 && x + size.w > COLS) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    placed.push({ x, y, ...size });
    x += size.w;
    rowHeight = Math.max(rowHeight, size.h);
    if (x >= COLS) {
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
