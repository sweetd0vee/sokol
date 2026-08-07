/** Catalog of exportable analytics dashboard sections. */

export const CHECK_EXPORT_SECTIONS = [
  { id: 'summary', label: 'Сводка KPI', sheetName: 'Сводка', headerFill: '312E81' },
  { id: 'dynamics', label: 'Количество проверок', sheetName: 'Количество проверок', headerFill: '1D4ED8' },
  { id: 'views', label: 'Виды проверок', sheetName: 'Виды проверок', headerFill: '7C3AED' },
  { id: 'types', label: 'Типы проверок', sheetName: 'Типы проверок', headerFill: '0E7490' },
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
  { id: 'auditors', label: 'Нагрузка аудиторов', sheetName: 'Аудиторы', headerFill: '1D4ED8' },
  { id: 'objects', label: 'Объекты аудита', sheetName: 'Объекты аудита', headerFill: '0E7490' },
  { id: 'checkLinks', label: 'По проверкам', sheetName: 'По проверкам', headerFill: '0369A1' },
] as const;

export const MONITORING_EXPORT_SECTIONS = [
  { id: 'summary', label: 'Сводка KPI', sheetName: 'Сводка', headerFill: '312E81' },
  { id: 'deadlineDynamics', label: 'Динамика сроков', sheetName: 'Динамика сроков', headerFill: '7C3AED' },
  { id: 'violationsByDepartment', label: 'Просрочка по департаментам', sheetName: 'Просрочка департаменты', headerFill: 'BE123C' },
  { id: 'deadlineBuckets', label: 'Горизонт сроков', sheetName: 'Горизонт сроков', headerFill: 'EA580C' },
  { id: 'funnel', label: 'Воронка исполнения', sheetName: 'Воронка', headerFill: '4F46E5' },
  { id: 'problemTreemap', label: 'Проблемные объекты', sheetName: 'Проблемные объекты', headerFill: '1D4ED8' },
] as const;

export const DVA_EXPORT_SECTIONS = [
  { id: 'summary', label: 'Сводка KPI', sheetName: 'Сводка', headerFill: '312E81' },
  { id: 'portfolio', label: 'Портфель', sheetName: 'Портфель', headerFill: '1D4ED8' },
  { id: 'auditorLoad', label: 'Нагрузка аудиторов', sheetName: 'Нагрузка аудиторов', headerFill: '1E40AF' },
  { id: 'departmentMap', label: 'Карта департаментов', sheetName: 'Карта департаментов', headerFill: '0E7490' },
  { id: 'riskProfile', label: 'Риск-профиль', sheetName: 'Риск профиль', headerFill: 'BE123C' },
  { id: 'auditorMatrix', label: 'Матрица аудитор×срок', sheetName: 'Матрица аудитор-срок', headerFill: '4338CA' },
  { id: 'documentsClosure', label: 'Документы и закрытие', sheetName: 'Документы закрытие', headerFill: '065F46' },
  { id: 'auditorTreemap', label: 'Tree Map аудиторов', sheetName: 'Аудиторы TreeMap', headerFill: '1E40AF' },
] as const;

export type CheckExportSectionId = (typeof CHECK_EXPORT_SECTIONS)[number]['id'];
export type RecommendationExportSectionId = (typeof RECOMMENDATION_EXPORT_SECTIONS)[number]['id'];
export type MonitoringExportSectionId = (typeof MONITORING_EXPORT_SECTIONS)[number]['id'];
export type DvaExportSectionId = (typeof DVA_EXPORT_SECTIONS)[number]['id'];

export function defaultSelectedIds<T extends string>(sections: readonly { id: T }[]): T[] {
  return sections.map((section) => section.id);
}
