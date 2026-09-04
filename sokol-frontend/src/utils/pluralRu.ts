/** Russian pluralization: 1 / 2-4 / 5+. */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs % 10 === 1 && abs % 100 !== 11) {
    return one;
  }
  if (abs % 10 >= 2 && abs % 10 <= 4 && (abs % 100 < 10 || abs % 100 >= 20)) {
    return few;
  }
  return many;
}

export function pluralRecommendations(n: number): string {
  return pluralRu(n, 'рекомендация', 'рекомендации', 'рекомендаций');
}
