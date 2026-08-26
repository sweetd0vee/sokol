/** Catalog of exportable analytics dashboard sections. */

export const CHECK_EXPORT_SECTIONS = [
  { id: 'summary', label: 'Сводка KPI', sheetName: 'Сводка', headerFill: '312E81' },
  { id: 'dynamics', label: 'Количество проверок', sheetName: 'Количество проверок', headerFill: '1D4ED8' },
  { id: 'views', label: 'Виды проверок', sheetName: 'Виды проверок', headerFill: '7C3AED' },
  { id: 'types', label: 'Типы проверок', sheetName: 'Типы проверок', headerFill: '0E7490' },
  { id: 'departmentMap', label: 'Карта департаментов', sheetName: 'Карта департаментов', headerFill: '0E7490' },
  { id: 'effectivenessMatrix', label: 'Оценка эффективности', sheetName: 'Оценка эффективности', headerFill: '065F46' },
] as const;

export const RECOMMENDATION_EXPORT_SECTIONS = [
  { id: 'summary', label: 'Сводка KPI', sheetName: 'Сводка', headerFill: '312E81' },
  { id: 'cumulative', label: 'Количество рекомендаций', sheetName: 'Количество рекомендаций', headerFill: '4F46E5' },
  { id: 'materialityByPeriod', label: 'Существенность по периодам', sheetName: 'Сущ по периодам', headerFill: 'BE123C' },
  { id: 'statusByPeriod', label: 'Статусы по периодам', sheetName: 'Статусы по периодам', headerFill: 'CA8A04' },
  { id: 'materiality', label: 'Существенность', sheetName: 'Существенность', headerFill: '16A34A' },
  { id: 'objects', label: 'Карта департаментов', sheetName: 'Карта департаментов', headerFill: '0E7490' },
  { id: 'materialityMatrix', label: 'Матрица существенности', sheetName: 'Матрица существенности', headerFill: 'BE123C' },
] as const;

export const MONITORING_EXPORT_SECTIONS = [
  { id: 'summary', label: 'Сводка KPI', sheetName: 'Сводка', headerFill: '312E81' },
  { id: 'additionalStatuses', label: 'Срок исполнения', sheetName: 'Срок исполнения', headerFill: 'DB2777' },
  { id: 'indicators', label: 'Индикаторы', sheetName: 'Индикаторы', headerFill: '0891B2' },
] as const;

export const DVA_EXPORT_SECTIONS = [
  { id: 'summary', label: 'Сводка KPI', sheetName: 'Сводка', headerFill: '312E81' },
  { id: 'auditorLoad', label: 'Нагрузка аудиторов', sheetName: 'Нагрузка аудиторов', headerFill: '1E40AF' },
  { id: 'documentsClosure', label: 'Документы и закрытие', sheetName: 'Документы закрытие', headerFill: '065F46' },
  {
    id: 'auditorChecksTreemap',
    label: 'Карта аудиторов по количеству проверок',
    sheetName: 'Аудиторы проверки',
    headerFill: '003366',
  },
  {
    id: 'auditorRecommendationsTreemap',
    label: 'Карта аудиторов по количеству рекомендаций',
    sheetName: 'Аудиторы рекомендации',
    headerFill: '7C3AED',
  },
] as const;

export type CheckExportSectionId = (typeof CHECK_EXPORT_SECTIONS)[number]['id'];
export type RecommendationExportSectionId = (typeof RECOMMENDATION_EXPORT_SECTIONS)[number]['id'];
export type MonitoringExportSectionId = (typeof MONITORING_EXPORT_SECTIONS)[number]['id'];
export type DvaExportSectionId = (typeof DVA_EXPORT_SECTIONS)[number]['id'];
