import { describe, expect, it } from 'vitest';
import {
  buildCumulativeSeries,
  buildPeriodSeries,
  filterRecommendationsForAnalytics,
} from './recommendationAnalytics';
import { filterChecksForAnalytics } from './checkAnalytics';
import { parseDateValue } from './dates';
import {
  collectCalendarPeriodOptions,
  isDateInAnySelectedPeriods,
  labelFromPeriodKey,
  periodKeysFromLabels,
} from './analyticsPeriod';
import type { Recommendation } from '../types/recommendation';
import type { Check } from '../types/check';

function ms(year: number, monthIndex = 0, day = 15) {
  return new Date(year, monthIndex, day).getTime();
}

function isoDate(year: number, monthIndex = 0, day = 15) {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function makeRecommendation(
  overrides: Partial<Recommendation> & Pick<Recommendation, 'id' | 'deadline'>,
): Recommendation {
  return {
    serial_number: `SN-${overrides.id}`,
    sequence_number: Number(overrides.id),
    name: `Рек ${overrides.id}`,
    description: '',
    indicator: 'не указан',
    materiality_level: 'средний',
    audit_object: ['Департамент А'],
    auditor: 'Аудитор 1',
    manager: 'Менеджер 1',
    status: 'in_progress',
    additional_status: 'on_time',
    ...overrides,
  };
}

function makeCheck(overrides: Partial<Check> & Pick<Check, 'id' | 'start_date'>): Check {
  return {
    serial_number: `CHK-${overrides.id}`,
    check_name: `Проверка ${overrides.id}`,
    check_type: 'planned',
    check_view: 'Корпо',
    check_leader: 'Лидер 1',
    status: 'in_progress',
    created_at: '2025-01-01',
    ...overrides,
  };
}

const emptyRecFilters = {
  dateFrom: null as Date | null,
  dateTo: null as Date | null,
  auditors: [] as string[],
  departments: [] as string[],
  statuses: [] as Recommendation['status'][],
  additionalStatuses: [] as Recommendation['additional_status'][],
  materialityLevels: [] as Recommendation['materiality_level'][],
  granularity: 'year' as const,
  selectedPeriods: [] as string[],
  selectedYears: [] as string[],
  selectedQuarters: [] as string[],
  selectedMonths: [] as string[],
};

const emptyCheckFilters = {
  auditors: [] as string[],
  granularity: 'year' as const,
  selectedPeriods: [] as string[],
  selectedYears: [] as string[],
  selectedQuarters: [] as string[],
  selectedMonths: [] as string[],
  departments: [] as string[],
  recommendations: [] as Recommendation[],
  effectivenessArea: 'any' as const,
  selectedEffectivenessRatings: [] as string[],
};

describe('isDateInAnySelectedPeriods', () => {
  it('пустое выделение = все периоды', () => {
    expect(isDateInAnySelectedPeriods(ms(2027), { years: [], quarters: [], months: [] })).toBe(true);
  });

  it('выбор только годов не пропускает чужой год через пустые кварталы/месяцы', () => {
    expect(
      isDateInAnySelectedPeriods(ms(2027), {
        years: ['2025', '2026'],
        quarters: [],
        months: [],
      }),
    ).toBe(false);
    expect(
      isDateInAnySelectedPeriods(ms(2025), {
        years: ['2025', '2026'],
        quarters: [],
        months: [],
      }),
    ).toBe(true);
  });

  it('выбор только кварталов фильтрует корректно', () => {
    expect(
      isDateInAnySelectedPeriods(ms(2025, 0), {
        years: [],
        quarters: ['2025-Q1'],
        months: [],
      }),
    ).toBe(true);
    expect(
      isDateInAnySelectedPeriods(ms(2025, 6), {
        years: [],
        quarters: ['2025-Q1'],
        months: [],
      }),
    ).toBe(false);
  });

  it('выбор только месяцев фильтрует корректно', () => {
    expect(
      isDateInAnySelectedPeriods(ms(2025, 2), {
        years: [],
        quarters: [],
        months: ['2025-03'],
      }),
    ).toBe(true);
    expect(
      isDateInAnySelectedPeriods(ms(2025, 3), {
        years: [],
        quarters: [],
        months: ['2025-03'],
      }),
    ).toBe(false);
  });
});

describe('periodKeysFromLabels (галочки UI → ключи фильтра)', () => {
  const anchors = [ms(2025), ms(2026), ms(2027)];

  it('мапит выбранные подписи годов в ключи', () => {
    const options = collectCalendarPeriodOptions(anchors, 'year');
    const labels = options.filter((item) => item.key !== '2027').map((item) => item.label);
    expect(periodKeysFromLabels(anchors, 'year', labels)).toEqual(['2025', '2026']);
  });

  it('пустой список галочек даёт пустые ключи (= все периоды)', () => {
    expect(periodKeysFromLabels(anchors, 'year', [])).toEqual([]);
  });

  it('снятие одной галочки убирает ключ', () => {
    const options = collectCalendarPeriodOptions(anchors, 'year');
    const allLabels = options.map((item) => item.label);
    const without2026 = allLabels.filter((label) => !label.includes('2026'));
    expect(periodKeysFromLabels(anchors, 'year', without2026)).toEqual(['2025', '2027']);
  });

  it('подпись месяца строится из ключа, а не из порядка выбора', () => {
    const selectedLabels = ['01.11.2026', '01.01.2025', '01.09.2026'];
    const keys = periodKeysFromLabels(anchors, 'month', selectedLabels);

    expect(keys).toEqual(['2025-01', '2026-09', '2026-11']);
    expect(keys.map((key) => labelFromPeriodKey(key, 'month'))).toEqual([
      '01.01.2025',
      '01.09.2026',
      '01.11.2026',
    ]);
  });
});

describe('filterRecommendationsForAnalytics — интерактивность дат', () => {
  const recommendations = [
    makeRecommendation({ id: '1', deadline: isoDate(2025, 2) }),
    makeRecommendation({ id: '2', deadline: isoDate(2026, 5) }),
    makeRecommendation({ id: '3', deadline: isoDate(2027, 0) }),
    makeRecommendation({ id: '4', deadline: isoDate(2027, 8) }),
  ];

  it('без галочек возвращает все записи с валидным сроком', () => {
    const filtered = filterRecommendationsForAnalytics(recommendations, emptyRecFilters);
    expect(filtered.map((item) => item.id)).toEqual(['1', '2', '3', '4']);
  });

  it('две галочки годов оставляют только эти годы (сценарий бага 2 из 3)', () => {
    const filtered = filterRecommendationsForAnalytics(recommendations, {
      ...emptyRecFilters,
      selectedYears: ['2025', '2026'],
    });
    expect(filtered.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('график периодов после фильтра не содержит снятый год', () => {
    const filtered = filterRecommendationsForAnalytics(recommendations, {
      ...emptyRecFilters,
      selectedYears: ['2025', '2026'],
    });
    const series = buildPeriodSeries(filtered, 'year');
    expect(series.map((item) => item.key)).toEqual(['2025', '2026']);
    expect(series.find((item) => item.key === '2027')).toBeUndefined();
  });

  it('накопительный график считает итог только по выбранным годам', () => {
    const filtered = filterRecommendationsForAnalytics(recommendations, {
      ...emptyRecFilters,
      selectedYears: ['2025', '2026'],
    });
    const cumulative = buildCumulativeSeries(filtered, 'year');
    expect(cumulative.at(-1)?.cumulative).toBe(2);
  });

  it('сброс галочек снова показывает все годы', () => {
    const selected = filterRecommendationsForAnalytics(recommendations, {
      ...emptyRecFilters,
      selectedYears: ['2025'],
    });
    expect(selected).toHaveLength(1);

    const reset = filterRecommendationsForAnalytics(recommendations, {
      ...emptyRecFilters,
      selectedYears: [],
    });
    expect(reset).toHaveLength(4);
  });
});

describe('filterRecommendationsForAnalytics — департаменты / статусы', () => {
  const recommendations = [
    makeRecommendation({
      id: '1',
      deadline: isoDate(2025),
      audit_object: ['Финансы'],
      status: 'completed',
      materiality_level: 'высокий',
    }),
    makeRecommendation({
      id: '2',
      deadline: isoDate(2025),
      audit_object: ['ИТ'],
      status: 'unresolved',
      materiality_level: 'низкий',
    }),
    makeRecommendation({
      id: '3',
      deadline: isoDate(2025),
      audit_object: ['Финансы'],
      status: 'in_progress',
      materiality_level: 'средний',
    }),
  ];

  it('галочка департамента фильтрует объекты аудита', () => {
    const filtered = filterRecommendationsForAnalytics(recommendations, {
      ...emptyRecFilters,
      departments: ['Финансы'],
    });
    expect(filtered.map((item) => item.id)).toEqual(['1', '3']);
  });

  it('галочка департамента находит объект среди нескольких через запятую или точку с запятой', () => {
    const filtered = filterRecommendationsForAnalytics([
      makeRecommendation({
        id: 'multi-semicolon',
        deadline: isoDate(2025),
        audit_object: ['Финансы', 'ИТ'],
      }),
      makeRecommendation({
        id: 'multi-comma',
        deadline: isoDate(2025),
        audit_object: ['Бухгалтерия', 'HR'],
      }),
      makeRecommendation({
        id: 'other',
        deadline: isoDate(2025),
        audit_object: ['Юристы'],
      }),
    ], {
      ...emptyRecFilters,
      departments: ['ИТ', 'HR'],
    });

    expect(filtered.map((item) => item.id)).toEqual(['multi-semicolon', 'multi-comma']);
  });

  it('снятие всех департаментов возвращает полный набор', () => {
    const filtered = filterRecommendationsForAnalytics(recommendations, {
      ...emptyRecFilters,
      departments: [],
    });
    expect(filtered).toHaveLength(3);
  });

  it('галочка статуса фильтрует корректно', () => {
    const filtered = filterRecommendationsForAnalytics(recommendations, {
      ...emptyRecFilters,
      statuses: ['completed', 'unresolved'],
    });
    expect(filtered.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('галочка существенности фильтрует корректно', () => {
    const filtered = filterRecommendationsForAnalytics(recommendations, {
      ...emptyRecFilters,
      materialityLevels: ['высокий'],
    });
    expect(filtered.map((item) => item.id)).toEqual(['1']);
  });
});

describe('filterChecksForAnalytics — интерактивность дат', () => {
  const checks = [
    makeCheck({ id: '1', start_date: isoDate(2025, 1) }),
    makeCheck({ id: '2', start_date: isoDate(2026, 4) }),
    makeCheck({ id: '3', start_date: isoDate(2027, 0) }),
  ];

  it('две галочки годов не оставляют третий год', () => {
    const filtered = filterChecksForAnalytics(checks, {
      ...emptyCheckFilters,
      selectedYears: ['2025', '2026'],
    });
    expect(filtered.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('пустые галочки = все проверки', () => {
    const filtered = filterChecksForAnalytics(checks, emptyCheckFilters);
    expect(filtered).toHaveLength(3);
  });

  it('фильтр департамента учитывает несколько объектов в связанной рекомендации', () => {
    const filtered = filterChecksForAnalytics([
      makeCheck({ id: '1', serial_number: 'CHK-1', start_date: isoDate(2025, 1) }),
      makeCheck({ id: '2', serial_number: 'CHK-2', start_date: isoDate(2025, 1) }),
    ], {
      ...emptyCheckFilters,
      departments: ['ИТ'],
      recommendations: [
        makeRecommendation({
          id: '1',
          serial_number: 'CHK-1',
          deadline: isoDate(2025),
          audit_object: ['Финансы', 'ИТ'],
        }),
        makeRecommendation({
          id: '2',
          serial_number: 'CHK-2',
          deadline: isoDate(2025),
          audit_object: ['Юристы'],
        }),
      ],
    });

    expect(filtered.map((item) => item.id)).toEqual(['1']);
  });

  it('фильтр аудитора не учитывает руководителя объекта аудита', () => {
    const filtered = filterChecksForAnalytics(
      [
        makeCheck({ id: '1', serial_number: 'CHK-1', start_date: isoDate(2025, 1), check_leader: 'Лидер 1' }),
        makeCheck({ id: '2', serial_number: 'CHK-2', start_date: isoDate(2025, 1), check_leader: 'Лидер 2' }),
      ],
      {
        ...emptyCheckFilters,
        auditors: ['Ярмошевич И.Н., Лавренюк Р.А'],
        recommendations: [
          makeRecommendation({
            id: '1',
            serial_number: 'CHK-1',
            deadline: isoDate(2025),
            auditor: 'Аудитор 1',
            manager: 'Ярмошевич И.Н., Лавренюк Р.А',
          }),
        ],
      },
    );

    expect(filtered).toHaveLength(0);
  });

  it('фильтр аудитора находит проверку по руководителю и аудитору рекомендации', () => {
    const filtered = filterChecksForAnalytics(
      [
        makeCheck({ id: '1', serial_number: 'CHK-1', start_date: isoDate(2025, 1), check_leader: 'Ярмошевич И.Н' }),
        makeCheck({ id: '2', serial_number: 'CHK-2', start_date: isoDate(2025, 1), check_leader: 'Лидер 2' }),
      ],
      {
        ...emptyCheckFilters,
        auditors: ['Якубович В.В.'],
        recommendations: [
          makeRecommendation({
            id: '2',
            serial_number: 'CHK-2',
            deadline: isoDate(2025),
            auditor: 'Якубович В.В.',
            manager: 'Ярмошевич И.Н., Лавренюк Р.А',
          }),
        ],
      },
    );

    expect(filtered.map((item) => item.id)).toEqual(['2']);
  });
});

describe('сквозной сценарий как на дашборде (labels → keys → filter → chart)', () => {
  it('выбор 2 из 3 подписей годов убирает третий столбец с графика', () => {
    const recommendations = [
      makeRecommendation({ id: '1', deadline: isoDate(2025, 0) }),
      makeRecommendation({ id: '2', deadline: isoDate(2026, 0) }),
      makeRecommendation({ id: '3', deadline: isoDate(2027, 0) }),
      makeRecommendation({ id: '4', deadline: isoDate(2027, 6) }),
    ];
    const anchors = [
      ...recommendations.map((item) => parseDateValue(item.deadline)),
      ms(2025),
      ms(2026),
    ];
    const yearOptions = collectCalendarPeriodOptions(anchors, 'year');
    const uiSelectedLabels = yearOptions
      .filter((item) => item.label === '01.01.2025' || item.label === '01.01.2026')
      .map((item) => item.label);

    expect(uiSelectedLabels).toHaveLength(2);

    const selectedYearKeys = periodKeysFromLabels(anchors, 'year', uiSelectedLabels);
    const filtered = filterRecommendationsForAnalytics(recommendations, {
      ...emptyRecFilters,
      selectedYears: selectedYearKeys,
    });
    const chartSeries = buildCumulativeSeries(filtered, 'year');

    expect(selectedYearKeys).toEqual(['2025', '2026']);
    expect(filtered).toHaveLength(2);
    expect(chartSeries.map((item) => item.label)).toEqual(['01.01.2025', '01.01.2026']);
    expect(chartSeries.at(-1)?.cumulative).toBe(2);
  });
});
