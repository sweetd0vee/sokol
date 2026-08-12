# Код-ревью frontend

**Общая оценка:** 7.7 / 10 · React 19, TypeScript, Vite, TanStack Query  
**Смысл оценки:** frontend хорошо закрывает основные сценарии аудитора, но часть экранов всё ещё выглядит как демо/заглушка, а большие списки и экспорты требуют hardening.

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
| App shell / routing | **6.5 / 10** | AuthProvider, layout и Router собраны понятно | В nav видны demo/stub разделы (`kantsler`, fake profile password) |
| Auth UI / API client | **7 / 10** | Login, Bearer interceptor и 401 logout закрывают базовый сценарий | Нет OIDC-flow, fake password UI надо скрыть/disabled |
| Checks workflow | **8 / 10** | Форма и список работают с backend; `serial_number` только читается из API | Крупный `CheckFormPage`, нужны form tests |
| Recommendations workflow | **7.5 / 10** | CRUD, статусы, вложения и связь с проверкой покрывают основной процесс | Bulk replace delete-all/create-all рискован при сбое |
| Data layer / context | **7 / 10** | API clients + mappers + React Query дают единый контракт | `SokolDataContext` тянет bulk limits 500/1000 без явного warning |
| Attachments UI | **7 / 10** | Панели вложений подключены к check/recommendation и storage status | Нужен понятный banner/UX при недоступном MinIO |
| Analytics dashboards | **8 / 10** | Серверные агрегаты, фильтры и визуализации полезны бизнесу | При росте данных нужен drill-down/server pagination |
| Exports | **6.5 / 10** | XLSX/PDF/DOCX/HTML дают быстрый value для пользователей | `exports.ts` и DOM capture хрупкие, требуют дробления |
| Planning | **7 / 10** | Dashboard подключён к backend analytics | Export выключен, модуль надо явно позиционировать как ограниченный |
| Tools / DOCX UI | **8 / 10** | UI соответствует текущему backend: section-ii, links, memorandum, parse recommendations | Нет очереди/прогресса для долгих jobs |
| UI kit / forms | **8 / 10** | Есть переиспользуемые controls и `formLayout` constants | Нет Storybook/visual regression |
| Tests / lint | **10 / 10** | 44 Vitest проходят, lint без ошибок и warnings; есть form tests и Playwright e2e smoke | Поддерживать покрытие при изменении форм и auth flow |

## Маршруты vs backend

| Route | Backend |
|-------|---------|
| checks, recommendations, analytics, planning, tools, settings | ✅ |
| kantsler | ❌ stub |
| profile password change | ❌ fake UI |

## Tools

`ToolsTab` → только `DocxToolPanel`: section-ii, section-ii-links, memorandum.  
**Audit opinion UI отсутствует** (согласовано с backend — endpoint не реализован).

Upload limits из `GET /capabilities` (backend).

## State

`SokolDataContext`: checks limit 500, recommendations 1000 — **нет warning при truncation** (P1).

`CheckFormPage`: serial из API, payload не отправляет `serial_number` ✅

## Analytics

Server aggregates ✅. Visual export (xlsx/pdf/docx/html) — DOM capture хрупкий. Planning export отключён.

## Тесты

44 Vitest теста: filters, checkKey helpers, fileHelpers, reference options, form payload checks.

Lint: 0 errors, 0 warnings.

E2E: 2 Playwright smoke tests на unauthenticated redirect и login validation.

## Findings

| Приоритет | Finding |
|-----------|---------|
| P0 | Скрыть Kantsler / fake password |
| P1 | «Показано X из Y» в таблицах |
| P1 | `replaceRecommendationsForCheck` — delete-all + create-all без транзакции |
| P1 | Banner/disabled state при недоступном storage |
| P2 | Split `exports.ts`, data-driven HTML export |
| P3 | Virtualized tables, OpenAPI codegen |

Задачи: [ACTION_PLAN.md](ACTION_PLAN.md)
