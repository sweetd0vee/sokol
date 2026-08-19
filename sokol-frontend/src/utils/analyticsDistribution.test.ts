import { describe, expect, it } from 'vitest';
import { completeNamedDistribution, distributionHasValues } from './analyticsDistribution';

describe('completeNamedDistribution', () => {
  const options = [
    { value: 'on_time', label: 'В срок' },
    { value: 'deadline_violated', label: 'Срок нарушен' },
    { value: 'on_control', label: 'На контроле' },
  ] as const;

  it('fills missing categories with zero so legends stay complete', () => {
    const completed = completeNamedDistribution(
      [{ name: 'Срок нарушен', value: 671 }],
      options,
      (value) => value,
    );

    expect(completed.map((item) => [item.name, item.value])).toEqual([
      ['В срок', 0],
      ['Срок нарушен', 671],
      ['На контроле', 0],
    ]);
  });

  it('treats an all-zero list as empty for the chart placeholder', () => {
    expect(distributionHasValues([{ value: 0 }, { value: 0 }])).toBe(false);
    expect(distributionHasValues([{ value: 0 }, { value: 2 }])).toBe(true);
  });
});
