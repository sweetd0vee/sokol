# Код-ревью frontend

**Оценка:** 7.4 / 10 · React 19, TypeScript, Vite, TanStack Query

## Архитектура

```
QueryClient → AuthProvider → SokolDataProvider → Router
api/ · components/ · contexts/ · utils/ · constants/formLayout.ts
```

**Плюсы:** feature folders, mappers, React Query, единые токены форм.

**Минусы:** god files (`exports.ts`, analytics export); нет route lazy loading; demo routes в production nav.

## Маршруты vs backend

| Route | Backend |
|-------|---------|
| checks, recommendations, analytics, planning, tools, settings | ✅ |
| observations | ❌ demo data |
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

32 теста (filters, checkKey helpers, fileHelpers, reference options). Нет e2e, нет form tests.

Lint: 0 errors, 27 warnings (`react-hooks/exhaustive-deps`).

## Findings

| Приоритет | Finding |
|-----------|---------|
| P0 | Скрыть Observations / Kantsler / fake password |
| P1 | «Показано X из Y» в таблицах |
| P1 | `replaceRecommendationsForCheck` — delete-all + create-all без транзакции |
| P2 | Split `exports.ts`, data-driven HTML export |
| P2 | eslint useMemo warnings |
| P3 | Virtualized tables, OpenAPI codegen |

Задачи: [ACTION_PLAN.md](ACTION_PLAN.md)
