# SOKOL — код-ревью

**Дата:** 19 августа 2026  
**Объект:** `sokol-backend`, `sokol-frontend`

## Как читать оценки

Оценка дана по блокам, а не «проекту целиком»: **8–10** — блок хорошо реализован и пригоден для пилота; **6–7** — работает, но есть заметные эксплуатационные риски; **≤5** — блок нельзя считать готовым без доработки.

## Сводка по блокам

| Блок | Оценка | Насколько хорошо реализовано | Главный риск |
|------|--------|------------------------------|--------------|
| Backend API / CRUD | **10 / 10** | Проверки, рекомендации, справочники и вложения имеют доменные services, понятные REST-контракты, validation, RBAC, FK-справочники и lifecycle tests | Остался платформенный риск вне CRUD: Alembic |
| Ключ проверки | **10 / 10** | `serial_number` генерируется backend-only, PATCH синхронизирует recommendations/attachments и переносит MinIO bucket | Нужен только production runbook для редких ручных mass-recalc операций |
| Analytics / planning API | **8.5 / 10** | Сервер считает агрегаты в PostgreSQL; UI получает те же camelCase-модели | Для planning department matching ещё нужна точечная выборка строк |
| DOCX tools | **8 / 10** | Раздел II, ссылки, ДЗ и parse recommendations покрыты тестами и отделены в services | Upload/job модель пока синхронная и in-memory |
| Attachments / MinIO | **8.5 / 10** | Есть API, metadata в PG, MinIO storage abstraction, compensation и serial bucket migration | Нужны policy, backup/restore и общий storage UX |
| Auth / RBAC | **8.5 / 10** | Internal JWT, DB-backed lookup/`is_active`, admin users API, granular ownership; HTTP Basic выключен в prod | Нет OIDC и audit log |
| БД / миграции / import | **6 / 10** | PostgreSQL-схема рабочая; FK на справочники; prod guards на demo/replace и merge-only sync | Нет Alembic baseline |
| Frontend формы и доменный UX | **8.5 / 10** | Workflows аудитора, undo импорта из АЗ, RBAC UI для delete/attachments, yearly ID в форме рекомендации | Есть demo/stub UI, крупные компоненты |
| Frontend data layer | **7.5 / 10** | API clients, mappers, React Query и контексты дают понятный поток данных; списки грузят до 10000 строк за запрос | При росте сверх 10000 нужна server-side pagination/search |
| Frontend analytics/export | **7.5 / 10** | Дашборды и экспорты ценны для пользователя | DOM capture/export хрупкие, planning export выключен |
| Тесты / CI | **8.5 / 10** | Backend **172** unit tests (+ DB integration), frontend 54 Vitest, GitHub Actions (lint/test/build) | Branch protection gate надо включить в GitHub; нет e2e бизнес-сценариев |
| Документация / runbook | **8 / 10** | README/docs покрывают запуск, API, storage, FK-справочники, prod guards | Alembic runbook ещё целевой |

**Вердикт:** ограниченный пилот возможен на контролируемом объёме данных. Для промышленного контура сначала закрыть Alembic, CI merge gate и эксплуатацию MinIO.

## Сильные стороны

- HTTP → services → CRUD → PostgreSQL / API clients → React Query → UI.
- Server analytics в PostgreSQL (`sql_filters` / `sql_aggregates`), DOCX Раздел II и backend lifecycle regressions (**172** unit-тестов).
- JWT + RBAC с lookup пользователя в БД; HTTP Basic выключен в prod; FK-справочники с 409 на in-use delete.
- `serial_number` генерируется и пересчитывается на backend (create + PATCH, каскад на recommendations/attachments).
- Экспорт таблиц и дашбордов на frontend.

## Тесты (19.08.2026)

| Пакет | Результат |
|-------|-----------|
| Backend `python -m unittest discover -s tests` | **172 test cases** (2 skipped) |
| Frontend `npm run lint` | **0 errors, 0 warnings** |
| Frontend `npm test` | **54 теста, 10 файлов, OK** |
| Frontend `npx playwright test e2e/auth.spec.ts` | **5 Playwright auth smoke-тестов, OK** |

> Backend требует **Python 3.12+**.

## Критические риски

| ID | Риск | Статус |
|----|------|--------|
| C1 | Нет Alembic — ad-hoc `migrate_*.py` | открыт |
| C4 | Demo/import replace без prod guard | закрыт: `SOKOL_ENV=prod` запрещает demo/replace |
| C5 | CI workflow (backend + frontend lint/test/build) | открыто: включить required checks merge gate |

## Топ рекомендаций

1. Alembic baseline (P0)
2. Server-side pagination/search для таблиц (P2)
3. CI: включить required checks по [CI.md](CI.md) (P1)
4. MinIO policy + backup/restore runbook (P1)
5. Split frontend exports / data-driven export smoke (P2)

## Подробный backlog исправлений

Эти пункты сформулированы так, чтобы по ним можно было сразу заводить задачи. Приоритет означает риск для пилота/go-live, а не размер работы.

| ID | Приоритет | Где смотреть | Что не так | Как исправить | Какие тесты добавить |
|----|-----------|--------------|------------|---------------|----------------------|
| BE-01 | P0 | `sokol-backend/app/db/init_db.py`, `sokol-backend/app/db/migrate_*.py` | Схема живёт через `Base.metadata.create_all()` и набор ad-hoc миграций. На UAT/prod нельзя надёжно понять, какие изменения уже применены, нет rollback/history. | Ввести Alembic baseline от текущей схемы; перенести существующие `migrate_*.py` в версии или зафиксировать их как already-applied; запускать `alembic upgrade head` в deploy/runbook. | Smoke на пустой БД: `upgrade head` создаёт таблицы; повторный `upgrade head` no-op; downgrade хотя бы для новых миграций. |
| BE-01a | P0 · частично | `entrypoint.sh`, `startup_validation.py` | Compose в development всё ещё грузит demo (`SOKOL_LOAD_DEMO_DATA=1`). Prod (`SOKOL_ENV=prod`) demo/replace уже запрещает. | Для prod-стенда явно `SOKOL_ENV=prod` и `SOKOL_LOAD_DEMO_DATA=0`; при желании сменить compose default на `0`. | Уже есть: prod + demo/replace flags падают. |
| BE-03 | P1 · закрыт | `app/api/deps.py`, `app/core/config.py` | — | `SOKOL_ENABLE_BASIC_AUTH`; в prod Basic выключен; deactivated user → 401. | `test_auth_rbac.py`: Basic on/off и inactive user. |
| BE-07 | P1 · закрыт | `import_seed_data.py`, `seed_demo_data.py` | — | Prod replace без `--confirm-prod-replace` падает. | `test_startup_validation.py`. |
| BE-07a | P1 · закрыт | `sync_dictionaries.py` | — | Prod merge-only; in-use labels не удаляются. | unit на `destructive_dictionary_sync_enabled`. |
| FE-05 | P1 | `sokol-frontend/src/components/attachments/*`, `sokol-frontend/src/components/checks/CheckAttachmentsSection.tsx` | Frontend получает upload limits через `/capabilities`, но не использует `/attachments/storage/status` для общего banner/disabled state при недоступном MinIO. Пользователь узнаёт о проблеме только после действия. | Добавить общий `useStorageStatus` query; при `enabled=false`/`reachable=false` показывать amber/red banner и disabled upload controls; сохранить возможность просмотра metadata, если API позволяет. | Component tests: disabled upload при `reachable=false`; текст ошибки понятен; retry обновляет статус. |
| FE-07 | P2 | `sokol-frontend/src/utils/exports.ts`, analytics dashboards | Экспорты дашбордов завязаны на DOM capture. Изменение layout, скрытые элементы или шрифты могут ломать PDF/DOCX/HTML без TypeScript ошибок. | Разделить `exports.ts` по форматам; для табличных отчётов строить data-driven export; DOM capture оставить только для визуальных скриншотов и покрыть smoke. | Unit на форматирование строк; smoke export для dashboard с fixture data. |
| OPS-01 | P1 | `.github/workflows/ci.yml`, `docs/CI.md`, GitHub settings | Workflow есть, но обязательность merge gate включается только branch protection/ruleset. Пока required checks не включены в GitHub, красный CI не блокирует merge. | Включить required checks `Backend (Python 3.12)` и `Frontend (Node 22)` для main/master; включить up-to-date branches. | Проверка PR: merge button заблокирован при красном/ожидающем CI. |

## Как исправлять без регрессий

1. Сначала закрыть P0/P1, которые могут повредить данные: Alembic, auth lookup, orphan cleanup, bulk replace.
2. Любое изменение в serial number / attachments проверять сквозным сценарием: создать проверку → загрузить файл → изменить лидера/дату/тип → скачать файл → удалить проверку.
3. Любое изменение списков проверять на данных больше лимита: минимум 501 checks и 1001 recommendations.
4. Для frontend fixes добавлять unit/component тест рядом с helper/component, а для критичных маршрутов — Playwright smoke.
5. Для backend fixes добавлять HTTP test на endpoint и, если меняется БД, DB-backed integration test с `SOKOL_RUN_DB_INTEGRATION_TESTS=1`.

Детали: [ACTION_PLAN.md](ACTION_PLAN.md) · [PLAN.md](../PLAN.md)

## Отчёты

- [CODE_REVIEW_BACKEND.md](CODE_REVIEW_BACKEND.md)
- [CODE_REVIEW_FRONTEND.md](CODE_REVIEW_FRONTEND.md)
