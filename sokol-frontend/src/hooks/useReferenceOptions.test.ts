import { describe, expect, it } from 'vitest';
import { toNameOptions } from './useReferenceOptions';

describe('toNameOptions', () => {
  it('deduplicates, sorts in Russian locale and includes extra value', () => {
    const options = toNameOptions(['Банк', 'Аудит', 'Банк'], 'Вне списка');

    expect(options.map((option) => option.value)).toEqual([
      'Аудит',
      'Банк',
      'Вне списка',
    ]);
    expect(options.every((option) => option.label === option.value)).toBe(true);
  });

  it('filters empty strings', () => {
    expect(toNameOptions(['', 'Корпо'])).toEqual([
      { value: 'Корпо', label: 'Корпо' },
    ]);
  });
});
