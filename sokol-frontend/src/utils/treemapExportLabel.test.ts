import { describe, expect, it } from 'vitest';
import { formatTreemapExportLabel } from './treemapExportLabel';

describe('formatTreemapExportLabel', () => {
  it('keeps a simple name and value when materiality is missing', () => {
    expect(formatTreemapExportLabel('Контакт-центр', 50)).toBe('Контакт-центр: 50');
  });

  it('appends high/medium/low counts for HTML export tooltips', () => {
    expect(
      formatTreemapExportLabel('Департамент розничного бизнеса', 56, {
        высокий: 10,
        средний: 27,
        низкий: 19,
      }),
    ).toBe(
      [
        'Департамент розничного бизнеса: 56',
        'Высокий: 10',
        'Средний: 27',
        'Низкий: 19',
      ].join('\n'),
    );
  });

  it('appends check-view counts for employee map tooltips', () => {
    expect(
      formatTreemapExportLabel('Важник Д.С.', 7, undefined, [
        { name: 'ИТ', value: 4 },
        { name: 'Корпо', value: 3 },
      ]),
    ).toBe(['Важник Д.С.: 7', 'ИТ: 4', 'Корпо: 3'].join('\n'));
  });
});
