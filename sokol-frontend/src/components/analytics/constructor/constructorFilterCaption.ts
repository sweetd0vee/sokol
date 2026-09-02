import type { ConstructorFilterSnapshot } from './constructorTypes';

export function buildConstructorFilterCaption(input: ConstructorFilterSnapshot): string {
  const period = input.periods.length > 0 ? input.periods.join(', ') : `Все · ${input.periodSliceLabel}`;
  const auditors = input.auditors.length > 0 ? input.auditors.join(', ') : 'Все аудиторы';
  const departments = input.departments.length > 0 ? input.departments.join(', ') : 'Все департаменты';
  return `${period} · ${auditors} · ${departments}`;
}
