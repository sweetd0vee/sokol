import type { ConstructorSizeHint } from './constructorLayout';
import type {
  ConstructorBarPoint,
  ConstructorPayload,
  ConstructorWidgetDraft,
} from './constructorTypes';

export const SIZE = {
  kpi: { w: 12, h: 2, minW: 6, minH: 2 },
  half: { w: 6, h: 4, minW: 3, minH: 3 },
  wide: { w: 8, h: 4, minW: 4, minH: 3 },
  treemap: { w: 8, h: 3, minW: 3, minH: 2 },
  narrow: { w: 4, h: 4, minW: 3, minH: 3 },
  full: { w: 12, h: 4, minW: 6, minH: 3 },
  matrix: { w: 12, h: 8, minW: 6, minH: 6 },
  tallHalf: { w: 6, h: 5, minW: 3, minH: 3 },
} as const satisfies Record<string, ConstructorSizeHint>;

export function draft(
  kind: ConstructorWidgetDraft['kind'],
  sectionId: string,
  title: string,
  filterCaption: string,
  size: ConstructorSizeHint,
  payload: ConstructorPayload,
): ConstructorWidgetDraft {
  return { kind, sectionId, title, description: '', filterCaption, size, payload };
}

export function barPointsFromNamed(items: Array<{ name: string; value: number }>): ConstructorBarPoint[] {
  return items.map((item) => ({ label: item.name, value: item.value }));
}
