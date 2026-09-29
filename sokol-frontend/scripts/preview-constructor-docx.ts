import { readFileSync, writeFileSync } from 'node:fs';
import { Packer } from 'docx';
import type { ConstructorWidget } from '../src/components/analytics/constructor/constructorTypes';
import { buildConstructorDashboardDocument } from '../src/utils/constructorDocxExport';

const dir = process.env.TEMP ? `${process.env.TEMP}\\sokol-docx-preview` : '/tmp/sokol-docx-preview';

function png(name: string) {
  const bytes = readFileSync(`${dir}\\${name}`);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

function widget(
  id: string,
  layout: { x: number; y: number; w: number; h: number },
  title: string,
  kind: ConstructorWidget['kind'],
): ConstructorWidget {
  return {
    instanceId: id,
    kind,
    sectionId: id,
    title,
    description: '',
    filterCaption: 'Все',
    size: { w: layout.w, h: layout.h, minW: 1, minH: 1 },
    payload: { chart: 'list', items: [] },
    layout: { ...layout, minW: 1, minH: 1 },
  };
}

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

const buffer = await Packer.toBuffer(doc);
writeFileSync(`${dir}\\preview.docx`, buffer);
console.log(`${dir}\\preview.docx`);
