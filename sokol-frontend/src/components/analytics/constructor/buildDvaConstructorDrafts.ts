import {
  MONITORING_ADDITIONAL_STATUS_COLORS,
  MONITORING_STATUS_COLORS,
  RECOMMENDATIONS_MATERIALITY_CHART_COLORS,
} from '../analyticsPalette';
import { SIZE, draft } from './constructorDraft';
import type { ConstructorWidgetDraft, DvaConstructorInput } from './constructorTypes';

export function buildDvaConstructorDrafts(input: DvaConstructorInput): ConstructorWidgetDraft[] {
  const drafts: ConstructorWidgetDraft[] = [];
  const { filterCaption: caption } = input;
  const kind = 'dva' as const;

  for (const sectionId of input.selectedSections) {
    if (sectionId === 'summary') {
      drafts.push(
        draft(kind, sectionId, 'Итого по ДВА', caption, SIZE.kpi, {
          chart: 'kpi',
          columns: 5,
          items: [
            { label: 'Проверки', value: input.checkTotal, tone: 'blue' },
            { label: 'Рекомендации', value: input.recTotal, tone: 'slate' },
            {
              label: 'Аудиторы',
              value: input.employeeCount,
              accentColor: MONITORING_STATUS_COLORS.completed,
            },
            {
              label: 'Высокая существенность',
              value: input.highMateriality,
              accentColor: RECOMMENDATIONS_MATERIALITY_CHART_COLORS.высокий,
            },
            {
              label: 'Средняя продолжительность\nпроверки',
              value: input.averageCheckDurationDays,
              suffix: ' дн.',
              accentColor: MONITORING_STATUS_COLORS.in_progress,
            },
          ],
        }),
      );
    } else if (sectionId === 'auditorChecksMap') {
      drafts.push(
        draft(kind, sectionId, 'Карта по руководителям проверок', caption, SIZE.treemap, {
          chart: 'treemap',
          data: input.auditorChecksMap,
          palette: 'indigo',
        }),
      );
    } else if (sectionId === 'auditorImpact') {
      drafts.push(
        draft(kind, sectionId, 'Количество рекомендаций по сотрудникам (существенность)', caption, SIZE.half, {
          chart: 'stacked',
          data: input.auditorImpact,
          series: [
            { key: 'high', name: 'Высокий', color: RECOMMENDATIONS_MATERIALITY_CHART_COLORS.высокий },
            { key: 'medium', name: 'Средний', color: RECOMMENDATIONS_MATERIALITY_CHART_COLORS.средний },
            { key: 'low', name: 'Низкий', color: RECOMMENDATIONS_MATERIALITY_CHART_COLORS.низкий },
          ],
          xKey: 'name',
          showLegend: true,
          showStackTotal: true,
          layout: 'vertical',
          categoryWidth: 128,
        }),
      );
    } else if (sectionId === 'auditorExecution') {
      drafts.push(
        draft(kind, sectionId, 'Количество и доля рекомендаций со статусом "Не решено"', caption, SIZE.half, {
          chart: 'auditor-unresolved',
          data: input.auditorExecution,
        }),
      );
    } else if (sectionId === 'auditorTimeliness') {
      drafts.push(
        draft(kind, sectionId, 'Количество рекомендаций по сотрудникам (дополнительный статус)', caption, SIZE.half, {
          chart: 'stacked',
          data: input.auditorTimeliness,
          series: [
            { key: 'on_time', name: 'В срок', color: MONITORING_ADDITIONAL_STATUS_COLORS.on_time },
            { key: 'on_control', name: 'На контроле', color: MONITORING_ADDITIONAL_STATUS_COLORS.on_control },
            { key: 'in_progress', name: 'В процессе', color: MONITORING_ADDITIONAL_STATUS_COLORS.in_progress },
            { key: 'deadline_violated', name: 'Срок нарушен', color: MONITORING_ADDITIONAL_STATUS_COLORS.deadline_violated },
          ],
          xKey: 'name',
          showLegend: true,
          showStackTotal: true,
          layout: 'vertical',
          categoryWidth: 128,
        }),
      );
    } else if (sectionId === 'auditorDocuments') {
      drafts.push(
        draft(kind, sectionId, 'Документная дисциплина по сотрудникам', caption, SIZE.matrix, {
          chart: 'auditor-documents-matrix',
          rows: input.auditorDocuments,
        }),
      );
    } else if (sectionId === 'checkLifecycle') {
      drafts.push(
        draft(kind, sectionId, 'Жизненный цикл проверки: от приказа до ДЗ', caption, SIZE.matrix, {
          chart: 'check-lifecycle',
          rows: input.checkLifecycle,
        }),
      );
    }
  }

  return drafts;
}
