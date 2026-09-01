import { describe, expect, it } from 'vitest';
import {
  applyValueBasedColors,
  lastScaleColor,
  MONITORING_ADDITIONAL_STATUS_COLORS,
  MONITORING_BAR_BLUE_SCALE,
  MONITORING_STATUS_COLORS,
  MONITORING_VALUE_SCALE,
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

  it('maps deadline-extension bars from emerald to navy', () => {
    const colored = applyValueBasedColors(
      [
        { name: 'high', value: 35 },
        { name: 'low', value: 14 },
      ],
      MONITORING_BAR_BLUE_SCALE,
    );

    expect(colored.find((item) => item.name === 'high')?.color.toUpperCase()).toBe(
      lastScaleColor(MONITORING_BAR_BLUE_SCALE).toUpperCase(),
    );
    expect(colored.find((item) => item.name === 'low')?.color.toUpperCase()).toBe('#0E7490');
  });
});

describe('MONITORING_STATUS_COLORS', () => {
  it('keeps teal and dusty lilac, and uses light grey / pale yellow for the middle statuses', () => {
    expect(MONITORING_STATUS_COLORS.completed).toBe('#0E7490');
    expect(MONITORING_STATUS_COLORS.unresolved).toBe('#DAAAD1');
    expect(MONITORING_STATUS_COLORS.on_control).toBe('#DBDBDB');
    expect(MONITORING_STATUS_COLORS.in_progress).toBe('#FFFFB9');
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
