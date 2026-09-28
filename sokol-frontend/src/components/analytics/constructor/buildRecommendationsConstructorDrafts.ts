import {
  MONITORING_STATUS_COLORS,
  RECOMMENDATIONS_MATERIALITY_CHART_COLORS,
} from '../analyticsPalette';
import { SIZE, barPointsFromNamed, draft } from './constructorDraft';
import type { ConstructorWidgetDraft, RecommendationsConstructorInput } from './constructorTypes';

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
        draft(kind, sectionId, 'Количество рекомендаций по видам проверок', caption, SIZE.half, {
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
        draft(kind, sectionId, 'Карта департаментов по количеству рекомендаций (ТОП-10)', caption, SIZE.half, {
          chart: 'treemap',
          data: input.objectDistributionTop,
          palette: 'blue-muted',
        }),
      );
    }
  }

  return drafts;
}
