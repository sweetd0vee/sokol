import {
  MONITORING_ADDITIONAL_STATUS_COLORS,
  MONITORING_STATUS_COLORS,
} from '../analyticsPalette';
import { SIZE, draft } from './constructorDraft';
import type { ConstructorWidgetDraft, MonitoringConstructorInput } from './constructorTypes';

export function buildMonitoringConstructorDrafts(input: MonitoringConstructorInput): ConstructorWidgetDraft[] {
  const drafts: ConstructorWidgetDraft[] = [];
  const { filterCaption: caption } = input;
  const kind = 'monitoring' as const;

  for (const sectionId of input.selectedSections) {
    if (sectionId === 'summary') {
      drafts.push(
        draft(kind, sectionId, 'Итого по мониторингу', caption, SIZE.kpi, {
          chart: 'kpi',
          columns: 5,
          items: [
            { label: 'Исполнено', value: input.summary.byStatus.completed, accentColor: MONITORING_STATUS_COLORS.completed },
            { label: 'В работе', value: input.summary.byStatus.in_progress, accentColor: MONITORING_STATUS_COLORS.in_progress },
            { label: 'На контроле', value: input.summary.byStatus.on_control, tone: 'slate' },
            {
              label: 'Срок нарушен',
              value: input.summary.byAdditional.deadline_violated,
              accentColor: MONITORING_ADDITIONAL_STATUS_COLORS.deadline_violated,
            },
            {
              label: 'Доля просроченных',
              value: input.summary.violationRate,
              suffix: '%',
              accentColor: MONITORING_ADDITIONAL_STATUS_COLORS.deadline_violated,
            },
          ],
        }),
      );
    } else if (sectionId === 'statuses') {
      drafts.push(
        draft(kind, sectionId, 'Статусы рекомендаций за период', caption, SIZE.half, {
          chart: 'circles',
          data: input.coloredStatusDistribution,
          legendLayout: 'row',
        }),
      );
    } else if (sectionId === 'additionalStatuses') {
      drafts.push(
        draft(kind, sectionId, 'Дополнительные статусы за период', caption, SIZE.narrow, {
          chart: 'donut',
          variant: 'ring',
          data: input.coloredAdditionalStatusDistribution,
          labelMode: 'both',
          legendPercentFirst: true,
        }),
      );
    } else if (sectionId === 'deadlineExtensions') {
      drafts.push(
        draft(kind, sectionId, 'Переносы срока по проверкам', caption, SIZE.tallHalf, {
          chart: 'check-bars',
          variant: 'columns',
          data: input.deadlineExtensionsByCheck,
          colors: input.deadlineExtensionColors,
          shortNames: input.deadlineExtensionShortNames,
          seriesName: 'Переносов',
        }),
      );
    } else if (sectionId === 'completedDuringAudit') {
      drafts.push(
        draft(kind, sectionId, 'Исполнено в ходе аудита по проверкам', caption, SIZE.half, {
          chart: 'check-bars',
          variant: 'bars',
          data: input.completedDuringAuditByCheck,
          colors: input.completedDuringAuditColors,
          shortNames: input.completedDuringAuditShortNames,
          seriesName: 'Рекомендаций',
        }),
      );
    } else if (sectionId === 'statusMatrix') {
      drafts.push(
        draft(kind, sectionId, 'Матрица статусов по проверкам', caption, SIZE.matrix, {
          chart: 'status-matrix',
          rows: input.statusMatrix,
        }),
      );
    }
  }

  return drafts;
}
