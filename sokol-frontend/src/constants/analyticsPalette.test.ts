import { describe, expect, it } from 'vitest';
import {
  applyValueBasedColors,
  colorWithAlpha,
  kpiAccentStyle,
  lastScaleColor,
  MONITORING_ADDITIONAL_STATUS_COLORS,
  MONITORING_BAR_BLUE_SCALE,
  MONITORING_STATUS_COLORS,
  MONITORING_VALUE_SCALE,
  RECOMMENDATIONS_MATERIALITY_CHART_COLORS,
  VALUE_EMERALD_SCALE,
  VALUE_TEAL_SCALE,
  DVA_AUDITOR_CHECKS_SCALE,
  DVA_VALUE_SCALE,
  getMaterialityChartColor,
  getRankBasedColors,
  getUniqueValueColors,
} from './analyticsPalette';

describe('applyValueBasedColors', () => {
  it('maps the largest slice to deep teal and the smallest to pale lilac', () => {
    const colored = applyValueBasedColors([
      { name: 'Исполнено', value: 431 },
      { name: 'Не решено', value: 142 },
      { name: 'В процессе', value: 349 },
      { name: 'На контроле', value: 223 },
    ]);

    expect(colored.find((item) => item.name === 'Исполнено')?.color.toUpperCase()).toBe(
      MONITORING_VALUE_SCALE[5].toUpperCase(),
    );
    expect(colored.find((item) => item.name === 'Не решено')?.color.toUpperCase()).toBe(
      MONITORING_VALUE_SCALE[0].toUpperCase(),
    );
  });

  it('ignores zero slices when placing the scale so visible pieces still reach both endpoints', () => {
    const colored = applyValueBasedColors([
      { name: 'Срок нарушен', value: 671 },
      { name: 'В срок', value: 0 },
      { name: 'На контроле', value: 207 },
    ]);

    expect(colored.find((item) => item.name === 'Срок нарушен')?.color.toUpperCase()).toBe(
      MONITORING_VALUE_SCALE[5].toUpperCase(),
    );
    expect(colored.find((item) => item.name === 'На контроле')?.color.toUpperCase()).toBe(
      MONITORING_VALUE_SCALE[0].toUpperCase(),
    );
  });

  it('maps deadline-extension bars from on-control grey to emerald', () => {
    const colored = applyValueBasedColors(
      [
        { name: 'high', value: 35 },
        { name: 'low', value: 14 },
      ],
      MONITORING_BAR_BLUE_SCALE,
    );

    expect(colored.find((item) => item.name === 'high')?.color.toUpperCase()).toBe('#0E7490');
    expect(colored.find((item) => item.name === 'low')?.color.toUpperCase()).toBe(
      MONITORING_STATUS_COLORS.on_control.toUpperCase(),
    );
  });
});

describe('VALUE_EMERALD_SCALE', () => {
  it('maps the largest treemap block to emerald and nearby values to distinct blue/teal stops', () => {
    const colors = getRankBasedColors([87, 57, 52, 51, 48], VALUE_EMERALD_SCALE);

    expect(colors[0]?.toUpperCase()).toBe('#0E7490');
    expect(colors[1]?.toUpperCase()).toBe('#60A5FA');
    expect(new Set(colors.map((color) => color.toUpperCase())).size).toBe(5);
    expect(lastScaleColor(VALUE_EMERALD_SCALE).toUpperCase()).toBe('#0E7490');
  });
});

describe('getUniqueValueColors', () => {
  function luminance(hex: string) {
    const normalized = hex.replace('#', '');
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  it('maps the largest department block to emerald and ties to the same shade', () => {
    const colors = getUniqueValueColors([87, 57, 52, 51, 50, 49, 49, 49, 49, 48], VALUE_TEAL_SCALE);

    expect(colors[0]?.toUpperCase()).toBe('#0E7490');
    expect(new Set(colors.slice(5, 9).map((color) => color.toUpperCase())).size).toBe(1);
    expect(lastScaleColor(VALUE_TEAL_SCALE).toUpperCase()).toBe('#0E7490');
  });

  it('maps the auditor checks treemap so equal headcounts share a shade', () => {
    const colors = getUniqueValueColors([7, 5, 5, 4, 4, 2, 1, 1], DVA_AUDITOR_CHECKS_SCALE);

    expect(colors[0]?.toUpperCase()).toBe('#0E7490');
    expect(colors[1]).toBe(colors[2]);
    expect(colors[3]).toBe(colors[4]);
    expect(colors[6]).toBe(colors[7]);
    expect(colors[6]?.toUpperCase()).toBe(MONITORING_STATUS_COLORS.on_control.toUpperCase());
    expect(luminance(colors[1] ?? '')).toBeLessThan(luminance(colors[3] ?? ''));
    expect(luminance(colors[3] ?? '')).toBeLessThan(luminance(colors[5] ?? ''));
    expect(luminance(colors[5] ?? '')).toBeLessThan(luminance(colors[6] ?? ''));
  });

  it('makes larger unique values darker than smaller ones', () => {
    const colors = getUniqueValueColors([87, 57, 52, 51, 48], VALUE_TEAL_SCALE);

    expect(luminance(colors[0] ?? '')).toBeLessThan(luminance(colors[1] ?? ''));
    expect(luminance(colors[1] ?? '')).toBeLessThan(luminance(colors[2] ?? ''));
    expect(luminance(colors[2] ?? '')).toBeLessThan(luminance(colors[3] ?? ''));
    expect(luminance(colors[3] ?? '')).toBeLessThan(luminance(colors[4] ?? ''));
  });
});

describe('DVA_VALUE_SCALE', () => {
  function luminance(hex: string) {
    const normalized = hex.replace('#', '');
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  it('maps the largest auditor block to signature indigo', () => {
    const colors = getUniqueValueColors([7, 5, 5, 4, 4, 2, 1, 1], DVA_VALUE_SCALE);

    expect(colors[0]?.toUpperCase()).toBe('#312E81');
    expect(colors[1]).toBe(colors[2]);
    expect(lastScaleColor(DVA_VALUE_SCALE).toUpperCase()).toBe('#312E81');
    expect(luminance(colors[0] ?? '')).toBeLessThan(luminance(colors[1] ?? ''));
    expect(luminance(colors[5] ?? '')).toBeLessThan(luminance(colors[6] ?? ''));
  });
});

describe('MONITORING_STATUS_COLORS', () => {
  it('keeps teal and dusty lilac, and uses light grey / butter yellow for the middle statuses', () => {
    expect(MONITORING_STATUS_COLORS.completed).toBe('#0E7490');
    expect(MONITORING_STATUS_COLORS.unresolved).toBe('#DAAAD1');
    expect(MONITORING_STATUS_COLORS.on_control).toBe('#DBDBDB');
    expect(MONITORING_STATUS_COLORS.in_progress).toBe('#FBEB8D');
  });
});

describe('MONITORING_ADDITIONAL_STATUS_COLORS', () => {
  it('reuses Statuses-chart shades: violated pink, on time teal, on control grey', () => {
    expect(MONITORING_ADDITIONAL_STATUS_COLORS.deadline_violated).toBe(
      MONITORING_STATUS_COLORS.unresolved,
    );
    expect(MONITORING_ADDITIONAL_STATUS_COLORS.on_time).toBe(MONITORING_STATUS_COLORS.completed);
    expect(MONITORING_ADDITIONAL_STATUS_COLORS.on_control).toBe(
      MONITORING_STATUS_COLORS.on_control,
    );
  });
});

describe('RECOMMENDATIONS_MATERIALITY_CHART_COLORS', () => {
  it('reuses Monitoring status-circle tones: emerald / yellow / pink', () => {
    expect(RECOMMENDATIONS_MATERIALITY_CHART_COLORS.низкий).toBe(MONITORING_STATUS_COLORS.completed);
    expect(RECOMMENDATIONS_MATERIALITY_CHART_COLORS.средний).toBe(MONITORING_STATUS_COLORS.in_progress);
    expect(RECOMMENDATIONS_MATERIALITY_CHART_COLORS.высокий).toBe(MONITORING_STATUS_COLORS.unresolved);
  });

  it('exposes the same mapping via getMaterialityChartColor', () => {
    expect(getMaterialityChartColor('низкий')).toBe(RECOMMENDATIONS_MATERIALITY_CHART_COLORS.низкий);
    expect(getMaterialityChartColor('средний')).toBe(RECOMMENDATIONS_MATERIALITY_CHART_COLORS.средний);
    expect(getMaterialityChartColor('высокий')).toBe(RECOMMENDATIONS_MATERIALITY_CHART_COLORS.высокий);
  });
});

describe('kpiAccentStyle', () => {
  it('washes emerald as a thin transparent teal and keeps the swatch for text', () => {
    const style = kpiAccentStyle(MONITORING_STATUS_COLORS.completed);
    expect(style.backgroundColor).toBe(colorWithAlpha(MONITORING_STATUS_COLORS.completed, 0.1));
    expect(style.color).toBe(MONITORING_STATUS_COLORS.completed);
  });

  it('keeps pale yellow / pink fills a bit stronger so they stay visible', () => {
    const yellow = kpiAccentStyle(MONITORING_STATUS_COLORS.in_progress);
    const pink = kpiAccentStyle(MONITORING_STATUS_COLORS.unresolved);
    expect(yellow.backgroundColor).toBe(colorWithAlpha(MONITORING_STATUS_COLORS.in_progress, 0.28));
    expect(pink.backgroundColor).toBe(colorWithAlpha(MONITORING_STATUS_COLORS.unresolved, 0.28));
  });
});
