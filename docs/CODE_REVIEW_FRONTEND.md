# Код-ревью frontend

**Общая оценка:** 8.4 / 10 · React 19, TypeScript, Vite, TanStack Query  
**Смысл оценки:** frontend хорошо закрывает сценарии аудитора: atomic import из АЗ с undo, granular RBAC на delete/attachments, yearly ID в форме. Главные риски: hardening storage UX/экспортов и масштабирование списков при росте сверх 10000 строк.

## Архитектура

```
QueryClient → AuthProvider → SokolDataProvider → Router
api/ · components/ · contexts/ · utils/ · constants/formLayout.ts
```

**Плюсы:** feature folders, mappers, React Query, единые токены форм.

**Минусы:** god files (`exports.ts`, analytics export); нет route lazy loading; storage UX ещё требует hardening.

## Оценка по блокам

| Блок | Оценка | Что хорошо | Что ограничивает |
|------|--------|------------|------------------|
| App shell / routing | **8.5 / 10** | AuthProvider, layout и Router собраны понятно; `kantsler` оставлен как явный roadmap-задел v2 | Нет route lazy loading |
| Auth UI / API client | **8 / 10** | Login, Bearer interceptor, 401 logout, change-password и e2e успешного auth-flow закрывают базовый сценарий | Нет OIDC-flow |
| Checks workflow | **8.2 / 10** | Форма и список работают с backend; `serial_number` только читается из API; edit route fetchит check по id; list fetch errors показываются в UI | Для списков больше 10000 нужна server pagination/search |
| Recommendations workflow | **8.8 / 10** | CRUD, статусы, вложения, atomic batch import/replace, undo импорта из АЗ, RBAC delete/attachments, yearly № в форме; save/list errors показываются в UI | Для списков больше 10000 нужна server pagination/search |
| Data layer / context | **7.8 / 10** | API clients + mappers + React Query; `batch-delete` для undo в одном запросе; checks/recommendations грузятся до 10000 строк | Bulk load 10000 — осознанное ограничение пилотного объёма |
| Attachments UI | **7.5 / 10** | `canModifyAttachments` / `canRemoveSaved` по ownership; check attachments — admin only | Нужен общий banner/disabled state при недоступном MinIO |
| Analytics dashboards | **8.5 / 10** | Серверные SQL-агрегаты; единый заголовок KPI «Итого»; на вкладке проверок первая карточка «Всего» | Drill-down/server pagination для детализации |
| Exports | **6.5 / 10** | XLSX/PDF/DOCX/HTML дают быстрый value для пользователей | `exports.ts` и DOM capture хрупкие, требуют дробления |
| Planning | **7 / 10** | Dashboard подключён к backend analytics | Export выключен, модуль надо явно позиционировать как ограниченный |
| Tools / DOCX UI | **8 / 10** | UI соответствует текущему backend: section-ii, links, memorandum, parse recommendations | Нет очереди/прогресса для долгих jobs |
| UI kit / forms | **8.5 / 10** | Переиспользуемые controls, `formLayout` constants, `LIST_ACTION_GROUP_CLASS` для единых отступов фильтров | Нет Storybook/visual regression |
| Tests / lint | **8.8 / 10** | 54 Vitest проходят, lint без ошибок/warnings; form payload/API tests и Playwright auth smoke | Нет e2e CRUD flow и storage state |

## Tools

`ToolsTab` → только `DocxToolPanel`: section-ii, section-ii-links, memorandum.  
**Audit opinion UI отсутствует** (согласовано с backend — endpoint не реализован).

Upload limits из `GET /capabilities` (backend).

## State

`SokolDataContext`: checks/recommendations грузятся с limit 10000. Для ожидаемого объёма пилота это полный набор данных без truncation banner; server pagination/search нужен только при росте сверх 10000.

`CheckFormPage`: serial из API, payload не отправляет `serial_number`

`ProfilePage`: пароль меняется через `changePasswordRequest`.

## Analytics

Server aggregates в PostgreSQL. KPI-блок на всех вкладках analytics с заголовком **«Итого»**; на вкладке проверок первая карточка — **«Всего»** (не «Итого»). Visual export (xlsx/pdf/docx/html) — DOM capture хрупкий. Planning export отключён.

## Подробные findings


### FE-05 · P1 · Нет общего UX для недоступного MinIO

**Где:** `src/components/attachments/FileAttachmentsPanel.tsx`, `src/components/checks/CheckAttachmentsSection.tsx`, `src/api/capabilities.ts`.

**Симптом:** UI знает лимит загрузки через `/capabilities`, но не опрашивает `/api/v1/attachments/storage/status`. Existing `AttachmentsUnavailableNotice` используется для “сначала сохраните сущность”, а не для недоступного storage.

**Риск:** пользователь узнаёт о проблеме MinIO только после попытки загрузки. Для пилота это выглядит как случайный сбой формы, а не как инфраструктурная проблема.

**Как исправить:**

1. Добавить `src/api/attachmentsStorage.ts` или расширить existing attachments API: `fetchStorageStatus`.
2. Добавить hook `useStorageStatus` с `staleTime` и manual retry.
3. При `enabled=false`: показать “Файловое хранилище не настроено”, disable upload.
4. При `reachable=false`: показать “Файловое хранилище недоступно”, disable upload, оставить просмотр уже загруженных metadata где возможно.
5. В `ToolsTab` для DOCX upload оставить отдельный текст, если он не зависит от MinIO.

**Тесты:** component test для `FileAttachmentsPanel` при disabled/unreachable; retry вызывает refetch; кнопка upload disabled.

### FE-09 · P2 · `exports.ts` слишком крупный и хрупкий

**Где:** `src/utils/exports.ts`, `src/components/analytics/*`, `src/components/planning/PlanningAnalyticsDashboard.tsx`.

**Симптом:** export logic смешивает XLSX/PDF/DOCX/HTML и visual DOM capture. Изменение DOM/стилей может ломать экспорт без compiler сигналов.

**Риск:** отчёты — пользовательская ценность системы. Если dashboard выглядит хорошо, но экспорт пустой/кривой, ошибка обнаружится поздно.

**Как исправить:**

1. Разделить export modules: `exportXlsx`, `exportPdf`, `exportDocx`, `exportHtml`.
2. Для таблиц и KPI строить export из typed data, а не из DOM.
3. DOM capture оставить только для визуальных chart snapshots.
4. Добавить fixture data и smoke tests на каждый формат, хотя бы проверку, что файл создаётся и содержит ключевые строки.

**Тесты:** unit на builders; smoke на dashboard export с fixture.

### FE-10 · P2 · Route-level bundle не дробится

**Где:** `src/App.tsx`.

**Симптом:** все tabs/forms/dashboards импортируются eagerly.

**Риск:** analytics/export dependencies загружаются даже тем пользователям, кто открывает только проверки. На пилоте это терпимо, но рост dashboard/export кода ухудшит first load.

**Как исправить:** перейти на `React.lazy` для крупных route components: analytics, planning, tools, settings, form pages. Добавить `Suspense` с existing `LoadingState`.

**Тесты:** smoke route render; bundle analyzer до/после.

## Findings

| Приоритет | Finding |
|-----------|---------|
| P2 | Server pagination/search вместо bulk-fetch списков |
| P1 | Banner/disabled state при недоступном storage |
| P1 | CRUD smoke в Playwright |
| P2 | Split `exports.ts`, data-driven HTML export |
| P3 | Virtualized tables, OpenAPI codegen |

Задачи: [ACTION_PLAN.md](ACTION_PLAN.md)
