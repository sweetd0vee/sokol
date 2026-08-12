# Код-ревью frontend

**Общая оценка:** 7.8 / 10 · React 19, TypeScript, Vite, TanStack Query  
**Смысл оценки:** frontend хорошо закрывает основные сценарии аудитора, смена пароля уже подключена к API, lint/test стали жёстче. Главные риски теперь не “сломанный UI”, а production stub route, усечение данных, неатомарный bulk replace и hardening вложений/экспортов.

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
| Checks workflow | **8 / 10** | Форма и список работают с backend; `serial_number` только читается из API | Крупный `CheckFormPage`, нужны form tests |
| Recommendations workflow | **7.5 / 10** | CRUD, статусы, вложения и связь с проверкой покрывают основной процесс | Bulk replace delete-all/create-all рискован при сбое |
| Data layer / context | **7 / 10** | API clients + mappers + React Query дают единый контракт | `SokolDataContext` тянет bulk limits 500/1000 без явного warning |
| Attachments UI | **7 / 10** | Панели вложений подключены к check/recommendation, upload limits берутся с backend | Нужен общий banner/disabled state при недоступном MinIO |
| Analytics dashboards | **8 / 10** | Серверные агрегаты, фильтры и визуализации полезны бизнесу | При росте данных нужен drill-down/server pagination |
| Exports | **6.5 / 10** | XLSX/PDF/DOCX/HTML дают быстрый value для пользователей | `exports.ts` и DOM capture хрупкие, требуют дробления |
| Planning | **7 / 10** | Dashboard подключён к backend analytics | Export выключен, модуль надо явно позиционировать как ограниченный |
| Tools / DOCX UI | **8 / 10** | UI соответствует текущему backend: section-ii, links, memorandum, parse recommendations | Нет очереди/прогресса для долгих jobs |
| UI kit / forms | **8 / 10** | Есть переиспользуемые controls и `formLayout` constants | Нет Storybook/visual regression |
| Tests / lint | **8.5 / 10** | 44 Vitest проходят, lint без ошибок/warnings; есть form payload tests и Playwright smoke | Нет e2e успешного auth flow, CRUD flow, storage state и truncation cases |

## Маршруты vs backend

| Route | Backend |
|-------|---------|
| checks, recommendations, analytics, planning, tools, settings | ✅ |
| kantsler | ❌ stub |
| profile password change | ✅ `POST /api/v1/auth/change-password` |

## Tools

`ToolsTab` → только `DocxToolPanel`: section-ii, section-ii-links, memorandum.  
**Audit opinion UI отсутствует** (согласовано с backend — endpoint не реализован).

Upload limits из `GET /capabilities` (backend).

## State

`SokolDataContext`: checks limit 500, recommendations 1000 — **нет warning при truncation** (P1).

`CheckFormPage`: serial из API, payload не отправляет `serial_number` ✅

`ProfilePage`: пароль меняется через `changePasswordRequest`; старое замечание про неподключённую форму закрыто ✅

## Analytics

Server aggregates ✅. Visual export (xlsx/pdf/docx/html) — DOM capture хрупкий. Planning export отключён.

## Тесты

44 Vitest теста: filters, checkKey helpers, fileHelpers, reference options, form payload checks.

Lint: 0 errors, 0 warnings.

E2E: 2 Playwright smoke tests на unauthenticated redirect и login validation. Нужны smoke на успешный login, скрытие production stubs и ключевые CRUD workflows.

## Подробные findings

### FE-01 · P0 · `Kantsler` виден как production route

**Где:** `src/App.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/tabs/KantslerTab.tsx`.

**Симптом:** маршрут `/kantsler` подключён в `App.tsx`, пункт меню добавлен в `TABS`, экран показывает “В разработке”.

**Риск:** в production пользователь видит недоделанный модуль и может считать его частью поставки. Это P0 не из-за сложности, а из-за ложного пользовательского обещания.

**Как исправить:**

1. Самый быстрый вариант: удалить пункт из `TABS` и route `/kantsler`.
2. Более гибкий вариант: добавить `VITE_ENABLE_KANTSLER=false`; показывать route/nav только при flag.
3. Для прямого URL `/kantsler` в production делать redirect на `/checks` или NotFound.
4. В README/docs явно указать, что Kantsler вне текущего релиза.

**Тесты:** Playwright в production build не видит пункт `Канцлер`; прямой переход `/kantsler` не показывает stub.

### FE-02 · P1 · Глобальные списки могут быть усечены без warning

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

### FE-03 · P1 · `replaceRecommendationsForCheck` неатомарен

**Где:** `src/contexts/SokolDataContext.tsx`.

**Симптом:** функция берёт существующие рекомендации по serial, удаляет их через `Promise.all`, затем создаёт новые через `Promise.all`.

**Риск:** если удаление прошло, а одно создание упало, пользователь теряет старые рекомендации или получает неполный набор. Параллельные запросы также не гарантируют ожидаемый порядок `sequence_number`, если backend зависит от max+1 на момент create.

**Как исправить:**

1. Правильный вариант: backend endpoint `PUT /checks/{id}/recommendations` или `POST /recommendations/bulk-replace` с одной DB transaction.
2. Frontend отправляет весь desired list и получает итоговые rows.
3. До backend endpoint не использовать “delete all + create all” для сохранения формы проверки; показывать предупреждение и избегать silent partial success.
4. Если временно оставить frontend flow, делать последовательные операции и сохранять старый snapshot для ручного восстановления при ошибке.

**Тесты:** при ошибке create второй рекомендации старые рекомендации остаются; после успешного bulk replace порядок rows стабилен.

### FE-04 · P1 · Нет общего UX для недоступного MinIO

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

### FE-05 · P1 · Auth e2e пока проверяет только негативные сценарии

**Где:** `e2e/auth.spec.ts`, `src/contexts/AuthContext.tsx`, `src/components/profile/ProfilePage.tsx`.

**Симптом:** Playwright покрывает redirect unauthenticated и пустую форму login. Успешный login, logout, 401 auto logout и change-password не покрыты e2e.

**Риск:** можно сломать основной вход или interceptor, а smoke останется зелёным.

**Как исправить:** добавить e2e с route mocking или тестовым backend:

1. Успешный login сохраняет token и открывает `/checks`.
2. Logout очищает session и ведёт на `/login`.
3. 401 от API вызывает logout.
4. Change password показывает success/error.

**Тесты:** Playwright `auth.spec.ts` расширить до позитивного flow; unit оставить для ошибок mapper/interceptor.

### FE-06 · P2 · `exports.ts` слишком крупный и хрупкий

**Где:** `src/utils/exports.ts`, `src/components/analytics/*`, `src/components/planning/PlanningAnalyticsDashboard.tsx`.

**Симптом:** export logic смешивает XLSX/PDF/DOCX/HTML и visual DOM capture. Изменение DOM/стилей может ломать экспорт без compiler сигналов.

**Риск:** отчёты — пользовательская ценность системы. Если dashboard выглядит хорошо, но экспорт пустой/кривой, ошибка обнаружится поздно.

**Как исправить:**

1. Разделить export modules: `exportXlsx`, `exportPdf`, `exportDocx`, `exportHtml`.
2. Для таблиц и KPI строить export из typed data, а не из DOM.
3. DOM capture оставить только для визуальных chart snapshots.
4. Добавить fixture data и smoke tests на каждый формат, хотя бы проверку, что файл создаётся и содержит ключевые строки.

**Тесты:** unit на builders; smoke на dashboard export с fixture.

### FE-07 · P2 · Route-level bundle не дробится

**Где:** `src/App.tsx`.

**Симптом:** все tabs/forms/dashboards импортируются eagerly.

**Риск:** analytics/export dependencies загружаются даже тем пользователям, кто открывает только проверки. На пилоте это терпимо, но рост dashboard/export кода ухудшит first load.

**Как исправить:** перейти на `React.lazy` для крупных route components: analytics, planning, tools, settings, form pages. Добавить `Suspense` с existing `LoadingState`.

**Тесты:** smoke route render; bundle analyzer до/после.

## Findings

| Приоритет | Finding |
|-----------|---------|
| P0 | Скрыть Kantsler |
| P1 | «Показано X из Y» в таблицах |
| P1 | `replaceRecommendationsForCheck` — delete-all + create-all без транзакции |
| P1 | Banner/disabled state при недоступном storage |
| P1 | E2E успешный auth/logout/change-password |
| P2 | Split `exports.ts`, data-driven HTML export |
| P3 | Virtualized tables, OpenAPI codegen |

Задачи: [ACTION_PLAN.md](ACTION_PLAN.md)
