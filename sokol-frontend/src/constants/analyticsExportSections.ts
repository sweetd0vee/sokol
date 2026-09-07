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
  { id: 'materialityByPeriod', label: 'Существенность по периодам', sheetName: 'Сущ по периодам', headerFill: 'BE123C' },
  { id: 'materiality', label: 'Существенность', sheetName: 'Существенность', headerFill: '16A34A' },
  { id: 'views', label: 'Виды проверок', sheetName: 'Виды проверок', headerFill: '7C3AED' },
  { id: 'objects', label: 'Карта департаментов', sheetName: 'Карта департаментов', headerFill: '0E7490' },
  { id: 'materialityMatrix', label: 'Матрица существенности', sheetName: 'Матрица существенности', headerFill: 'BE123C' },
] as const;

export const MONITORING_EXPORT_SECTIONS = [
  { id: 'summary', label: 'Сводка KPI', sheetName: 'Сводка', headerFill: '312E81' },
  { id: 'additionalStatuses', label: 'Срок исполнения', sheetName: 'Срок исполнения', headerFill: 'DB2777' },
  { id: 'statuses', label: 'Статусы', sheetName: 'Статусы', headerFill: 'CA8A04' },
  {
    id: 'deadlineExtensions',
    label: 'Перенос срока',
    sheetName: 'Перенос срока',
    headerFill: '003366',
  },
  {
    id: 'completedDuringAudit',
    label: 'Исполнено в ходе аудита',
    sheetName: 'Исполнено в ходе аудита',
    headerFill: '003366',
  },
  { id: 'statusMatrix', label: 'Матрица статусов', sheetName: 'Матрица статусов', headerFill: '0891B2' },
] as const;

export const DVA_EXPORT_SECTIONS = [
  { id: 'summary', label: 'Сводка KPI', sheetName: 'Сводка', headerFill: '312E81' },
  { id: 'auditorTimeliness', label: 'Своевременность', sheetName: 'Своевременность', headerFill: 'DAAAD1' },
  { id: 'auditorImpact', label: 'Импакт рекомендаций', sheetName: 'Импакт', headerFill: 'DAAAD1' },
  { id: 'auditorExecution', label: 'Результативность исполнения', sheetName: 'Исполнение', headerFill: '0E7490' },
  {
    id: 'auditorChecksMap',
    label: 'Карта сотрудников по проверкам',
    sheetName: 'Карта проверки',
    headerFill: '312E81',
  },
  {
    id: 'checkLifecycle',
    label: 'Жизненный цикл проверки',
    sheetName: 'Жизненный цикл',
    headerFill: '312E81',
  },
] as const;

export type CheckExportSectionId = (typeof CHECK_EXPORT_SECTIONS)[number]['id'];
export type RecommendationExportSectionId = (typeof RECOMMENDATION_EXPORT_SECTIONS)[number]['id'];
export type MonitoringExportSectionId = (typeof MONITORING_EXPORT_SECTIONS)[number]['id'];
export type DvaExportSectionId = (typeof DVA_EXPORT_SECTIONS)[number]['id'];

export const PLANNING_EXPORT_SECTIONS = [
  { id: 'summary', label: 'Сводка планирования', sheetName: 'Сводка', headerFill: '1D4ED8' },
  { id: 'coverage', label: 'Охват департаментов', sheetName: 'Охват', headerFill: '0E7490' },
  { id: 'departmentAnalytics', label: 'Аналитика департаментов', sheetName: 'Департаменты', headerFill: '003366' },
  { id: 'highMateriality', label: 'Красные рекомендации', sheetName: 'Красные рекоменд', headerFill: 'BE123C' },
] as const;

export type PlanningExportSectionId = (typeof PLANNING_EXPORT_SECTIONS)[number]['id'];
