import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Packer } from 'docx';
import JSZip from 'jszip';
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

  it('sizes a half-width chart to a wide card, not a tall thumbnail', () => {
    const box = constructorDocxImageBox({ w: 6, h: 4 });
    expect(box.width).toBeGreaterThan(450);
    expect(box.width).toBeLessThan(650);
    expect(box.height).toBeGreaterThan(200);
    expect(box.height).toBeLessThan(320);
    expect(box.width / box.height).toBeGreaterThan(1.7);
  });
});

/** Span sums of the 12-column board, ignoring nested card tables. */
function boardRowSpans(xml: string): number[] {
  const marker = '<w:tblGrid>';
  let from = 0;
  while (from < xml.length) {
    const gridAt = xml.indexOf(marker, from);
    if (gridAt < 0) {
      break;
    }
    const gridEnd = xml.indexOf('</w:tblGrid>', gridAt);
    const cols = (xml.slice(gridAt, gridEnd).match(/<w:gridCol\b/g) ?? []).length;
    if (cols !== 12) {
      from = gridEnd + 1;
      continue;
    }
    const tblStart = xml.lastIndexOf('<w:tbl>', gridAt);
    return directRowSpans(xml, tblStart);
  }
  throw new Error('board table not found');
}

function directRowSpans(xml: string, tblStart: number): number[] {
  let depth = 0;
  let index = tblStart;
  let inRow = false;
  let rowSum = 0;
  const sums: number[] = [];
  while (index < xml.length) {
    if (xml.startsWith('<w:tbl>', index) || xml.startsWith('<w:tbl ', index)) {
      depth += 1;
      index += 6;
      continue;
    }
    if (xml.startsWith('</w:tbl>', index)) {
      depth -= 1;
      if (depth === 0) {
        break;
      }
      index += 8;
      continue;
    }
    if (depth === 1 && (xml.startsWith('<w:tr>', index) || xml.startsWith('<w:tr ', index))) {
      inRow = true;
      rowSum = 0;
      index += 5;
      continue;
    }
    if (inRow && depth === 1 && xml.startsWith('</w:tr>', index)) {
      sums.push(rowSum);
      inRow = false;
      index += 7;
      continue;
    }
    if (inRow && depth === 1 && (xml.startsWith('<w:tc>', index) || xml.startsWith('<w:tc ', index))) {
      const propsEnd = xml.indexOf('</w:tcPr>', index);
      const head = xml.slice(index, propsEnd === -1 ? index + 400 : propsEnd);
      const span = head.match(/<w:gridSpan[^>]*w:val="(\d+)"/);
      rowSum += span ? Number(span[1]) : 1;
      index += 5;
      continue;
    }
    index += 1;
  }
  return sums;
}

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
    const xml = await JSZip.loadAsync(buffer).then((zip) => zip.file('word/document.xml')?.async('string'));
    expect(xml).toBeTruthy();
    const documentXml = xml ?? '';
    expect(boardRowSpans(documentXml)).toEqual([12, 12, 12, 12]);
    expect(documentXml).not.toContain('Типы проверок');
    expect(documentXml).toContain('Графиков на листе');
    expect(documentXml).toContain('w:color="E6EDF4"');
    expect(documentXml).toContain('w:orient="landscape"');
    expect(documentXml).toContain('w:w="16838"');
    expect(documentXml).toContain('w:h="11906"');
  });

  it('keeps a gapped row on the 12-column grid', async () => {
    const widgets = [
      widget('left', { x: 0, y: 0, w: 5, h: 2 }, 'Слева'),
      widget('right', { x: 7, y: 0, w: 5, h: 2 }, 'Справа'),
    ];
    const doc = buildConstructorDashboardDocument({
      title: 'Отчет',
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
    const xml = await JSZip.loadAsync(buffer).then((zip) => zip.file('word/document.xml')?.async('string'));
    expect(boardRowSpans(xml ?? '')).toEqual([12, 12]);
  });
});

describe.skipIf(!process.env.PREVIEW_DOCX)('constructor docx preview file', () => {
  it('writes a sample workbook', async () => {
    const dir = `${process.env.TEMP}\\sokol-docx-preview`;
    const png = (name: string) =>
      `data:image/png;base64,${readFileSync(`${dir}\\${name}`).toString('base64')}`;
    const widgets = [
      widget('a', { x: 0, y: 0, w: 6, h: 4 }, 'Динамика', 'checks'),
      widget('b', { x: 6, y: 0, w: 6, h: 4 }, 'Типы', 'checks'),
      widget('c', { x: 0, y: 4, w: 6, h: 4 }, 'Сотрудники', 'dva'),
      widget('d', { x: 6, y: 4, w: 6, h: 4 }, 'Существенность', 'recommendations'),
    ];
    const files = ['bars.png', 'pie.png', 'hbar.png', 'pie2.png'];
    const doc = buildConstructorDashboardDocument({
      title: 'ОТЧЕТ',
      meta: [
        ['Графиков на листе', '4'],
        ['Источники', 'Проверки, Рекомендации, ДВА'],
        ['Сформировано', '29.09.2026, 09:04:02'],
      ],
      widgets,
      captures: widgets.map((item, index) => ({
        id: item.instanceId,
        title: item.title,
        description: '',
        dataUrl: png(files[index] ?? 'bars.png'),
        width: 1000,
        height: 500,
      })),
    });
    writeFileSync(`${dir}\\preview.docx`, await Packer.toBuffer(doc));
  });
});
