import { describe, expect, it } from 'vitest';
import { Packer } from 'docx';
import type { ConstructorWidget } from '../components/analytics/constructor/constructorTypes';
import {
  buildConstructorDashboardDocument,
  constructorDocxGridRows,
  constructorDocxImageBox,
} from './constructorDocxExport';

const PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function widget(
  id: string,
  layout: { x: number; y: number; w: number; h: number },
  title = id,
): ConstructorWidget {
  return {
    instanceId: id,
    kind: 'checks',
    sectionId: id,
    title,
    description: '',
    filterCaption: 'Все',
    size: { w: layout.w, h: layout.h, minW: 1, minH: 1 },
    payload: { chart: 'list', items: [] },
    layout: { ...layout, minW: 1, minH: 1 },
  };
}

describe('constructor DOCX grid', () => {
  it('emits two half-width charts on the first row and continue cells below', () => {
    const rows = constructorDocxGridRows([
      { x: 0, y: 0, w: 6, h: 4 },
      { x: 6, y: 0, w: 6, h: 4 },
    ]);
    expect(rows).toHaveLength(4);
    expect(rows[0]?.map((cell) => cell.kind)).toEqual(['widget', 'widget']);
    expect(rows[0]?.[0]).toMatchObject({ kind: 'widget', w: 6, h: 4, x: 0 });
    expect(rows[0]?.[1]).toMatchObject({ kind: 'widget', w: 6, h: 4, x: 6 });
    expect(rows[1]?.map((cell) => cell.kind)).toEqual(['continue', 'continue']);
    expect(rows[2]?.map((cell) => cell.kind)).toEqual(['continue', 'continue']);
    expect(rows[3]?.map((cell) => cell.kind)).toEqual(['continue', 'continue']);
  });

  it('places a full-width chart on the next board row', () => {
    const rows = constructorDocxGridRows([
      { x: 0, y: 0, w: 4, h: 4 },
      { x: 4, y: 0, w: 4, h: 4 },
      { x: 8, y: 0, w: 4, h: 4 },
      { x: 0, y: 4, w: 8, h: 3 },
      { x: 8, y: 4, w: 4, h: 3 },
    ]);
    expect(rows[0]).toHaveLength(3);
    expect(rows[0]?.every((cell) => cell.kind === 'widget')).toBe(true);
    expect(rows[4]?.map((cell) => cell.kind)).toEqual(['widget', 'widget']);
    expect(rows[4]?.[0]).toMatchObject({ w: 8, h: 3 });
    expect(rows[4]?.[1]).toMatchObject({ w: 4, h: 3 });
  });

  it('sizes a half-width chart to a board cell, not a full-page screenshot', () => {
    const box = constructorDocxImageBox({ w: 6, h: 4 });
    expect(box.width).toBeGreaterThan(300);
    expect(box.width).toBeLessThan(700);
    expect(box.height).toBeGreaterThan(200);
    expect(box.height).toBeLessThan(500);
  });
});

describe('buildConstructorDashboardDocument', () => {
  it('writes a landscape board with one image per widget', async () => {
    const widgets = [
      widget('left', { x: 0, y: 0, w: 6, h: 4 }, 'Типы проверок'),
      widget('right', { x: 6, y: 0, w: 6, h: 4 }, 'Количество проверок'),
    ];
    const doc = buildConstructorDashboardDocument({
      title: 'Отчет (август)',
      meta: [['Графиков на листе', '2']],
      widgets,
      captures: widgets.map((item) => ({
        id: item.instanceId,
        title: item.title,
        description: '',
        dataUrl: PIXEL_PNG,
        width: 640,
        height: 360,
      })),
    });
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});
