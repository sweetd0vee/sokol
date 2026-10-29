import { describe, expect, it } from 'vitest';
import type { ConstructorWidget } from '../components/analytics/constructor/constructorTypes';
import type { DashboardChartCapture } from './dashboardChartRegistry';
import {
  buildConstructorDashboardHtml,
  constructorHtmlGridStyle,
  resolveConstructorHtmlChartBody,
} from './constructorHtmlExport';

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
    filterCaption: '2025 · Все аудиторы',
    size: { w: layout.w, h: layout.h, minW: 1, minH: 1 },
    payload: { chart: 'list', items: [] },
    layout: { ...layout, minW: 1, minH: 1 },
  };
}

describe('constructor HTML export', () => {
  it('maps dashboard cells onto a 12-column CSS grid', () => {
    expect(constructorHtmlGridStyle({ x: 0, y: 0, w: 6, h: 4 })).toBe(
      'grid-column:1 / span 6;grid-row:1 / span 4',
    );
    expect(constructorHtmlGridStyle({ x: 6, y: 0, w: 6, h: 4 })).toBe(
      'grid-column:7 / span 6;grid-row:1 / span 4',
    );
    expect(constructorHtmlGridStyle({ x: 0, y: 4, w: 12, h: 3 })).toBe(
      'grid-column:1 / span 12;grid-row:5 / span 3',
    );
  });

  it('embeds SVG instead of a PNG screenshot when vector markup exists', () => {
    const capture: DashboardChartCapture = {
      id: 'left',
      title: 'KPI',
      description: '',
      dataUrl: 'data:image/png;base64,abc',
      svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" data-label="A"/></svg>',
      width: 640,
      height: 360,
    };
    const body = resolveConstructorHtmlChartBody(capture, 0);
    expect(body).toContain('class="chart-svg"');
    expect(body).toContain('<svg');
    expect(body).not.toContain('<img');
  });

  it('builds a board with interactive tooltip wiring and no full-sheet screenshot', () => {
    const widgets = [
      widget('left', { x: 0, y: 0, w: 6, h: 4 }, 'Виды'),
      widget('right', { x: 6, y: 0, w: 6, h: 4 }, 'Типы'),
    ];
    const html = buildConstructorDashboardHtml({
      title: 'Мой дашборд',
      widgets,
      captures: widgets.map((item) => ({
        id: item.instanceId,
        title: item.title,
        description: item.filterCaption,
        dataUrl: '',
        svgMarkup:
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect class="recharts-rectangle" width="10" height="10" data-label="Серия"/></svg>',
        width: 400,
        height: 240,
      })),
    });
    expect(html).toContain('class="board"');
    expect(html).not.toContain('class="hero"');
    expect(html).not.toContain('class="meta"');
    expect(html).not.toContain('Графиков на листе');
    expect(html).toContain('grid-column:1 / span 6');
    expect(html).toContain('grid-column:7 / span 6');
    expect(html).toContain('class="chart-svg"');
    expect(html).toContain('id="chart-tooltip"');
    expect(html).toContain('pointerover');
    expect(html).not.toContain('class="sheet"');
    expect(html.match(/<img /g) ?? []).toHaveLength(0);
  });
});
