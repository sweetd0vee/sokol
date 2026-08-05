import type { MaterialityLevel } from '../types/recommendation';
import type { ObservationStatus } from '../types/observation';

export type DemoObservationSeed = {
  id: string;
  number: string;
  chapter: string;
  chapter_title: string;
  name: string;
  materiality_level: MaterialityLevel;
  deadline: string;
  status: ObservationStatus;
};

export const DEMO_OBSERVATION_SEEDS: DemoObservationSeed[] = [
  {
    id: 'OBS-001',
    number: '4.1',
    chapter: '4',
    chapter_title: 'Анализ организации работы по привлечению клиентов сегментов Средний+',
    name: 'Необходимость уточнения показателей нагрузки менеджеров клиентского сервиса',
    materiality_level: 'средний',
    deadline: '2025-04-01',
    status: 'in_progress',
  },
  {
    id: 'OBS-002',
    number: '4.2',
    chapter: '4',
    chapter_title: 'Анализ организации работы по привлечению клиентов сегментов Средний+',
    name: 'Дефекты в приложении Qlik Sense при расчете метрик продуктового проникновения',
    materiality_level: 'средний',
    deadline: '2026-06-01',
    status: 'open',
  },
  {
    id: 'OBS-003',
    number: '4.3',
    chapter: '4',
    chapter_title: 'Анализ организации работы по привлечению клиентов сегментов Средний+',
    name: 'Конкретизация дальнейшего использования результатов анализа продуктового проникновения в ЛПА',
    materiality_level: 'средний',
    deadline: '2026-06-01',
    status: 'open',
  },
  {
    id: 'OBS-004',
    number: '4.4',
    chapter: '4',
    chapter_title: 'Анализ организации работы по привлечению клиентов сегментов Средний+',
    name: 'Увеличение продуктового проникновения клиентов Средний+',
    materiality_level: 'низкий',
    deadline: '2026-09-01',
    status: 'in_progress',
  },
  {
    id: 'OBS-005',
    number: '5.1',
    chapter: '5',
    chapter_title: 'Анализ доходности клиентов сегментов Средний+',
    name: 'Договоры с отрицательной EVA, не перекрываемой некредитным доходом',
    materiality_level: 'средний',
    deadline: '2026-07-01',
    status: 'open',
  },
  {
    id: 'OBS-006',
    number: '5.2',
    chapter: '5',
    chapter_title: 'Анализ доходности клиентов сегментов Средний+',
    name: 'Договоры с отрицательной валовой маржой, не перекрываемой некредитным доходом',
    materiality_level: 'средний',
    deadline: '2026-07-01',
    status: 'open',
  },
  {
    id: 'OBS-007',
    number: '5.3',
    chapter: '5',
    chapter_title: 'Анализ доходности клиентов сегментов Средний+',
    name: 'Кредитные сделки с отрицательным финансовым результатом',
    materiality_level: 'средний',
    deadline: '2026-04-01',
    status: 'in_progress',
  },
  {
    id: 'OBS-008',
    number: '5.4',
    chapter: '5',
    chapter_title: 'Анализ доходности клиентов сегментов Средний+',
    name: 'Клиенты с отрицательной доходностью и необходимость активизации работы по увеличению доходности',
    materiality_level: 'средний',
    deadline: '2026-02-01',
    status: 'closed',
  },
  {
    id: 'OBS-009',
    number: '5.5',
    chapter: '5',
    chapter_title: 'Анализ доходности клиентов сегментов Средний+',
    name: 'Доработка алгоритмов расчета доходности клиента в ЦХД Teradata и корпоративном OLAP-кубе',
    materiality_level: 'средний',
    deadline: '2026-05-01',
    status: 'in_progress',
  },
  {
    id: 'OBS-010',
    number: '9.1',
    chapter: '9',
    chapter_title: 'Анализ качества обслуживания клиентов и результаты маркетинговых исследований',
    name: 'Проведение маркетинговых исследований по сегменту Средний+',
    materiality_level: 'низкий',
    deadline: '2026-06-01',
    status: 'open',
  },
];
