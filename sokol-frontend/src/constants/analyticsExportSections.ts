/** Catalog of exportable analytics dashboard sections. */

export const CHECK_EXPORT_SECTIONS = [
  { id: 'summary', label: 'Сводка KPI', sheetName: 'Сводка', headerFill: '312E81' },
  { id: 'periods', label: 'Динамика по периодам', sheetName: 'По периодам', headerFill: '1D4ED8' },
  { id: 'cumulative', label: 'Накопительный итог', sheetName: 'Накопительно', headerFill: '312E81' },
  { id: 'statusByPeriod', label: 'Статусы по периодам', sheetName: 'Статусы по периодам', headerFill: 'B45309' },
  { id: 'typeStatus', label: 'Тип × статус', sheetName: 'Тип и статус', headerFill: 'B45309' },
  { id: 'statuses', label: 'Статусы', sheetName: 'Статусы', headerFill: '065F46' },
  { id: 'types', label: 'Типы', sheetName: 'Типы', headerFill: '0E7490' },
  { id: 'views', label: 'Виды', sheetName: 'Виды', headerFill: '7C3AED' },
  { id: 'auditors', label: 'Аудиторы', sheetName: 'Аудиторы', headerFill: '1E40AF' },
  { id: 'durations', label: 'Длительность', sheetName: 'Длительность', headerFill: '0369A1' },
  { id: 'documents', label: 'Документы', sheetName: 'Документы', headerFill: 'BE123C' },
  { id: 'effectiveness', label: 'Оценка эффективности', sheetName: 'Оценка эффективности', headerFill: '065F46' },
  { id: 'effectivenessByArea', label: 'Оценки по областям', sheetName: 'Оценки по областям', headerFill: '0E7490' },
  { id: 'effectivenessByPeriod', label: 'Оценки по периодам', sheetName: 'Оценки по периодам', headerFill: 'B45309' },
  { id: 'effectivenessByAuditor', label: 'Оценки по аудиторам', sheetName: 'Оценки аудиторы', headerFill: '1E40AF' },
  { id: 'auditorMatrix', label: 'Матрица аудитор×период', sheetName: 'Матрица аудитор-период', headerFill: '4338CA' },
  { id: 'source', label: 'Исходные данные', sheetName: 'Исходные данные', headerFill: '003366' },
] as const;

export const RECOMMENDATION_EXPORT_SECTIONS = [
  { id: 'summary', label: 'Сводка KPI', sheetName: 'Сводка', headerFill: '312E81' },
  { id: 'periods', label: 'Динамика сроков', sheetName: 'По периодам', headerFill: '7C3AED' },
  { id: 'cumulative', label: 'Накопление и исполнение', sheetName: 'Накопительно', headerFill: '4F46E5' },
  { id: 'materialityByPeriod', label: 'Существенность по периодам', sheetName: 'Сущ по периодам', headerFill: 'BE123C' },
  { id: 'statusByPeriod', label: 'Статусы по периодам', sheetName: 'Статусы по периодам', headerFill: 'CA8A04' },
  { id: 'materiality', label: 'Существенность', sheetName: 'Существенность', headerFill: '16A34A' },
  { id: 'statuses', label: 'Статусы', sheetName: 'Статусы', headerFill: 'CA8A04' },
  { id: 'additionalStatuses', label: 'Срок исполнения', sheetName: 'Срок исполнения', headerFill: 'DB2777' },
  { id: 'indicators', label: 'Индикаторы', sheetName: 'Индикаторы', headerFill: '0891B2' },
  { id: 'deadlines', label: 'Горизонт сроков', sheetName: 'Горизонт сроков', headerFill: 'EA580C' },
  { id: 'funnel', label: 'Воронка исполнения', sheetName: 'Воронка', headerFill: '4F46E5' },
  { id: 'auditorMateriality', label: 'Аудитор × существенность', sheetName: 'Аудитор-существенность', headerFill: 'BE123C' },
  { id: 'auditors', label: 'Нагрузка аудиторов', sheetName: 'Аудиторы', headerFill: '1D4ED8' },
  { id: 'objects', label: 'Объекты аудита', sheetName: 'Объекты аудита', headerFill: '0E7490' },
  { id: 'managers', label: 'Менеджеры', sheetName: 'Менеджеры', headerFill: '7C3AED' },
  { id: 'checkLinks', label: 'По проверкам', sheetName: 'По проверкам', headerFill: '0369A1' },
  { id: 'auditorPerformance', label: 'Исполнение по аудиторам', sheetName: 'Исполнение аудиторов', headerFill: '059669' },
  { id: 'auditorMatrix', label: 'Матрица аудитор×период', sheetName: 'Матрица аудитор-период', headerFill: '4338CA' },
  { id: 'materialityMatrix', label: 'Матрица сущ.×период', sheetName: 'Матрица сущ-период', headerFill: 'E11D48' },
  { id: 'source', label: 'Исходные данные', sheetName: 'Исходные данные', headerFill: '003366' },
] as const;

export type CheckExportSectionId = (typeof CHECK_EXPORT_SECTIONS)[number]['id'];
export type RecommendationExportSectionId = (typeof RECOMMENDATION_EXPORT_SECTIONS)[number]['id'];

export function defaultSelectedIds<T extends string>(sections: readonly { id: T }[]): T[] {
  return sections.map((section) => section.id);
}
