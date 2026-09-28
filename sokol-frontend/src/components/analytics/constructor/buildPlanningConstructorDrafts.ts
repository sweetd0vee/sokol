import { SIZE, draft } from './constructorDraft';
import type { ConstructorWidgetDraft, PlanningConstructorInput } from './constructorTypes';

export function buildPlanningConstructorDrafts(input: PlanningConstructorInput): ConstructorWidgetDraft[] {
  const drafts: ConstructorWidgetDraft[] = [];
  const { filterCaption: caption } = input;
  const kind = 'planning' as const;

  for (const sectionId of input.selectedSections) {
    if (sectionId === 'summary') {
      drafts.push(
        draft(kind, sectionId, 'Итого планирования', caption, SIZE.kpi, {
          chart: 'kpi',
          columns: 3,
          items: [
            { label: 'Охват департаментов', value: input.coverage.coverageRate, suffix: '%', tone: 'blue' },
            {
              label: 'Не охвачено',
              value: input.coverage.uncovered,
              hint: `из ${input.coverage.total}`,
              tone: 'slate',
            },
            { label: 'Красные рекомендации', value: input.highMaterialityTotal, tone: 'red' },
          ],
        }),
      );
    } else if (sectionId === 'coverage') {
      drafts.push(
        draft(kind, sectionId, 'Неохваченные департаменты', caption, { w: 5, h: 4, minW: 3, minH: 3 }, {
          chart: 'list',
          items: input.coverage.uncoveredDepartments,
          emptyMessage: 'Все департаменты охвачены проверками за выбранный период',
          footer: `Не охвачено: ${input.coverage.uncovered} из ${input.coverage.total} (${input.coverage.uncoveredRate}%)`,
        }),
      );
    } else if (sectionId === 'unresolved') {
      drafts.push(
        draft(kind, sectionId, 'Рекомендации со статусом «Не решено»', caption, { w: 7, h: 4, minW: 3, minH: 3 }, {
          chart: 'department-unresolved',
          data: input.unresolvedByDepartment,
        }),
      );
    } else if (sectionId === 'highMateriality') {
      drafts.push(
        draft(kind, sectionId, 'Количество и доля красных рекомендаций по департаментам', caption, { w: 12, h: 5, minW: 6, minH: 4 }, {
          chart: 'department-high-materiality',
          data: input.highMaterialityRanking,
        }),
      );
    }
  }

  return drafts;
}
