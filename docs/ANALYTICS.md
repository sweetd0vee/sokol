# Аналитика, планирование, конструктор

Агрегаты считает backend по всей БД (без лимита list API), SQL WHERE уходит в PostgreSQL (`services/analytics/sql_filters.py`). Отдельных таблиц-витрин нет. Поля ответа — camelCase (`serialization_alias`). Bearer обязателен.

Клиент: `src/api/analytics.ts`. Схемы: `app/schemas/analytics.py`.

## API

| Раздел | Endpoint | Период | Фильтры UI |
|--------|----------|--------|------------|
| Проверки | `GET /analytics/checks` | `checks.start_date` | год / квартал, аудиторы, департаменты |
| Рекомендации | `GET /analytics/recommendations` | `deadline` | то же |
| Мониторинг | `GET /analytics/monitoring` | `deadline` | то же |
| ДВА | `GET /analytics/dva` | checks `start_date` + rec `deadline` | то же |
| Планирование | `GET /analytics/planning` | `checks.start_date` | год / квартал, департаменты (**без** аудиторов) |

Query: `granularity` (`year`\|`quarter`\|`month`, default `year`); `years` / `quarters` / `months` — ключи `2025`, `2025-Q1`, `2025-08`, **OR** между измерениями; `auditors`, `departments`. Recommendations/monitoring также: `statuses`, `additionalStatuses`, `materialityLevels` — в UI не выводятся.

Месяц есть в API, в сайдбаре нет. Департаментный фильтр — `audit_object.overlap`, не junction. Фильтр аудиторов на checks: `check_leader` **или** связанный `recommendations.auditor`.

Все ответы: `universeTotal` / `filteredTotal` (у dva/planning — отдельно checks и rec), `granularity`, `filterOptions` (`auditors?`, `departments`, `anchorDates`).

## UI-каркас

- `/analytics`: два ряда вкладок (Проверки / Рекомендации, Мониторинг / ДВА). Посещённые панели остаются смонтированными (`KeepAlivePanel`).
- Каркас: `AnalyticsDashboardFrame` — сайдбар `lg:w-80` + сетка `react-grid-layout` (`static`, без drag). KPI «Итого» над сеткой.
- Bootstrap: `granularity=year`, `staleTime` 60 с, затем перезапрос при смене фильтров.
- Экспорт вкладки из сайдбара — DOM-снимок всех карточек (html / pdf / docx / xlsx). Метаданные — из ответа API.
- На карточке: чекбокс **«В конструктор»**, PNG в буфер (с фильтрами / без), fullscreen. SVG/PDF с карточки нет.
- Сайдбар: **«Добавить в конструктор (N)»** — отбор на текущий лист `/constructor`, не экспорт вкладки.
- Часть матриц и lifecycle — `expandToContent`.

Бизнес-описание со скриншотами: [SOKOL_Аналитика.docx](SOKOL_Аналитика.docx) (`npm run docs:analytics-tz:full` из `sokol-frontend` пишет сюда же).

## Проверки

Департаменты — через связанные rec (`audit_object`).

Карточки: Итого; динамика по периодам; виды; типы; карта департаментов ТОП-10; матрица оценок эффективности.

KPI: Всего, Запланировано, В процессе, Завершено, Доля завершённых.

Блоки API: `summary`, `completionShare`, `periodSeries`, `viewDistribution`, `typeDistribution`, `departmentMap`, `effectivenessMatrix`.

## Рекомендации

Карточки: Итого; динамика по периодам (существенность); существенность за период; матрица существенности; по видам проверок; карта департаментов ТОП-10.

KPI: Всего, В процессе, Не решено, Исполнено, Доля исполненных.

API extras: `withExtensions`, `withCompletionDate`, `completionRate`, `violationRate`, `periodSeries.low|medium|high`, `cumulativeCompleted`, индикаторы, `checkLinks`.

## Мониторинг

Тот же источник, срез по срокам.

Карточки: Итого; статусы; дополнительные статусы; переносы срока по проверкам; исполнено в ходе аудита по проверкам; матрица статусов.

KPI: Исполнено, В работе, На контроле, Срок нарушен, Доля просроченных.

## ДВА

Карточки UI (порядок): Итого; рекомендации по сотрудникам (**существенность**); по сотрудникам (**доп. статус**); доля «Не решено»; карта сотрудников по проверкам; жизненный цикл проверки (приказ → программа → АЗ → ДЗ).

KPI: Проверки, Рекомендации, Аудиторы, Высокая существенность, Средняя продолжительность (дн.).

Ранжированные столбцы аудиторов в UI: `DVA_AUDITOR_BAR_LIMIT = 12`.

Часть API (`treemap`, `auditorDocuments`, `portfolioSeries`, `departmentMap`, …) отдельными карточками вкладки не рендерится; часть доступна через конструктор.

### Жизненный цикл

Таблица + timeline (`CheckLifecycleChart` / `dvaAnalytics.ts`). Default sort: `totalDays` desc. Футер: число проверок + `averageLifecycleDurationDays`. Ось: ≤45 дн. — недельные `DD.MM`, иначе месячные `MM` (январь `MM.YY`), горизонтальный scroll. Карточка высокая (`maxChartArea={440}`).

DOCX-экспорт lifecycle отдаёт **табличные строки** (`buildCheckLifecycleExportRows`), не только DOM-capture.

## Планирование (`/planning`)

`PlanningAnalyticsDashboard`. Фильтр департаментов на список неохваченных **не влияет**. «Не указан» в неохваченные не входит. Список неохваченных пересчитывается при смене года/квартала.

1. **Итого** — KPI: охват %, с проверками, не охвачено (число/всего), красные рекомендации.
2. **Неохваченные департаменты** — не было rec с этим `audit_object` за период.
3. **«Не решено»** — горизонтальные столбцы по департаментам; hover — ключи проверок.
4. **Красные по департаментам** — ТОП высокой существенности; колонки Кол-во / Доля / Проверки, клик сортирует.

Visual export **включён**. Карточки можно отправить в конструктор.

API: `coverage` (rates, donut, covered/uncovered, `checksByDepartment`), `unresolvedByDepartment`, `highMaterialityByDepartment`, `highMaterialityTotal`. Метки limited/beta в UI нет.

## Конструктор (`/constructor`)

Только клиент. Серверного CRUD нет.

Библиотека `{ dashboards, activeDashboardId }` в `localStorage` (`sokol.constructor.library.v1`). Старый `sessionStorage` `sokol.analytics.constructor.v1` мигрирует в «Черновик». Провайдер на уровне приложения.

Виджет — **снимок** (`kind + sectionId + filterSnapshot + payload + layout`), не live-запрос. Один график можно добавить несколько раз с разными фильтрами. Источники: `checks` / `recommendations` / `monitoring` / `dva` / `planning`.

Сценарий: создать лист → он становится *текущим* → на аналитике/планировании отметить карточки → «Добавить в конструктор». Первое добавление без листа создаёт черновик. Холст: drag/resize 12 колонок, удаление, переименование. Запись в localStorage сразу; кнопки «Сохранить» нет. «Копировать» — новое имя. Экспорт — html/pdf/docx/xlsx с **смонтированного** холста; из истории без открытия листа снимок пустой.

Файлы: `ConstructorTab.tsx`, `constructor/ConstructorEditorPage.tsx`, `ConstructorDashboard.tsx`, `ConstructorChartBody.tsx`, `constructorLibrary.ts`, `AnalyticsConstructorContext.tsx`, `useAddToConstructor.ts`, `utils/constructor*Export*`.

Черновики виджетов собираются по разделам: `buildChecksConstructorDrafts.ts`, `buildRecommendationsConstructorDrafts.ts`, `buildMonitoringConstructorDrafts.ts`, `buildDvaConstructorDrafts.ts`, `buildPlanningConstructorDrafts.ts`. Общие размер и `draft()` — `constructorDraft.ts`. `buildConstructorWidgets.ts` только реэкспортирует эти сборщики.

Дальше до продукта (не сделано): `POST/GET/PATCH /dashboards`, хранить `kind+filters+layout` и перезапрашивать агрегаты, debounce layout, ETag/конфликты, серверный PDF.

## Ограничения

- Drill-down API и сохранённые серверные отчёты нет.
- Наблюдения в аналитике не участвуют.
- HTML-экспорт хрупок на off-screen карточках.
- Фильтры статусов/существенности в UI нет, backend принимает.
