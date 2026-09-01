import { describe, expect, it } from 'vitest';
import {
  applyValueBasedColors,
  MONITORING_BAR_BLUE_SCALE,
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

  it('maps deadline-extension bars through blues and includes #0E7490', () => {
    const colored = applyValueBasedColors(
      [
        { name: 'high', value: 35 },
        { name: 'low', value: 14 },
      ],
      MONITORING_BAR_BLUE_SCALE,
    );

    expect(colored.find((item) => item.name === 'high')?.color.toUpperCase()).toBe('#163A7A');
    expect(colored.find((item) => item.name === 'low')?.color.toUpperCase()).toBe('#4580D8');
    expect(MONITORING_BAR_BLUE_SCALE).toContain('#0E7490');
  });
});
