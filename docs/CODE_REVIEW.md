# SOKOL — код-ревью

**Дата:** 12 августа 2026  
**Объект:** `sokol-backend`, `sokol-frontend`

## Как читать оценки

Оценка дана по блокам, а не «проекту целиком»: **8–10** — блок хорошо реализован и пригоден для пилота; **6–7** — работает, но есть заметные эксплуатационные риски; **≤5** — блок нельзя считать готовым без доработки.

## Сводка по блокам

| Блок | Оценка | Насколько хорошо реализовано | Главный риск |
|------|--------|------------------------------|--------------|
| Backend API / CRUD | **10 / 10** | Проверки, рекомендации, справочники и вложения имеют доменные services, понятные REST-контракты, validation, RBAC и lifecycle tests | Остались платформенные риски вне CRUD: Alembic/import/prod guards |
| Ключ проверки | **10 / 10** | `serial_number` генерируется backend-only, PATCH синхронизирует recommendations/attachments и переносит MinIO bucket | Нужен только production runbook для редких ручных mass-recalc операций |
| Analytics / planning API | **8.5 / 10** | Сервер считает агрегаты в PostgreSQL; UI получает те же camelCase-модели | Для planning department matching ещё нужна точечная выборка строк |
| DOCX tools | **8 / 10** | Раздел II, ссылки, ДЗ и parse recommendations покрыты тестами и отделены в services | Upload/job модель пока синхронная и in-memory |
| Attachments / MinIO | **8 / 10** | Есть API, metadata в PG, MinIO storage abstraction, compensation и serial bucket migration | Нужны policy, backup/restore и общий storage UX |
| Auth / RBAC | **8 / 10** | Internal JWT, DB-backed lookup/`is_active`, admin users API, granular ownership для recommendations/attachments через `person_match` | Нет OIDC, HTTP Basic fallback и audit log |
| БД / миграции / import | **5.5 / 10** | PostgreSQL-схема рабочая, seed/import существуют | Нет Alembic baseline; ad-hoc миграции рискованны для prod |
| Frontend формы и доменный UX | **8.5 / 10** | Workflows аудитора, undo импорта из АЗ, RBAC UI для delete/attachments, yearly ID в форме рекомендации | Есть demo/stub UI, крупные компоненты |
| Frontend data layer | **7.5 / 10** | API clients, mappers, React Query и контексты дают понятный поток данных; списки грузят до 10000 строк за запрос | При росте сверх 10000 нужна server-side pagination/search |
| Frontend analytics/export | **7.5 / 10** | Дашборды и экспорты ценны для пользователя | DOM capture/export хрупкие, planning export выключен |
| Тесты / CI | **8 / 10** | Backend 139 unit tests (+ DB integration), frontend 54 Vitest, GitHub Actions (lint/test/build) | Branch protection gate надо включить в GitHub; нет e2e бизнес-сценариев |
| Документация / runbook | **7 / 10** | Основные README/docs покрывают запуск, API, storage, go-live | Часть roadmap/env docs ещё надо синхронизировать с кодом |

**Вердикт:** ограниченный пилот возможен на контролируемом объёме данных. Для промышленного контура сначала закрыть Alembic, CI, prod auth guards, скрытие demo UI и эксплуатацию MinIO.

## Сильные стороны

- HTTP → CRUD → PostgreSQL / API clients → React Query → UI.
- Server analytics в PostgreSQL (`sql_filters` / `sql_aggregates`), DOCX Раздел II и backend lifecycle regressions (**139** unit-тестов на Python 3.12).
- JWT + RBAC с lookup пользователя в БД; `serial_number` генерируется и пересчитывается на backend (create + PATCH, каскад на recommendations/attachments).
- Экспорт таблиц и дашбордов на frontend.

## Тесты (12.08.2026)

| Пакет | Результат |
|-------|-----------|
| Backend `py -3.12 -m unittest discover -s tests` | **139 test cases** (полный suite в CI с deps; 2 skipped) |
| Frontend `npm run lint` | **0 errors, 0 warnings** |
| Frontend `npm test` | **54 теста, 10 файлов, OK** |
| Frontend `npx playwright test e2e/auth.spec.ts` | **5 Playwright auth smoke-тестов, OK** |

> Backend требует **Python 3.12** (union types в моделях).

## Критические риски

| ID | Риск | Статус |
|----|------|--------|
| C1 | Нет Alembic — ad-hoc `migrate_*.py` | открыт |
| C4 | Demo/import replace scripts могут очистить рабочие данные без prod guard | открыт |
| C5 | CI workflow (backend + frontend lint/test/build) | открыто: включить required checks merge gate |

## Топ рекомендаций

1. Alembic baseline (P0)
2. Server-side pagination/search для таблиц (P2)
3. CI: включить required checks по [CI.md](CI.md) (P1)
4. HTTP Basic fallback: отключить/feature-flag для prod (P1)
5. MinIO policy + backup/restore runbook (P1)
6. Split frontend exports / data-driven export smoke (P2)

## Подробный backlog исправлений

Эти пункты сформулированы так, чтобы по ним можно было сразу заводить задачи. Приоритет означает риск для пилота/go-live, а не размер работы.

| ID | Приоритет | Где смотреть | Что не так | Как исправить | Какие тесты добавить |
|----|-----------|--------------|------------|---------------|----------------------|
| BE-01 | P0 | `sokol-backend/app/db/init_db.py`, `sokol-backend/app/db/migrate_*.py` | Схема живёт через `Base.metadata.create_all()` и набор ad-hoc миграций. На UAT/prod нельзя надёжно понять, какие изменения уже применены, нет rollback/history. | Ввести Alembic baseline от текущей схемы; перенести существующие `migrate_*.py` в версии или зафиксировать их как already-applied; запускать `alembic upgrade head` в deploy/runbook. | Smoke на пустой БД: `upgrade head` создаёт таблицы; повторный `upgrade head` no-op; downgrade хотя бы для новых миграций. |
| BE-01a | P0 | `sokol-backend/docker/app/entrypoint.sh`, `sokol-backend/docker/app/docker-compose.yml` | Docker backend по умолчанию ставит `SOKOL_LOAD_DEMO_DATA=1`; на пустой БД entrypoint импортирует demo Excel, а `SOKOL_SEED_REPLACE=1` включает replace. | Поменять default на `0`; в prod startup validation запрещать demo load/seed replace без явного break-glass confirm. | Тест startup validation: prod + demo/replace flags падает; compose/runbook проверены на default `0`. |
| BE-03 | P1 | `sokol-backend/app/api/deps.py`, `sokol-backend/app/core/config.py` | HTTP Basic fallback включён всегда. Для production это второй auth-flow, который сложнее контролировать и логировать. | Добавить настройку `SOKOL_ENABLE_BASIC_AUTH=false` по умолчанию для prod; разрешать Basic только в dev/test или полностью убрать после перехода frontend на login endpoint. | Тесты: при `SOKOL_ENV=prod` Basic не авторизует; Bearer продолжает работать. |
| BE-07 | P1 | `sokol-backend/app/db/import_seed_data.py`, `sokol-backend/app/db/seed_demo_data.py`, `sokol-backend/app/db/bootstrap_presentation_demo.py` | `--replace` делает `TRUNCATE recommendations, checks` без dry-run и без явного env guard. Ошибка пути/файла или запуск не на той БД может стереть рабочие данные. | Добавить dry-run summary, подтверждение `--confirm-prod-replace`, запрет replace при `SOKOL_ENV=prod` без отдельного флага, backup warning. | Тесты на запрет replace в prod; dry-run не меняет БД и показывает количество строк. |
| BE-07a | P1 | `sokol-backend/app/db/sync_dictionaries.py`, `sokol-backend/docker/app/entrypoint.sh` | Sync справочников на старте удаляет аудиторов, подразделения и пользователей, которых нет в канонических списках. | В prod делать merge-only без delete или opt-in destructive sync; перед удалением проверять использование в checks/recommendations. | Тест: auditor/department/user, добавленный через API, не удаляется после prod bootstrap. |
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
