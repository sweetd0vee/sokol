/** react-grid-layout column count for analytics constructor boards. */
export const CONSTRUCTOR_GRID_COLS = 12;

export type ConstructorGridRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function clampConstructorGridRect(layout: ConstructorGridRect): ConstructorGridRect {
  const x = Math.max(0, Math.min(Math.floor(layout.x), CONSTRUCTOR_GRID_COLS - 1));
  const w = Math.max(1, Math.min(Math.floor(layout.w), CONSTRUCTOR_GRID_COLS - x));
  const y = Math.max(0, Math.floor(layout.y));
  const h = Math.max(1, Math.floor(layout.h));
  return { x, y, w, h };
}
