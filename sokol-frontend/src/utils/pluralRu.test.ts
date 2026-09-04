import { describe, expect, it } from 'vitest';
import { pluralRecommendations, pluralRu } from './pluralRu';

describe('pluralRu', () => {
  it('picks one / few / many by Russian remainder rules', () => {
    expect(pluralRu(1, 'a', 'b', 'c')).toBe('a');
    expect(pluralRu(21, 'a', 'b', 'c')).toBe('a');
    expect(pluralRu(2, 'a', 'b', 'c')).toBe('b');
    expect(pluralRu(23, 'a', 'b', 'c')).toBe('b');
    expect(pluralRu(5, 'a', 'b', 'c')).toBe('c');
    expect(pluralRu(11, 'a', 'b', 'c')).toBe('c');
    expect(pluralRu(0, 'a', 'b', 'c')).toBe('c');
  });
});

describe('pluralRecommendations', () => {
  it('matches the previous inline helper', () => {
    expect(pluralRecommendations(1)).toBe('рекомендация');
    expect(pluralRecommendations(2)).toBe('рекомендации');
    expect(pluralRecommendations(5)).toBe('рекомендаций');
    expect(pluralRecommendations(11)).toBe('рекомендаций');
    expect(pluralRecommendations(22)).toBe('рекомендации');
  });
});
