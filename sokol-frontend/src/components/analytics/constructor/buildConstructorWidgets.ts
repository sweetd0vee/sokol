import {
  CHECKS_PALETTE,
  MONITORING_ADDITIONAL_STATUS_COLORS,
  MONITORING_STATUS_COLORS,
  RECOMMENDATIONS_MATERIALITY_CHART_COLORS,
  RECOMMENDATIONS_PALETTE,
} from '../analyticsPalette';
import type {
  ChecksConstructorInput,
  ConstructorBarPoint,
  ConstructorPayload,
  ConstructorWidgetDraft,
  DvaConstructorInput,
  MonitoringConstructorInput,
  PlanningConstructorInput,
  RecommendationsConstructorInput,
} from './constructorTypes';
import type { ConstructorSizeHint } from './constructorLayout';


const SIZE = {
  kpi: { w: 12, h: 2, minW: 6, minH: 2 },
  half: { w: 6, h: 4, minW: 3, minH: 3 },
  wide: { w: 8, h: 4, minW: 4, minH: 3 },
  treemap: { w: 8, h: 3, minW: 3, minH: 2 },
  narrow: { w: 4, h: 4, minW: 3, minH: 3 },
  full: { w: 12, h: 4, minW: 6, minH: 3 },
  matrix: { w: 12, h: 8, minW: 6, minH: 6 },
  tallHalf: { w: 6, h: 5, minW: 3, minH: 3 },
} as const satisfies Record<string, ConstructorSizeHint>;

function draft(
  kind: ConstructorWidgetDraft['kind'],
  sectionId: string,
  title: string,
  filterCaption: string,
  size: ConstructorSizeHint,
  payload: ConstructorPayload,
): ConstructorWidgetDraft {
  return { kind, sectionId, title, description: '', filterCaption, size, payload };
}

function barPointsFromNamed(items: Array<{ name: string; value: number }>): ConstructorBarPoint[] {
  return items.map((item) => ({ label: item.name, value: item.value }));
}

export function buildChecksConstructorDrafts(input: ChecksConstructorInput): ConstructorWidgetDraft[] {
  const drafts: ConstructorWidgetDraft[] = [];
  const { filterCaption: caption } = input;
  const kind = 'checks' as const;

  for (const sectionId of input.selectedSections) {
    if (sectionId === 'summary') {
      drafts.push(
        draft(kind, sectionId, 'Итого по проверкам', caption, SIZE.kpi, {
          chart: 'kpi',
          columns: 5,
          items: [
            { label: 'Всего', value: input.summary.total, hint: `из ${input.universeTotal}`, tone: 'blue' },
            { label: 'Запланировано', value: input.summary.not_started, tone: 'slate' },
            {
              label: 'В процессе',
              value: input.summary.in_progress,
              accentColor: MONITORING_STATUS_COLORS.in_progress,
            },
            { label: 'Завершено', value: input.summary.completed, accentColor: MONITORING_STATUS_COLORS.completed },
            {
              label: 'Доля завершённых',
              value: input.completionShare,
              suffix: '%',
              accentColor: MONITORING_STATUS_COLORS.completed,
            },
          ],
        }),
      );
    } else if (sectionId === 'dynamics') {
      drafts.push(
        draft(kind, sectionId, 'Динамика количества проверок по периодам', caption, SIZE.wide, {
          chart: 'bar',
          variant: 'columns',
          data: input.flowSeries.map((item) => ({ label: item.label, value: item.total })),
          colors: input.flowColors,
          seriesName: 'За период',
          granularity: input.granularity,
        }),
      );
    } else if (sectionId === 'views') {
      drafts.push(
        draft(kind, sectionId, 'Виды проверок за период', caption, SIZE.half, {
          chart: 'bar',
          variant: 'bars',
          data: barPointsFromNamed(input.viewDistribution),
          colors: input.viewColors,
          seriesName: 'Проверки',
          categoryWidth: 92,
        }),
      );
    } else if (sectionId === 'types') {
      drafts.push(
        draft(kind, sectionId, 'Типы проверок за период', caption, SIZE.narrow, {
          chart: 'donut',
          data: input.typeDistribution,
          colorByValue: true,
          labelMode: 'both',
          legendPercentFirst: true,
        }),
      );
    } else if (sectionId === 'departmentMap') {
      drafts.push(
        draft(kind, sectionId, 'Карта департаментов по проверкам (ТОП-10)', caption, SIZE.treemap, {
          chart: 'treemap',
          data: input.departmentMapTop,
          palette: 'blue',
        }),
      );
    } else if (sectionId === 'effectivenessMatrix') {
      drafts.push(
        draft(kind, sectionId, 'Матрица оценок эффективности', caption, SIZE.matrix, {
          chart: 'effectiveness-matrix',
          rows: input.effectivenessMatrix,
        }),
      );
    }
  }

  return drafts;
}

export function buildRecommendationsConstructorDrafts(
  input: RecommendationsConstructorInput,
): ConstructorWidgetDraft[] {
  const drafts: ConstructorWidgetDraft[] = [];
  const { filterCaption: caption } = input;
  const kind = 'recommendations' as const;

  for (const sectionId of input.selectedSections) {
    if (sectionId === 'summary') {
      drafts.push(
        draft(kind, sectionId, 'Итого по рекомендациям', caption, SIZE.kpi, {
          chart: 'kpi',
          columns: 5,
          items: [
            {
              label: 'Всего',
              value: input.summary.total,
              hint: `из ${input.universeTotal}`,
              tone: 'slate',
            },
            {
              label: 'В процессе',
              value: input.summary.byStatus.in_progress,
              accentColor: MONITORING_STATUS_COLORS.in_progress,
            },
            {
              label: 'Не решено',
              value: input.summary.byStatus.unresolved,
              accentColor: MONITORING_STATUS_COLORS.unresolved,
            },
            {
              label: 'Исполнено',
              value: input.summary.byStatus.completed,
              accentColor: MONITORING_STATUS_COLORS.completed,
            },
            {
              label: 'Доля исполненных',
              value: input.summary.completionRate,
              suffix: '%',
              accentColor: MONITORING_STATUS_COLORS.completed,
            },
          ],
        }),
      );
    } else if (sectionId === 'materialityByPeriod') {
      drafts.push(
        draft(kind, sectionId, 'Динамика количества рекомендаций по периодам (существенность)', caption, SIZE.wide, {
          chart: 'stacked',
          data: input.completedPeriodSeries,
          series: [
            { key: 'low', name: 'Низкий', color: RECOMMENDATIONS_MATERIALITY_CHART_COLORS.низкий },
            { key: 'medium', name: 'Средний', color: RECOMMENDATIONS_MATERIALITY_CHART_COLORS.средний },
            { key: 'high', name: 'Высокий', color: RECOMMENDATIONS_MATERIALITY_CHART_COLORS.высокий },
          ],
          xKey: 'label',
          showLegend: true,
          showStackTotal: true,
          granularity: input.granularity,
        }),
      );
    } else if (sectionId === 'materiality') {
      drafts.push(
        draft(kind, sectionId, 'Существенность рекомендаций за период', caption, SIZE.narrow, {
          chart: 'donut',
          data: input.coloredMaterialityDistribution,
          labelMode: 'both',
        }),
      );
    } else if (sectionId === 'views') {
      drafts.push(
        draft(kind, sectionId, 'Количество рекомендаций по каждому виду проверок', caption, SIZE.half, {
          chart: 'bar',
          variant: 'bars',
          data: barPointsFromNamed(input.viewDistribution),
          colors: input.viewColors,
          seriesName: 'Рекомендации',
          categoryWidth: 92,
        }),
      );
    } else if (sectionId === 'materialityMatrix') {
      drafts.push(
        draft(kind, sectionId, 'Матрица существенности рекомендаций', caption, SIZE.matrix, {
          chart: 'materiality-matrix',
          rows: input.materialityMatrix,
        }),
      );
    } else if (sectionId === 'objects') {
      drafts.push(
        draft(kind, sectionId, 'Карта департаментов по рекомендациям (ТОП-10)', caption, SIZE.half, {
          chart: 'treemap',
          data: input.objectDistributionTop,
          palette: 'teal',
        }),
      );
    }
  }

  return drafts;
}

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
        draft(kind, sectionId, 'Карта сотрудников по проверкам', caption, SIZE.treemap, {
          chart: 'treemap',
          data: input.auditorChecksMap,
          palette: 'indigo',
        }),
      );
    } else if (sectionId === 'auditorImpact') {
      drafts.push(
        draft(kind, sectionId, 'Существенность рекомендаций по сотрудникам', caption, SIZE.half, {
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
        draft(kind, sectionId, 'Своевременность исполнения рекомендаций по сотрудникам (дополнительный статус)', caption, SIZE.half, {
          chart: 'stacked',
          data: input.auditorTimeliness,
          series: [
            { key: 'on_time', name: 'В срок', color: MONITORING_ADDITIONAL_STATUS_COLORS.on_time },
            { key: 'on_control', name: 'На контроле', color: MONITORING_ADDITIONAL_STATUS_COLORS.on_control },
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

const PLANNING_HIGH_MATERIALITY_COLOR = '#FF4347';

export function buildPlanningConstructorDrafts(input: PlanningConstructorInput): ConstructorWidgetDraft[] {
  const drafts: ConstructorWidgetDraft[] = [];
  const { filterCaption: caption } = input;
  const kind = 'planning' as const;

  for (const sectionId of input.selectedSections) {
    if (sectionId === 'summary') {
      drafts.push(
        draft(kind, sectionId, 'Итого планирования', caption, SIZE.kpi, {
          chart: 'kpi',
          columns: 4,
          items: [
            { label: 'Охват департаментов', value: input.coverage.coverageRate, suffix: '%', tone: 'blue' },
            {
              label: 'С проверками',
              value: input.coverage.covered,
              hint: `из ${input.coverage.total}`,
              tone: 'green',
            },
            { label: 'Не охвачено', value: input.coverage.uncoveredRate, suffix: '%', tone: 'slate' },
            { label: 'Красные рекомендации', value: input.highMaterialityTotal, tone: 'red' },
          ],
        }),
      );
    } else if (sectionId === 'coverage') {
      drafts.push(
        draft(kind, sectionId, 'Неохваченные департаменты', caption, { w: 6, h: 3, minW: 3, minH: 2 }, {
          chart: 'list',
          items: input.coverage.uncoveredDepartments,
          emptyMessage: 'Все департаменты охвачены проверками за выбранный период',
          footer: `Не охвачено: ${input.coverage.uncovered} из ${input.coverage.total} (${input.coverage.uncoveredRate}%)`,
        }),
      );
    } else if (sectionId === 'departmentAnalytics') {
      drafts.push(
        draft(kind, sectionId, 'Проверки и рекомендации по департаментам', caption, SIZE.tallHalf, {
          chart: 'stacked',
          data: input.departmentAnalytics.map((item) => ({
            name: item.name,
            checks: item.checks,
            recommendations: item.recommendations,
          })),
          series: [
            { key: 'checks', name: 'Проверки', color: CHECKS_PALETTE[8] },
            { key: 'recommendations', name: 'Рекомендации', color: RECOMMENDATIONS_PALETTE[2] },
          ],
          xKey: 'name',
          showLegend: true,
          layout: 'vertical',
          grouped: true,
          categoryWidth: 120,
        }),
      );
    } else if (sectionId === 'highMateriality') {
      drafts.push(
        draft(kind, sectionId, 'Рекомендации высокой существенности по департаментам', caption, SIZE.full, {
          chart: 'bar',
          variant: 'bars',
          data: barPointsFromNamed(input.highMaterialityRanking),
          colors: input.highMaterialityRanking.map(() => PLANNING_HIGH_MATERIALITY_COLOR),
          seriesName: 'Высокая существенность',
          categoryWidth: 140,
        }),
      );
    }
  }

  return drafts;
}
