import { describe, expect, it } from 'vitest';
import { rankAuditorRows } from './dvaAnalytics';

describe('rankAuditorRows', () => {
  it('ranks by metric and keeps a stable name order on ties', () => {
    const ranked = rankAuditorRows(
      [
        { name: 'Борисов', value: 4 },
        { name: 'Андреев', value: 4 },
        { name: 'Волков', value: 9 },
        { name: 'Громов', value: 0 },
      ],
      (row) => row.value,
      { limit: 3 },
    );

    expect(ranked.map((row) => row.name)).toEqual(['Волков', 'Андреев', 'Борисов']);
  });

  it('can surface the weakest rows first', () => {
    const ranked = rankAuditorRows(
      [
        { name: 'Иванов', readiness: 90 },
        { name: 'Петров', readiness: 20 },
      ],
      (row) => row.readiness,
      { direction: 'asc' },
    );

    expect(ranked[0]?.name).toBe('Петров');
  });
});
