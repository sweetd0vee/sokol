import { describe, expect, it } from 'vitest';
import { buildTopNamedDistribution, completeNamedDistribution, distributionHasValues } from './analyticsDistribution';

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

  it('sums duplicate names instead of keeping the last zeroed alias', () => {
    const completed = completeNamedDistribution(
      [
        { name: 'На контроле', value: 207 },
        { name: 'На контроле', value: 0 },
        { name: 'В срок', value: 10 },
      ],
      options,
      (value) => value,
    );

    expect(completed.map((item) => [item.name, item.value])).toEqual([
      ['В срок', 10],
      ['Срок нарушен', 0],
      ['На контроле', 207],
    ]);
  });

  it('treats an all-zero list as empty for the chart placeholder', () => {
    expect(distributionHasValues([{ value: 0 }, { value: 0 }])).toBe(false);
    expect(distributionHasValues([{ value: 0 }, { value: 2 }])).toBe(true);
  });
});

describe('buildTopNamedDistribution', () => {
  it('keeps top auditors and folds the rest into "Прочие"', () => {
    const distribution = buildTopNamedDistribution(
      [
        { name: 'А', value: 10 },
        { name: 'Б', value: 8 },
        { name: 'В', value: 6 },
        { name: 'Г', value: 4 },
        { name: 'Д', value: 3 },
        { name: 'Е', value: 2 },
        { name: 'Ж', value: 2 },
        { name: 'З', value: 1 },
        { name: 'И', value: 5 },
        { name: 'К', value: 1 },
      ],
      { topN: 8 },
    );

    expect(distribution).toEqual([
      { name: 'А', value: 10 },
      { name: 'Б', value: 8 },
      { name: 'В', value: 6 },
      { name: 'И', value: 5 },
      { name: 'Г', value: 4 },
      { name: 'Д', value: 3 },
      { name: 'Е', value: 2 },
      { name: 'Ж', value: 2 },
      { name: 'Прочие', value: 2 },
    ]);
  });

  it('returns an empty list when all values are zero', () => {
    expect(buildTopNamedDistribution([{ name: 'А', value: 0 }])).toEqual([]);
  });
});
