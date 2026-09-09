# SOKOL — код-ревью

> **Исторический снимок качества (04.09.2026),** не живая архитектура. Актуальные контракты: [sokol-backend/docs](../sokol-backend/docs/README.md), [sokol-frontend/docs](../sokol-frontend/docs/README.md).

**Дата:** 4 сентября 2026  
**Объект:** `sokol-backend`, `sokol-frontend`

Снимок качества на дату ревью. Календарь go-live и UAT того спринта — [PLAN.md](../PLAN.md). Оставшиеся код-задачи — [ACTION_PLAN.md](ACTION_PLAN.md). Полный остаток до продакшена — [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md).

Оценка по блокам: **8–10** — пригодно для пилота; **6–7** — работает, есть эксплуатационный риск; **≤5** — нельзя считать готовым.

## Сводка

| Блок | Оценка | Сейчас | Главный риск |
|------|--------|--------|--------------|
| Backend API / CRUD | **10** | Services, REST, validation, RBAC, FK-справочники, lifecycle tests | Alembic |
| Ключ проверки | **10** | Backend-only `serial_number`; PATCH синхронизирует rec/attachments и MinIO bucket | Ручной mass-recalc только с бэкапом |
| Analytics / planning API | **9** | SQL-агрегаты, camelCase, матрицы существенности/статуса, DVA-документы, planning coverage | Analytics читает массив `audit_object`, не junction |
| DOCX tools | **10** | Раздел II, ссылки, ДЗ, parse, файл контроля; очередь и golden CI | Нестандартная вёрстка АЗ всё ещё возможна, но слот/очередь и эталонный pipeline закрывают эксплуатационный риск |
| Attachments / MinIO | **10** | API, compensation, serial-bucket, 503/502, FE banner/disabled upload/retry по `/storage/status` | Backup drill не подтверждён |
| Auth / RBAC | **8.5** | JWT, lookup/`is_active` из БД, `department_head` ∈ admin, Basic off в prod | Нет OIDC и audit log |
| БД / import | **6** | `create_all` + `migrate_*`; prod guards; merge-only sync | Нет Alembic; Docker demo default on |
| Frontend домен | **9** | Формы, undo импорта из АЗ, yearly №, конструктор дашбордов, виды из API | Списки &gt;10000 |
| Frontend data | **7.5** | API + React Query; списки до 10000 | Нет server pagination |
| Frontend analytics/export | **8** | Visual export аналитики и планирования; table export разнесён по форматам | DOM capture хрупкий |
| Тесты / CI | **8.5** | Backend ~200 unittest, frontend **160** Vitest (на 04.09; сейчас ~221 / ~199), Playwright auth + constructor | Required checks в GitHub не включены; Playwright не в CI |
| Документация | **8.5** | Backend/frontend docs и MinIO runbook | Alembic — цель, не факт |

**Вердикт:** пилот на контролируемом объёме возможен. До промышленного контура: Alembic или подписанный migrate-runbook, CI merge gate, MinIO backup drill, метка limited на планировании. Полный остаток: [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md).

## Закрыто с августа (не повторять)

Kantsler снят · prod guards demo/replace · HTTP Basic off в prod · prod merge-only `sync_dictionaries` · конструктор дашбордов (только frontend) · visual export планирования · table export split (`utils/tableExport/`) · `seed_demo_attachments` · FE storage status banner (`useStorageStatus`) · виды проверок из `/settings/check_kinds`.

## Ещё открыто

| ID | Приоритет | Что |
|----|-----------|-----|
| BE-01 | P0 | Alembic baseline |
| BE-01a | P0 · частично | Compose `SOKOL_LOAD_DEMO_DATA=1`; UAT/prod обязаны `SOKOL_ENV=prod` + demo `0` |
| P0-02 | P0 | Метка limited/beta на `/planning` |
| P0-07 | P0 | Import dry-run + reject report (сейчас `ensure_*`) |
| OPS-01 | P1 | Required CI checks в branch protection |
| FE-07 | P2 | Visual export всё ещё DOM capture; `exports.ts` — тонкая обёртка над `tableExport/` |

## Как чинить без регрессий

1. Serial / attachments: создать проверку → файл → смена лидера/даты/типа → скачать → удалить.
2. Списки: не ломать bulk-fetch до 10000.
3. Backend: HTTP-тест на endpoint; при схеме — integration с `SOKOL_RUN_DB_INTEGRATION_TESTS=1`.
4. Frontend: unit рядом с helper; критичные маршруты — Playwright.

Детали: [CODE_REVIEW_BACKEND.md](CODE_REVIEW_BACKEND.md) · [CODE_REVIEW_FRONTEND.md](CODE_REVIEW_FRONTEND.md)
