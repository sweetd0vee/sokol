# Код-ревью frontend

**Общая оценка:** 8.0 / 10 · React 19, TypeScript, Vite, TanStack Query  
**Смысл оценки:** frontend хорошо закрывает сценарии аудитора: atomic import из АЗ с undo, granular RBAC на delete/attachments, yearly ID в форме. Главные риски: production stub route, усечение данных и hardening storage UX/экспортов.

## Архитектура

```
QueryClient → AuthProvider → SokolDataProvider → Router
api/ · components/ · contexts/ · utils/ · constants/formLayout.ts
```

**Плюсы:** feature folders, mappers, React Query, единые токены форм.

**Минусы:** god files (`exports.ts`, analytics export); нет route lazy loading; demo routes в production nav.

## Оценка по блокам

| Блок | Оценка | Что хорошо | Что ограничивает |
|------|--------|------------|------------------|
| App shell / routing | **7 / 10** | AuthProvider, layout и Router собраны понятно | В nav/route виден demo/stub раздел `kantsler` |
| Auth UI / API client | **7.5 / 10** | Login, Bearer interceptor, 401 logout и change-password закрывают базовый сценарий | Нет OIDC-flow, нет e2e успешного login/change-password |
| Checks workflow | **8 / 10** | Форма и список работают с backend; `serial_number` только читается из API; edit route fetchит check по id | Для больших списков остаётся риск усечения данных в общем context |
| Recommendations workflow | **8.5 / 10** | CRUD, статусы, вложения, atomic batch import/replace, undo импорта из АЗ, RBAC delete/attachments, yearly № в форме | Save errors не показываются в форме |
| Data layer / context | **7.5 / 10** | API clients + mappers + React Query; `batch-delete` для undo в одном запросе | Bulk limits 500/1000 без явного warning |
| Attachments UI | **7.5 / 10** | `canModifyAttachments` / `canRemoveSaved` по ownership; check attachments — admin only | Нужен общий banner/disabled state при недоступном MinIO |
| Analytics dashboards | **8.5 / 10** | Серверные SQL-агрегаты; единый заголовок KPI «Итого»; на вкладке проверок первая карточка «Всего» | Drill-down/server pagination для детализации |
| Exports | **6.5 / 10** | XLSX/PDF/DOCX/HTML дают быстрый value для пользователей | `exports.ts` и DOM capture хрупкие, требуют дробления |
| Planning | **7 / 10** | Dashboard подключён к backend analytics | Export выключен, модуль надо явно позиционировать как ограниченный |
| Tools / DOCX UI | **8 / 10** | UI соответствует текущему backend: section-ii, links, memorandum, parse recommendations | Нет очереди/прогресса для долгих jobs |
| UI kit / forms | **8.5 / 10** | Переиспользуемые controls, `formLayout` constants, `LIST_ACTION_GROUP_CLASS` для единых отступов фильтров | Нет Storybook/visual regression |
| Tests / lint | **8.5 / 10** | 48 Vitest проходят, lint без ошибок/warnings; form payload/API tests и Playwright smoke | Нет e2e успешного auth flow, CRUD flow, storage state и truncation cases |

## Маршруты vs backend

| Route | Backend |
|-------|---------|
| checks, recommendations, analytics, planning, tools, settings | ✅ |
| kantsler | ❌ stub |
| profile password change | ✅ `POST /api/v1/auth/change-password` |
| admin users (profile) | ✅ `GET/POST /api/v1/users` |

## Tools

`ToolsTab` → только `DocxToolPanel`: section-ii, section-ii-links, memorandum.  
**Audit opinion UI отсутствует** (согласовано с backend — endpoint не реализован).

Upload limits из `GET /capabilities` (backend).

## State

`SokolDataContext`: checks limit 500, recommendations 1000 — **нет warning при truncation** (P1).

`CheckFormPage`: serial из API, payload не отправляет `serial_number` ✅

`ProfilePage`: пароль меняется через `changePasswordRequest`; старое замечание про неподключённую форму закрыто ✅

## Analytics

Server aggregates в PostgreSQL ✅. KPI-блок на всех вкладках analytics с заголовком **«Итого»**; на вкладке проверок первая карточка — **«Всего»** (не «Итого»). Visual export (xlsx/pdf/docx/html) — DOM capture хрупкий. Planning export отключён.

## Тесты

48 Vitest тестов (10 файлов): filters, checkKey helpers, fileHelpers, reference options, form payload checks, recommendation batch/yearly number API, `personMatch`, `recommendationYearlyNumber`.

Lint: 0 errors, 0 warnings.

E2E: 2 Playwright smoke tests на unauthenticated redirect и login validation. Нужны smoke на успешный login, скрытие production stubs и ключевые CRUD workflows.

## Подробные findings

### FE-01 · P0 · Edit проверки по прямой ссылке может создать дубль — закрыто

**Где:** `src/components/checks/CheckFormPage.tsx`, `src/api/checks.ts`, `src/contexts/SokolDataContext.tsx`.

**Было:** `/checks/:id/edit` брал проверку только из `location.state.check` или `checks.find()` в глобальном context. Context загружает максимум 500 checks. Если открыть edit URL напрямую, обновить страницу или редактировать проверку вне первых 500 записей, `existing` становился `undefined`. При submit условие `isEditMode && existing?.id` не срабатывало, и код уходил в `addCheck(payload)`.

**Исправлено:** добавлен `fetchCheck(id)` на `GET /api/v1/checks/{id}`; `CheckFormPage` в edit mode дозагружает проверку через React Query, гидратирует поля после ответа API, при ошибке показывает `ErrorState`, а submit в edit mode больше не имеет fallback на `addCheck`.

**Тесты:** добавлен Vitest на `fetchCheck`; `npm run lint` и `npm test` проходят.

### FE-02 · P0 · `Kantsler` виден как production route

**Где:** `src/App.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/tabs/KantslerTab.tsx`.

**Симптом:** маршрут `/kantsler` подключён в `App.tsx`, пункт меню добавлен в `TABS`, экран показывает “В разработке”.

**Риск:** в production пользователь видит недоделанный модуль и может считать его частью поставки. Это P0 не из-за сложности, а из-за ложного пользовательского обещания.

**Как исправить:**

1. Самый быстрый вариант: удалить пункт из `TABS` и route `/kantsler`.
2. Более гибкий вариант: добавить `VITE_ENABLE_KANTSLER=false`; показывать route/nav только при flag.
3. Для прямого URL `/kantsler` в production делать redirect на `/checks` или NotFound.
4. В README/docs явно указать, что Kantsler вне текущего релиза.

**Тесты:** Playwright в production build не видит пункт `Канцлер`; прямой переход `/kantsler` не показывает stub.

### FE-03 · P1 · Глобальные списки могут быть усечены без warning

**Где:** `src/contexts/SokolDataContext.tsx`, `src/api/checks.ts`, `src/api/recommendations.ts`.

**Симптом:** context грузит `fetchChecks({ limit: 500 })` и `fetchRecommendations({ limit: 1000 })`. API возвращает `{ items, total }`, но context сохраняет только `items`.

**Риск:** если данных больше лимита, UI выглядит нормально, но работает с неполной выборкой. Возможные баги: не все рекомендации попадут в таблицу/экспорт, форма не найдёт связанную проверку, analytics на frontend-side data будут расходиться с backend aggregates.

**Как исправить:**

1. Добавить в context `checksTotal`, `recommendationsTotal`, `isChecksTruncated`, `isRecommendationsTruncated`.
2. Показывать banner в `ChecksTab`/`RecommendationsTab`: “Показано 500 из 734. Уточните фильтр или включите пагинацию”.
3. Для таблиц перейти на server pagination/search, а не один bulk fetch.
4. Для form lookup использовать endpoint поиска/получения по id/serial, а не только локальный массив.
5. Для export явно выбирать: экспорт текущей страницы или всех записей через отдельный API.

**Тесты:** mock API возвращает `items.length=500`, `total=501`; UI показывает warning. Поиск проверки за пределами первой страницы всё равно может выбрать нужную запись через API.

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

### FE-06 · P1 · Ошибки сохранения рекомендаций и загрузки списков видны не везде

**Где:** `src/components/recommendations/RecommendationFormPage.tsx`, `src/components/tabs/ChecksTab.tsx`, `src/components/tabs/RecommendationsTab.tsx`, `src/contexts/SokolDataContext.tsx`.

**Симптом:** `RecommendationFormPage.saveRecommendation` делает `try/finally`, но без `catch` и без `saveError`. При rejected `addRecommendation/updateRecommendation` пользователь не получает понятного сообщения. Context отдаёт `isLoading/isError/error`, но табы не всегда превращают это в `LoadingState`/`ErrorState`.

**Риск:** пользователь нажимает “Сохранить”, request падает, форма остаётся без объяснения. При падении bulk fetch таблица может выглядеть как пустой список.

**Как исправить:**

1. Добавить `saveError` в `RecommendationFormPage` по образцу `CheckFormPage`.
2. В `catch` использовать `getErrorMessage(error, 'Не удалось сохранить рекомендацию.')`.
3. В `ChecksTab`/`RecommendationsTab` показывать loading/error state и кнопку retry через `refetch`.
4. Не делать navigate после save, если request завершился ошибкой.

**Тесты:** rejected save показывает текст ошибки и не очищает форму; rejected list query показывает error UI и retry вызывает `refetch`.

### FE-07 · P1 · Auth e2e пока проверяет только негативные сценарии

**Где:** `e2e/auth.spec.ts`, `src/contexts/AuthContext.tsx`, `src/components/profile/ProfilePage.tsx`.

**Симптом:** Playwright покрывает redirect unauthenticated и пустую форму login. Успешный login, logout, 401 auto logout и change-password не покрыты e2e.

**Риск:** можно сломать основной вход или interceptor, а smoke останется зелёным.

**Как исправить:** добавить e2e с route mocking или тестовым backend:

1. Успешный login сохраняет token и открывает `/checks`.
2. Logout очищает session и ведёт на `/login`.
3. 401 от API вызывает logout.
4. Change password показывает success/error.

**Тесты:** Playwright `auth.spec.ts` расширить до позитивного flow; unit оставить для ошибок mapper/interceptor.

### FE-08 · P2 · `useEntityAttachments` вызывает setState во время render

**Где:** `src/hooks/useEntityAttachments.ts`.

**Симптом:** hook сравнивает `prevEntityKey` с `entityKey` прямо в теле render и вызывает `setPrevEntityKey`/`setPendingItems`.

**Риск:** React Strict Mode может подсветить warning; поведение сброса pending uploads становится менее предсказуемым при быстрых переходах между сущностями.

**Как исправить:** перенести сброс pending state в `useEffect(() => { setPendingItems([]) }, [entityKey])`; `prevEntityKey` убрать или хранить в `useRef`, если нужен для сравнения.

**Тесты:** hook test: при смене `entityId` pending files очищаются без render-phase update warning.

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
| P0 | Скрыть Kantsler |
| P1 | «Показано X из Y» в таблицах |
| P1 | Banner/disabled state при недоступном storage |
| P1 | Error UI для save recommendation и list fetch |
| P1 | E2E успешный auth/logout/change-password |
| P2 | `useEntityAttachments` — убрать setState из render |
| P2 | Split `exports.ts`, data-driven HTML export |
| P3 | Virtualized tables, OpenAPI codegen |

Задачи: [ACTION_PLAN.md](ACTION_PLAN.md)
