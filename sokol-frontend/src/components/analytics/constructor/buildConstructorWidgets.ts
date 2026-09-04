import {
  CHECKS_PALETTE,
  MONITORING_ADDITIONAL_STATUS_COLORS,
  MONITORING_STATUS_COLORS,
  RECOMMENDATIONS_MATERIALITY_CHART_COLORS,
  RECOMMENDATIONS_PALETTE,
} from '../analyticsPalette';
import { RECOMMENDATION_STATUS_OPTIONS } from '../../../constants/recommendations';
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
  narrow: { w: 4, h: 4, minW: 3, minH: 3 },
  full: { w: 12, h: 4, minW: 6, minH: 3 },
  matrix: { w: 12, h: 8, minW: 6, minH: 6 },
  tallHalf: { w: 6, h: 5, minW: 3, minH: 3 },
} as const satisfies Record<string, ConstructorSizeHint>;

function draft(
  kind: ConstructorWidgetDraft['kind'],
  sectionId: string,
  title: string,
  description: string,
  filterCaption: string,
  size: ConstructorSizeHint,
  payload: ConstructorPayload,
): ConstructorWidgetDraft {
  return { kind, sectionId, title, description, filterCaption, size, payload };
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
        draft(kind, sectionId, 'Итого', 'Сводка KPI по проверкам', caption, SIZE.kpi, {
          chart: 'kpi',
          columns: 5,
          items: [
            { label: 'Всего', value: input.summary.total, hint: `из ${input.universeTotal}`, tone: 'blue' },
            { label: 'Запланировано', value: input.summary.not_started, tone: 'slate' },
            { label: 'В процессе', value: input.summary.in_progress, tone: 'amber' },
            { label: 'Завершено', value: input.summary.completed, tone: 'green' },
            { label: 'Доля завершённых', value: input.completionShare, suffix: '%', tone: 'green' },
          ],
        }),
      );
    } else if (sectionId === 'dynamics') {
      drafts.push(
        draft(kind, sectionId, 'Количество проверок', 'Динамика количества проверок за период', caption, SIZE.wide, {
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
        draft(kind, sectionId, 'Виды проверок', 'Количество проверок за период', caption, SIZE.half, {
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
        draft(kind, sectionId, 'Типы проверок', 'Распределение плановых, внеплановых и контрольных процедур за период', caption, SIZE.narrow, {
          chart: 'donut',
          data: input.typeDistribution,
          colorByValue: true,
          labelMode: 'both',
          legendPercentFirst: true,
        }),
      );
    } else if (sectionId === 'departmentMap') {
      drafts.push(
        draft(kind, sectionId, 'Карта департаментов (ТОП-10)', 'Количество проверок за период по департаментам', caption, SIZE.wide, {
          chart: 'treemap',
          data: input.departmentMapTop,
          palette: 'blue',
        }),
      );
    } else if (sectionId === 'effectivenessMatrix') {
      drafts.push(
        draft(kind, sectionId, 'Оценка эффективности', 'Матрица оценок по проверкам за период', caption, SIZE.matrix, {
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
  const selected = new Set(input.selectedSections);
  if (selected.has('materiality') || selected.has('materialityByPeriod')) {
    selected.delete('materiality');
    selected.delete('materialityByPeriod');
    selected.add('materialityCombined');
  }

  for (const sectionId of selected) {
    if (sectionId === 'summary') {
      drafts.push(
        draft(kind, sectionId, 'Итого', 'Сводка KPI по рекомендациям', caption, SIZE.kpi, {
          chart: 'kpi',
          columns: 5,
          items: [
            {
              label: 'Всего',
              value: input.summary.total,
              hint: `из ${input.universeTotal}`,
              accentColor: MONITORING_STATUS_COLORS.on_control,
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
    } else if (sectionId === 'statusByPeriod') {
      drafts.push(
        draft(kind, sectionId, 'Статусы по периодам', 'Распределение статусов по периодам', caption, SIZE.half, {
          chart: 'stacked',
          xKey: 'label',
          data: input.completedPeriodSeries as unknown as Array<Record<string, string | number>>,
          series: RECOMMENDATION_STATUS_OPTIONS.map((status) => ({
            key: status.value,
            name: status.label,
            color: MONITORING_STATUS_COLORS[status.value],
          })),
          granularity: input.granularity,
          showLegend: true,
          showStackTotal: true,
        }),
      );
    } else if (sectionId === 'materialityCombined') {
      drafts.push(
        draft(
          kind,
          sectionId,
          'Существенность',
          'Распределение уровней существенности рекомендаций: за период и по периодам',
          caption,
          SIZE.full,
          {
            chart: 'materiality-combined',
            donut: input.coloredMaterialityDistribution,
            series: input.completedPeriodSeries,
            granularity: input.granularity,
          },
        ),
      );
    } else if (sectionId === 'materialityMatrix') {
      drafts.push(
        draft(kind, sectionId, 'Матрица существенности', '', caption, SIZE.matrix, {
          chart: 'materiality-matrix',
          rows: input.materialityMatrix,
        }),
      );
    } else if (sectionId === 'objects') {
      drafts.push(
        draft(kind, sectionId, 'Карта департаментов (ТОП-10)', 'Количество рекомендаций за период по департаментам', caption, SIZE.half, {
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
        draft(kind, sectionId, 'Итого', 'Сводка KPI по мониторингу', caption, SIZE.kpi, {
          chart: 'kpi',
          columns: 5,
          items: [
            { label: 'Исполнено', value: input.summary.byStatus.completed, accentColor: MONITORING_STATUS_COLORS.completed },
            { label: 'В работе', value: input.summary.byStatus.in_progress, accentColor: MONITORING_STATUS_COLORS.in_progress },
            { label: 'На контроле', value: input.summary.byStatus.on_control, accentColor: MONITORING_STATUS_COLORS.on_control },
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
        draft(kind, sectionId, 'Статусы', 'Распределение статусов за период', caption, SIZE.half, {
          chart: 'circles',
          data: input.coloredStatusDistribution,
          legendLayout: 'row',
        }),
      );
    } else if (sectionId === 'additionalStatuses') {
      drafts.push(
        draft(kind, sectionId, 'Дополнительные статусы', 'Распределение дополнительных статусов за период', caption, SIZE.half, {
          chart: 'donut',
          data: input.coloredAdditionalStatusDistribution,
          variant: 'ring',
          labelMode: 'both',
          legendLayout: 'row',
        }),
      );
    } else if (sectionId === 'deadlineExtensions') {
      drafts.push(
        draft(kind, sectionId, 'Перенос срока', 'Количество переносов срока за период', caption, SIZE.tallHalf, {
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
        draft(
          kind,
          sectionId,
          'Исполнено в ходе аудита',
          'Количество рекомендаций со статусом «исполнено в ходе аудита» по проверкам за период',
          caption,
          SIZE.tallHalf,
          {
            chart: 'check-bars',
            variant: 'bars',
            data: input.completedDuringAuditByCheck,
            colors: input.completedDuringAuditColors,
            shortNames: input.completedDuringAuditShortNames,
            seriesName: 'Рекомендаций',
          },
        ),
      );
    } else if (sectionId === 'statusMatrix') {
      drafts.push(
        draft(kind, sectionId, 'Матрица статусов', 'Матрица статусов по проверкам за период', caption, SIZE.matrix, {
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
        draft(kind, sectionId, 'Итого', 'Сводка KPI ДВА', caption, SIZE.kpi, {
          chart: 'kpi',
          columns: 6,
          items: [
            { label: 'Проверки', value: input.checkTotal, tone: 'blue' },
            { label: 'Рекомендации', value: input.recTotal, tone: 'slate' },
            { label: 'Аудиторы', value: input.employeeCount, tone: 'indigo' },
            {
              label: 'Высокая существенность',
              value: input.highMateriality,
              hint: `${input.highMaterialityShare}% рекомендаций`,
              accentColor: RECOMMENDATIONS_MATERIALITY_CHART_COLORS.высокий,
            },
            {
              label: 'Исполнение',
              value: input.recCompletionRate,
              suffix: '%',
              accentColor: MONITORING_STATUS_COLORS.completed,
            },
            {
              label: 'Нарушение сроков',
              value: input.recViolationRate,
              suffix: '%',
              accentColor: MONITORING_ADDITIONAL_STATUS_COLORS.deadline_violated,
            },
          ],
        }),
      );
    } else if (sectionId === 'auditorChecksMap') {
      drafts.push(
        draft(kind, sectionId, 'Карта сотрудников по проверкам', 'Количество проверок за период по всем сотрудникам ДВА', caption, SIZE.half, {
          chart: 'treemap',
          data: input.auditorChecksMap,
          palette: 'indigo',
        }),
      );
    } else if (sectionId === 'auditorImpact') {
      drafts.push(
        draft(kind, sectionId, 'Импакт рекомендаций', 'Существенность находок: кто выявляет наиболее значимые риски', caption, SIZE.half, {
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
        draft(kind, sectionId, 'Результативность исполнения', 'Статус рекомендаций сотрудника: закрытие vs открытый хвост', caption, SIZE.half, {
          chart: 'stacked',
          data: input.auditorExecution,
          series: [
            { key: 'completed', name: 'Исполнено', color: MONITORING_STATUS_COLORS.completed },
            { key: 'in_progress', name: 'В процессе', color: MONITORING_STATUS_COLORS.in_progress },
            { key: 'on_control', name: 'На контроле', color: MONITORING_STATUS_COLORS.on_control },
            { key: 'unresolved', name: 'Не решено', color: MONITORING_STATUS_COLORS.unresolved },
          ],
          xKey: 'name',
          showLegend: true,
          showStackTotal: true,
          layout: 'vertical',
          categoryWidth: 128,
        }),
      );
    } else if (sectionId === 'auditorTimeliness') {
      drafts.push(
        draft(kind, sectionId, 'Своевременность', 'Соблюдение сроков исполнения рекомендаций по сотрудникам', caption, SIZE.half, {
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
        draft(kind, sectionId, 'Документная дисциплина', 'Готовность приказа, программы, АЗ и ДЗ по проверкам каждого сотрудника', caption, SIZE.matrix, {
          chart: 'auditor-documents-matrix',
          rows: input.auditorDocuments,
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
        draft(kind, sectionId, 'Сводка планирования', '', caption, SIZE.kpi, {
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
        draft(
          kind,
          sectionId,
          'Охват департаментов',
          'Неохваченные департаменты за выбранный период',
          caption,
          SIZE.tallHalf,
          {
            chart: 'list',
            items: input.coverage.uncoveredDepartments,
            emptyMessage: 'Все департаменты охвачены проверками за выбранный период',
            footer: `Не охвачено: ${input.coverage.uncovered} из ${input.coverage.total} (${input.coverage.uncoveredRate}%)`,
          },
        ),
      );
    } else if (sectionId === 'departmentAnalytics') {
      drafts.push(
        draft(kind, sectionId, 'Аналитика департаментов', 'Проверки и рекомендации по подразделениям', caption, SIZE.tallHalf, {
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
        draft(
          kind,
          sectionId,
          'Красные рекомендации по департаментам',
          'Подразделения с наибольшим числом рекомендаций высокой существенности',
          caption,
          SIZE.full,
          {
            chart: 'bar',
            variant: 'bars',
            data: barPointsFromNamed(input.highMaterialityRanking),
            colors: input.highMaterialityRanking.map(() => PLANNING_HIGH_MATERIALITY_COLOR),
            seriesName: 'Высокая существенность',
            categoryWidth: 140,
          },
        ),
      );
    }
  }

  return drafts;
}

