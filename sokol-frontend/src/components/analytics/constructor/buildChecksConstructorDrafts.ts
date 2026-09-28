import { MONITORING_STATUS_COLORS } from '../analyticsPalette';
import { SIZE, barPointsFromNamed, draft } from './constructorDraft';
import type { ChecksConstructorInput, ConstructorWidgetDraft } from './constructorTypes';

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
        draft(kind, sectionId, 'Карта департаментов по количеству проверок (ТОП-10)', caption, SIZE.treemap, {
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
