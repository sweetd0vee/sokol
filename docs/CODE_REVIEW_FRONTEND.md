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

## Маршруты vs backend

| Route | Backend |
|-------|---------|
| checks, recommendations, analytics, planning, tools, settings | ✅ |
| kantsler | roadmap-заготовка v2, backend/API будет реализован во второй версии |
| profile password change | ✅ `POST /api/v1/auth/change-password` |
| admin users (profile) | ✅ `GET/POST /api/v1/users` |

## Tools

`ToolsTab` → только `DocxToolPanel`: section-ii, section-ii-links, memorandum.  
**Audit opinion UI отсутствует** (согласовано с backend — endpoint не реализован).

Upload limits из `GET /capabilities` (backend).

## State

`SokolDataContext`: checks/recommendations грузятся с limit 10000. Для ожидаемого объёма пилота это полный набор данных без truncation banner; server pagination/search нужен только при росте сверх 10000.

`CheckFormPage`: serial из API, payload не отправляет `serial_number` ✅

`ProfilePage`: пароль меняется через `changePasswordRequest`; старое замечание про неподключённую форму закрыто ✅

## Analytics

Server aggregates в PostgreSQL ✅. KPI-блок на всех вкладках analytics с заголовком **«Итого»**; на вкладке проверок первая карточка — **«Всего»** (не «Итого»). Visual export (xlsx/pdf/docx/html) — DOM capture хрупкий. Planning export отключён.

## Тесты

54 Vitest теста (10 файлов): filters, checkKey helpers, fileHelpers, reference options, form payload checks, recommendation batch/yearly number API, person matching coverage, `recommendationYearlyNumber`.

Lint: 0 errors, 0 warnings.

E2E: 5 Playwright auth smoke tests: unauthenticated redirect, login validation, successful login, logout, change-password success/error. Нужны smoke на ключевые CRUD workflows.

## Подробные findings

### FE-01 · P0 · Edit проверки по прямой ссылке может создать дубль — закрыто

**Где:** `src/components/checks/CheckFormPage.tsx`, `src/api/checks.ts`, `src/contexts/SokolDataContext.tsx`.

**Было:** `/checks/:id/edit` брал проверку только из `location.state.check` или `checks.find()` в глобальном context. Если открыть edit URL напрямую, обновить страницу или редактировать проверку вне загруженного списка, `existing` становился `undefined`. При submit условие `isEditMode && existing?.id` не срабатывало, и код уходил в `addCheck(payload)`.

**Исправлено:** добавлен `fetchCheck(id)` на `GET /api/v1/checks/{id}`; `CheckFormPage` в edit mode дозагружает проверку через React Query, гидратирует поля после ответа API, при ошибке показывает `ErrorState`, а submit в edit mode больше не имеет fallback на `addCheck`.

**Тесты:** добавлен Vitest на `fetchCheck`; `npm run lint` и `npm test` проходят.

### FE-02 · accepted · `Kantsler` оставлен как roadmap-задел v2

**Где:** `src/App.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/tabs/KantslerTab.tsx`.

**Решение:** маршрут `/kantsler` подключён в `App.tsx`, пункт меню добавлен в `TABS`, экран показывает “В разработке”.

**Почему это допустимо:** раздел нужен команде как задел под вторую версию приложения и не мешает текущим сценариям пилота.

**Статус:** не считается блокером frontend-go-live; backend/API для интеграции с СЭД Канцлер планируются в v2.

**Тесты:** `npm run lint`, `npm test`.

### FE-03 · P1 · Глобальные списки были ограничены 500/1000 — закрыто

**Где:** `src/contexts/SokolDataContext.tsx`, `src/api/checks.ts`, `src/api/recommendations.ts`.

**Было:** context грузил `fetchChecks({ limit: 500 })` и `fetchRecommendations({ limit: 1000 })`, а backend не принимал `limit > 1000`.

**Риск:** если данных больше лимита, UI работает с неполной выборкой. Возможные баги: не все рекомендации попадут в таблицу/экспорт, форма не найдёт связанную проверку.

**Исправлено:** backend list endpoints принимают `limit` до 10000, `SokolDataContext` запрашивает 10000 checks/recommendations. Warning “Показано X из Y” убран: для текущего ожидаемого объёма данные должны загружаться целиком.

**Осталось:** если фактический объём превысит 10000, перейти на server pagination/search и отдельный export-all flow.

**Нужны тесты:** API принимает `limit=10000`; список рекомендаций с 1175 строками отображается без banner “Показано X из Y”.

### FE-04 · P1 · Bulk операции рекомендаций были неатомарны — закрыто

**Где:** `src/contexts/SokolDataContext.tsx`, `src/components/checks/CheckRecommendationsBlock.tsx`.

**Было:** `replaceRecommendationsForCheck` удалял старые рекомендации через `Promise.all`, затем создавал новые через `Promise.all`. Импорт рекомендаций из АЗ создавал rows по одной.

**Исправлено:** добавлен `batchRecommendations`; `SokolDataContext` использует backend batch append/replace. Импорт из АЗ — один atomic request. После успешного add UI хранит `recentUpload` и показывает **«Отменить»**; отмена вызывает `POST /recommendations/batch-delete` (не параллельные DELETE).

**Тесты:** Vitest на batch API payload/response mapping; ручной сценарий undo 30+ рекомендаций.

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

### FE-06 · P1 · Ошибки сохранения рекомендаций и загрузки списков видны не везде — закрыто

**Где:** `src/components/recommendations/RecommendationFormPage.tsx`, `src/components/tabs/ChecksTab.tsx`, `src/components/tabs/RecommendationsTab.tsx`, `src/contexts/SokolDataContext.tsx`.

**Было:** `RecommendationFormPage.saveRecommendation` уже показывал `saveError` при rejected `addRecommendation/updateRecommendation`. Открытая часть: context отдавал `isLoading/isError/error`, но табы не превращали это в `LoadingState`/`ErrorState`.

**Риск:** пользователь нажимает “Сохранить”, request падает, форма остаётся без объяснения. При падении bulk fetch таблица может выглядеть как пустой список.

**Закрыто:** `RecommendationFormPage.saveRecommendation` ловит ошибку через `getErrorMessage(error, 'Не удалось сохранить рекомендацию.')`; navigate после failed save не выполняется. `ChecksTab` и `RecommendationsTab` показывают loading/error state и retry через `refetch`.

**Тесты:** `npm run lint`, `npm test`; component tests для rejected list query ещё стоит добавить.

### FE-07 · P1 · Auth e2e пока проверяет только негативные сценарии — закрыто

**Где:** `e2e/auth.spec.ts`, `src/contexts/AuthContext.tsx`, `src/components/profile/ProfilePage.tsx`.

**Было:** Playwright покрывал redirect unauthenticated и пустую форму login. Успешный login, logout и change-password не были покрыты e2e.

**Риск:** можно было сломать основной вход или смену пароля, а smoke оставался зелёным.

**Закрыто:** `e2e/auth.spec.ts` расширен route-mocking flow:

1. Успешный login сохраняет token и открывает `/checks`.
2. Logout очищает session и ведёт на `/login`.
3. Change password показывает success и API error.

**Тесты:** `npx playwright test e2e/auth.spec.ts` — 5 tests passed.

### FE-08 · P2 · `useEntityAttachments` вызывает setState во время render — закрыто

**Где:** `src/hooks/useEntityAttachments.ts`.

**Было:** hook сравнивал `prevEntityKey` с `entityKey` прямо в теле render и вызывал `setPrevEntityKey`/`setPendingItems`.

**Риск:** React Strict Mode может подсветить warning; поведение сброса pending uploads становится менее предсказуемым при быстрых переходах между сущностями.

**Исправлено:** pending uploads хранятся вместе с `entityKey`; при смене сущности старые pending items не участвуют в текущем render без `setState` в render/effect.

**Тесты:** `npm run lint`, `npm test`.

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

### FE-11 · P2 · Поле «№» показывало sequence внутри проверки — закрыто

**Где:** `src/components/recommendations/RecommendationFormPage.tsx`, `src/utils/recommendationYearlyNumber.ts`.

**Было:** в форме редактирования отображался `sequence_number` (порядковый номер внутри проверки), а не yearly ID из колонки списка (`26-4` → `4`).

**Исправлено:** `resolveRecommendationYearlyDisplayNumber()` вычисляет display number из yearly ID; для deadline используется `toIsoDate(deadline) ?? source?.deadline`.

**Тесты:** `recommendationYearlyNumber.test.ts`.

### FE-12 · P2 · UI delete/attachments не учитывал ownership auditor — закрыто

**Где:** `src/components/recommendations/RecommendationFormPage.tsx`, `src/utils/personMatch.ts`, `src/components/attachments/*`.

**Было:** delete recommendation и upload/remove attachments были доступны всем authenticated users с правами admin-only на backend.

**Исправлено:** `auditorMatchesCurrentUser()` + `canManageRecommendation` скрывают delete; `canModifyAttachments` / `canRemoveSaved` блокируют upload и удаление saved files для чужих рекомендаций. Check attachments: `canRemoveSaved={isAdmin}`.

**Тесты:** ручная проверка auditor vs admin; backend `test_auth_rbac.py`.

### FE-13 · P3 · Единые отступы между фильтрами и «Сбросить фильтры» — закрыто

**Где:** `src/constants/formLayout.ts` (`LIST_ACTION_GROUP_CLASS`), `ChecksTab.tsx`, `RecommendationsTab.tsx`.

**Исправлено:** последний фильтр и кнопка сброса сгруппированы с тем же `gap`, что «Мои» / «Создать» на тех же вкладках.

## Findings

| Приоритет | Finding |
|-----------|---------|
| P2 | Server pagination/search вместо bulk-fetch списков |
| P1 | Banner/disabled state при недоступном storage |
| P1 | CRUD smoke в Playwright |
| P2 | Split `exports.ts`, data-driven HTML export |
| P3 | Virtualized tables, OpenAPI codegen |

Задачи: [ACTION_PLAN.md](ACTION_PLAN.md)
