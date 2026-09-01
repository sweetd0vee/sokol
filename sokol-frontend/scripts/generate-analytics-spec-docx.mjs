/**
 * Generates sokol-frontend/docs/ANALYTICS_TZ.docx — TZ + implemented dashboards catalog.
 */
import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, '../docs');
const SCREENSHOTS_DIR = join(DOCS_DIR, 'analytics-screenshots');
const OUTPUT = join(DOCS_DIR, 'ANALYTICS_TZ.docx');

const GENERATED_AT = new Date().toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short' });

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 120 },
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, color: opts.color })],
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 160 } });
}

function bullet(text) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
}

function loadImage(filename, width = 620) {
  const path = join(SCREENSHOTS_DIR, filename);
  if (!existsSync(path)) {
    return [
      p(`[Скриншот не найден: ${filename}. Запустите npm run docs:analytics-screenshots]`, {
        italics: true,
        color: '64748B',
      }),
    ];
  }
  const data = readFileSync(path);
  const height = Math.round(width * 0.56);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 200 },
      children: [
        new ImageRun({
          data,
          transformation: { width, height },
          type: 'png',
        }),
      ],
    }),
  ];
}

const DASHBOARDS = {
  checks: [
    {
      title: 'Сводка KPI',
      id: 'summary',
      type: 'KPI-карточки',
      description: 'Общий портфель проверок за выбранный период.',
      metrics: 'Всего, запланировано, в процессе, завершено, доля завершённых (%).',
      logic: 'Агрегация по статусам проверок после фильтрации по периоду, аудитору и департаменту.',
      purpose: 'Быстрый health-check выполнения плана аудита.',
    },
    {
      title: 'Количество проверок',
      id: 'dynamics',
      type: 'Столбцы + линия (ComposedChart)',
      description: 'Динамика за период и накопительный итог.',
      metrics: '«За период» — число проверок в сроке; «Всего» — нарастающий итог.',
      logic: 'Группировка по дате начала проверки (год / квартал / месяц).',
      purpose: 'Видно, растёт ли нагрузка и в какие периоды концентрируются проверки.',
    },
    {
      title: 'Виды проверок',
      id: 'views',
      type: 'Горизонтальный bar chart',
      description: 'Распределение по видам проверок за период.',
      metrics: 'ИТ, бизнес, риски, корпоуправление, иные.',
      logic: 'Подсчёт проверок по полю check_view.',
      purpose: 'Понимание фокуса аудиторской активности.',
    },
    {
      title: 'Типы проверок',
      id: 'types',
      type: 'Круговая диаграмма (pie)',
      description: 'Плановые, внеплановые и контрольные процедуры.',
      logic: 'Подсчёт по полю check_type.',
      purpose: 'Баланс плановой и реактивной работы.',
    },
    {
      title: 'Карта департаментов',
      id: 'departmentMap',
      type: 'Tree Map',
      description: 'Количество проверок по департаментам за период.',
      logic: 'Департамент определяется через связанные рекомендации (audit_object).',
      purpose: 'География аудиторской нагрузки по подразделениям.',
    },
    {
      title: 'Оценка эффективности',
      id: 'effectivenessMatrix',
      type: 'Матрица + мини-pie по колонкам',
      description: 'Оценки эффективности по проверкам за период.',
      metrics: 'Процесс, СВК, СУР, СВИК.',
      logic: 'Строка = проверка; цвет ячейки по шкале эффективности.',
      purpose: 'Сопоставление результатов проверок и их качественной оценки.',
    },
  ],
  recommendations: [
    {
      title: 'Сводка KPI',
      id: 'summary',
      type: 'KPI-карточки',
      metrics: 'Всего, исполнено, не решено, высокая существенность, % исполнения, % нарушения срока.',
      purpose: 'Управленческая оценка риска и дисциплины исполнения.',
    },
    {
      title: 'Количество рекомендаций',
      id: 'cumulative',
      type: 'Столбцы + линия',
      description: 'Динамика и накопительный итог.',
      logic: 'Группировка по сроку исполнения рекомендации.',
      purpose: 'Сколько рекомендаций появляется и как растёт общий объём.',
    },
    {
      title: 'Статусы по периодам',
      id: 'statusByPeriod',
      type: 'Stacked bar',
      purpose: 'Периоды с большой долей нерешённых рекомендаций.',
    },
    {
      title: 'Существенность по периодам',
      id: 'materialityByPeriod',
      type: 'Stacked bar',
      purpose: 'Периоды с высокой концентрацией значимых рисков.',
    },
    {
      title: 'Существенность',
      id: 'materiality',
      type: 'Pie chart',
      purpose: 'Общий риск-профиль портфеля.',
    },
    {
      title: 'Индикаторы',
      id: 'indicators',
      type: 'Pie chart',
      purpose: '«Светофор» состояния портфеля по индикаторам таблицы.',
    },
    {
      title: 'Карта департаментов',
      id: 'objects',
      type: 'Tree Map',
      purpose: 'Подразделения с максимальной концентрацией замечаний.',
    },
    {
      title: 'Матрица существенности',
      id: 'materialityMatrix',
      type: 'Матрица',
      purpose: 'Количество рекомендаций высокого, среднего и низкого уровня существенности по каждой проверке за период.',
    },
  ],
  monitoring: [
    {
      title: 'Сводка KPI',
      id: 'summary',
      type: 'KPI-карточки',
      metrics: 'На контроле, срок нарушен, исполнено, в работе, % просрочки.',
      purpose: 'Оперативный статус мониторинга исполнения.',
    },
    {
      title: 'Динамика сроков исполнения',
      id: 'deadlineDynamics',
      type: 'Stacked bar по периодам',
      purpose: 'Когда и в каком статусе находятся обязательства.',
    },
    {
      title: 'Статусы',
      id: 'statuses',
      type: 'Pie chart',
      purpose: 'Контроль стадий жизненного цикла рекомендаций.',
    },
    {
      title: 'Срок исполнения',
      id: 'additionalStatuses',
      type: 'Pie chart',
      metrics: 'В срок, срок нарушен, на контроле.',
      purpose: 'Контроль дисциплины дедлайнов.',
    },
    {
      title: 'Перенос срока',
      id: 'deadlineExtensions',
      type: 'Столбчатая диаграмма по проверкам',
      purpose: 'Количество переносов срока по каждой проверке за период.',
    },
    {
      title: 'Исполнено в ходе аудита',
      id: 'completedDuringAudit',
      type: 'Горизонтальные бары по проверкам',
      purpose: 'Количество рекомендаций со статусом «исполнено в ходе аудита» по каждой проверке за период.',
    },
    {
      title: 'Матрица статусов',
      id: 'statusMatrix',
      type: 'Матрица',
      purpose: 'Распределение статусов рекомендаций по проверкам за период.',
    },
  ],
  dva: [
    {
      title: 'Сводка KPI',
      id: 'summary',
      type: 'KPI-карточки',
      metrics: 'Проверки, рекомендации, аудиторы, объекты аудита, завершённость, исполнение рекомендаций.',
      purpose: 'Executive summary по портфелю ДВА.',
    },
    {
      title: 'Портфель проверок и рекомендаций',
      id: 'portfolio',
      type: 'Столбцы + линия',
      purpose: 'Сопоставление активности проверок и хвоста рекомендаций.',
    },
    {
      title: 'Нагрузка аудиторов: проверки',
      id: 'auditorLoadChecks',
      type: 'Horizontal bar',
      metrics: 'Проверки (руководитель) за период.',
      purpose: 'Балансировка нагрузки по проверкам.',
    },
    {
      title: 'Нагрузка аудиторов: рекомендации',
      id: 'auditorLoadRecommendations',
      type: 'Horizontal bar',
      metrics: 'Рекомендации (аудитор) за период.',
      purpose: 'Балансировка нагрузки по рекомендациям.',
    },
    {
      title: 'Документы и закрытие',
      id: 'documentsClosure',
      type: 'Stacked bar',
      purpose: 'Готовность документов проверок и закрытие рекомендаций.',
    },
    {
      title: 'Карта аудиторов по количеству проверок',
      id: 'auditorChecksTreemap',
      type: 'Tree Map',
      purpose: 'Перекосы нагрузки по проверкам.',
    },
    {
      title: 'Карта аудиторов по количеству рекомендаций',
      id: 'auditorRecommendationsTreemap',
      type: 'Tree Map',
      purpose: 'Перекосы нагрузки по рекомендациям.',
    },
  ],
};

function dashboardSection(tabTitle, tabKey, screenshotFile, items) {
  const blocks = [
    heading(`Вкладка «${tabTitle}»`, HeadingLevel.HEADING_2),
    p('Скриншот текущей реализации вкладки:'),
    ...loadImage(screenshotFile),
  ];

  items.forEach((item, index) => {
    blocks.push(heading(`${index + 1}. ${item.title}`, HeadingLevel.HEADING_3));
    blocks.push(p(`ID экспорта: ${item.id}`));
    blocks.push(p(`Тип: ${item.type}`));
    if (item.description) blocks.push(p(`Описание: ${item.description}`));
    if (item.metrics) blocks.push(p(`Показатели: ${item.metrics}`));
    if (item.logic) blocks.push(p(`Логика: ${item.logic}`));
    blocks.push(p(`Бизнес-смысл: ${item.purpose}`));
  });

  return blocks;
}

const metaTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({
      children: [
        new TableCell({ children: [p('Документ', { bold: true })] }),
        new TableCell({ children: [p('Техническое задание — раздел «Аналитика»')] }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({ children: [p('Система', { bold: true })] }),
        new TableCell({ children: [p('АС SOKOL')] }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({ children: [p('Маршрут UI', { bold: true })] }),
        new TableCell({ children: [p('/analytics')] }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({ children: [p('Статус', { bold: true })] }),
        new TableCell({ children: [p('Реализовано (клиентская аналитика v1). Документ для уточнения ТЗ.')] }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({ children: [p('Сформировано', { bold: true })] }),
        new TableCell({ children: [p(GENERATED_AT)] }),
      ],
    }),
  ],
});

const doc = new Document({
  creator: 'SOKOL',
  title: 'Техническое задание — Аналитика',
  description: 'Описание реализованных дашбордов раздела Аналитика',
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          text: 'Техническое задание',
          heading: HeadingLevel.TITLE,
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Раздел «Аналитика» АС SOKOL', size: 28 })],
          spacing: { after: 240 },
        }),
        metaTable,
        p(''),
        heading('1. Назначение документа'),
        p(
          'Документ фиксирует текущую реализацию раздела «Аналитика» и служит основой для уточнения технического задания. Отметьте в комментариях, что нужно изменить — формулировки, состав дашбордов, фильтры или логику расчёта.',
        ),
        heading('2. Общие требования (реализовано)'),
        bullet('Четыре вкладки: Проверки, Рекомендации, Мониторинг, ДВА.'),
        bullet('Боковая панель «Метрики»: период (год / квартал / месяц), аудиторы, департаменты.'),
        bullet('Периодичность графиков определяется выбранным срезом (месяц → месяцы, квартал → кварталы, иначе год).'),
        bullet('Статическая сетка карточек без drag-and-drop и сохранения layout.'),
        bullet('Экспорт выбранных секций: XLSX, PDF, DOCX, HTML (из боковой панели).'),
        bullet('Данные: checks (до 500) и recommendations (до 1000) из SokolDataContext; агрегация в браузере.'),
        heading('3. Фильтры'),
        bullet('Период: мультивыбор дат в формате 01.MM.YYYY.'),
        bullet('Аудиторы: фильтрация по руководителю проверки / аудитору и менеджеру рекомендации.'),
        bullet('Департаменты: объекты аудита (audit_object) из рекомендаций.'),
        bullet('Рекомендации (доп.): существенность, основной и дополнительный статус.'),
        heading('4. Реализованные дашборды'),
        ...dashboardSection('Проверки', 'checks', 'tab-checks.png', DASHBOARDS.checks),
        ...dashboardSection('Рекомендации', 'recommendations', 'tab-recommendations.png', DASHBOARDS.recommendations),
        ...dashboardSection('Мониторинг', 'monitoring', 'tab-monitoring.png', DASHBOARDS.monitoring),
        ...dashboardSection('ДВА', 'dva', 'tab-dva.png', DASHBOARDS.dva),
        heading('5. Экспорт'),
        bullet('Проверки и рекомендации — специализированные экспортеры с таблицами и визуальными отчётами.'),
        bullet('Мониторинг и ДВА — generic visual export по выбранным карточкам.'),
        bullet('Каждая карточка может быть включена в отчёт чекбоксом «В отчёт».'),
        heading('6. Ограничения текущей версии'),
        bullet('Нет server-side analytics API и drill-down.'),
        bullet('Объём данных ограничен загруженными записями.'),
        bullet('Наблюдения не участвуют в аналитике.'),
        heading('7. Вопросы для уточнения ТЗ'),
        bullet('Нужны ли дополнительные вкладки или дашборды?'),
        bullet('Корректна ли логика привязки департаментов к проверкам через рекомендации?'),
        bullet('Какие KPI обязательны для каждой вкладки?'),
        bullet('Нужен ли отдельный справочник департаментов для охвата (вкладка «Планирование»)?'),
        bullet('Какие форматы и состав экспорта должны быть в финальной версии?'),
        p(''),
        p('Для обновления скриншотов: npm run docs:analytics-screenshots', { italics: true, color: '64748B' }),
        p('Для пересборки документа: npm run docs:analytics-tz', { italics: true, color: '64748B' }),
      ],
    },
  ],
});

mkdirSync(SCREENSHOTS_DIR, { recursive: true });
mkdirSync(DOCS_DIR, { recursive: true });

const buffer = await Packer.toBuffer(doc);
writeFileSync(OUTPUT, buffer);
console.log(`Written ${OUTPUT}`);
