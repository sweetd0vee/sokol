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
| Frontend data layer | **7.5 / 10** | API clients, mappers, React Query и контексты дают понятный поток данных; bulk-fetch показывает truncation warning | До роста объёма нужна server-side pagination/search |
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
| C2 | JWT: роль из payload, без lookup в БД | закрыт |
| C3 | `Kantsler` в nav/route как roadmap-задел v2 | принято, не блокер |
| C4 | Demo/import replace scripts могут очистить рабочие данные без prod guard | открыт |
| C5 | CI workflow (backend + frontend lint/test/build) | частично закрыт — workflow проходит после фиксов greenlet и lint |

## Закрыто недавно

- **Ключ проверки** — backend-only: create игнорирует клиентский serial; PATCH пересчитывает при смене даты/руководителя/типа.
- **Frontend** — не генерирует ключ; показывает значение из API.
- **Profile password** — форма смены пароля подключена к `POST /api/v1/auth/change-password`; старое замечание про неподключённую форму закрыто.
- **API docs** — `audit-opinion` убран из `sokol-backend/docs/API.md`; endpoint не заявляется как часть текущего API.
- **BE-02 / JWT lookup** — Bearer auth берёт из token только `sub`, читает пользователя из БД, проверяет `is_active` и берёт роль из БД.
- **API routing / CRUD** — checks/recommendations получили service orchestration, batch endpoint и lifecycle regression tests.
- **Ключ проверки** — PATCH serial теперь синхронизирует `recommendations.serial_number`, `attachments.check_serial_number`, `attachments.bucket` и переносит MinIO objects.
- **Recommendations bulk/delete** — `POST /recommendations/batch` даёт atomic append/replace; delete recommendation чистит attachment rows/objects.
- **Check edit direct URL** — `/checks/:id/edit` дозагружает проверку через `fetchCheck(id)`; edit mode больше не может fallback-нуться в create.
- **Analytics SQL aggregates (BE-08)** — фильтры и агрегаты checks/recommendations/dva/planning/monitoring считаются в PostgreSQL; добавлены analytics indexes.
- **CI backend** — `sqlalchemy[asyncio]` для DB integration tests (`greenlet`).
- **Admin users API** — `GET/POST /api/v1/users` (admin-only); frontend `AdminUsersSection` в профиле.
- **Recommendation RBAC** — `person_match` + `recommendation_access`: auditor удаляет/управляет вложениями только своих рекомендаций; admin — все; delete check — admin only.
- **Batch-delete recommendations** — `POST /recommendations/batch-delete` для отмены импорта из АЗ в одной transaction (fix HTTP 500 от параллельных DELETE).
- **Analytics KPI «Итого»** — единый заголовок блока KPI на всех вкладках; в карточке проверок label «Всего».
- **AZ import undo (frontend)** — после «Добавить в проверку» кнопка «Отменить» удаляет только что загруженные рекомендации через batch-delete.
- **Recommendation form №** — поле показывает yearly номер (часть ID после дефиса), не `sequence_number` внутри проверки.
- **Frontend Kantsler stub** — оставлен в nav/route как осознанный roadmap-задел под v2; не считается блокером пилота.
- **Recommendation save/list errors** — форма рекомендации показывает понятную ошибку при failed save и не выполняет navigate; списки проверок/рекомендаций показывают loading/error state с retry.
- **Frontend list truncation warning** — context сохраняет `total`, а таблицы показывают “Показано X из Y” при bulk-limit 500/1000.
- **Attachments hook** — `useEntityAttachments` больше не вызывает `setState` во время render.

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
| BE-02 | P1 | `sokol-backend/app/api/deps.py`, `sokol-backend/tests/test_auth_rbac.py` | **Закрыто:** Bearer auth больше не доверяет `role` и `display_name` из JWT. | `get_current_user` берёт из token только `sub`, читает пользователя из БД, проверяет `is_active` и формирует `CurrentUser` из БД. `role` в token оставлен как неавторитетная подсказка. | Добавлены regression tests: деактивированный пользователь с валидным JWT получает 401; token роли admin не даёт admin-доступ, если в БД роль auditor. |
| BE-03 | P1 | `sokol-backend/app/api/deps.py`, `sokol-backend/app/core/config.py` | HTTP Basic fallback включён всегда. Для production это второй auth-flow, который сложнее контролировать и логировать. | Добавить настройку `SOKOL_ENABLE_BASIC_AUTH=false` по умолчанию для prod; разрешать Basic только в dev/test или полностью убрать после перехода frontend на login endpoint. | Тесты: при `SOKOL_ENV=prod` Basic не авторизует; Bearer продолжает работать. |
| BE-04 | P1 | `sokol-backend/app/services/recommendations_service.py`, `sokol-backend/app/services/attachments_service.py` | **Закрыто:** удаление рекомендации чистит связанные attachment rows и MinIO objects до удаления recommendation. | При storage failure возвращается 502 и DB transaction откатывается; после успешного cleanup выполняется renumber. | Добавлены service/API regression tests на cleanup и 502 mapping. |
| BE-05 | P1 | `sokol-backend/app/crud/checks_crud.py`, `sokol-backend/app/services/storage/minio_storage.py`, `sokol-backend/app/db/recalculate_check_serial_numbers.py` | **Закрыто:** смена serial переносит objects в новый bucket и обновляет `attachments.bucket`. | Single-check PATCH и mass recalc используют общий `copy_check_bucket_objects`; старый bucket удаляется после commit. | Добавлен regression test на storage copy/delete и cascade execution. |
| BE-06 | P1 | `sokol-backend/app/services/attachments_service.py` | **Закрыто:** upload компенсирует DB failure после успешной загрузки в MinIO. | При исключении в `create_attachment` service удаляет уже загруженный object и логирует cleanup failure отдельно. | Покрыто backend lifecycle regressions. |
| BE-07 | P1 | `sokol-backend/app/db/import_seed_data.py`, `sokol-backend/app/db/seed_demo_data.py`, `sokol-backend/app/db/bootstrap_presentation_demo.py` | `--replace` делает `TRUNCATE recommendations, checks` без dry-run и без явного env guard. Ошибка пути/файла или запуск не на той БД может стереть рабочие данные. | Добавить dry-run summary, подтверждение `--confirm-prod-replace`, запрет replace при `SOKOL_ENV=prod` без отдельного флага, backup warning. | Тесты на запрет replace в prod; dry-run не меняет БД и показывает количество строк. |
| BE-09 | P1 | `app/core/person_match.py`, `app/services/recommendations_service.py`, `app/services/attachments_service.py` | **Закрыто:** granular RBAC между аудиторами для delete recommendation и upload/delete recommendation attachments. | `user_can_manage_recommendation()` + `AccessDeniedError` → 403; check delete и check attachment delete остаются admin-only. | `test_person_match.py`, `test_auth_rbac.py`. |
| BE-10 | P1 | `app/api/v1/endpoints/recommendations.py`, `app/services/recommendations_service.py` | **Закрыто:** undo импорта из АЗ через параллельные DELETE давал HTTP 500. | `POST /recommendations/batch-delete` удаляет ids в одной transaction с одним renumber per check. | `test_delete_recommendations_batch_cleans_and_renumbers_once`. |
| BE-08 | P2 | `sokol-backend/app/services/analytics/sql_*.py`, `app/db/migrate_analytics_indexes.py` | **Закрыто:** analytics загружал всю таблицу в память. | SQL WHERE + `GROUP BY`/conditional counts; indexes по датам/статусам/аудиторам; row-level только для matrix/planning mapping. | `test_analytics_sql_filters.py`; существующие analytics API tests. |
| BE-07a | P1 | `sokol-backend/app/db/sync_dictionaries.py`, `sokol-backend/docker/app/entrypoint.sh` | Sync справочников на старте удаляет аудиторов, подразделения и пользователей, которых нет в канонических списках. | В prod делать merge-only без delete или opt-in destructive sync; перед удалением проверять использование в checks/recommendations. | Тест: auditor/department/user, добавленный через API, не удаляется после prod bootstrap. |
| FE-01 | P0 | `sokol-frontend/src/components/checks/CheckFormPage.tsx`, `sokol-frontend/src/api/checks.ts` | **Закрыто:** edit `/checks/:id/edit` больше не зависит только от `location.state` или первых 500 checks. | Добавлены `fetchCheck(id)` и `useQuery` в edit mode; пока entity грузится показывается `LoadingState`; при ошибке `ErrorState`; edit mode не fallback-ится на create. | Добавлен Vitest на `fetchCheck`; `npm run lint` и `npm test` проходят. |
| FE-02 | accepted | `sokol-frontend/src/App.tsx`, `sokol-frontend/src/components/layout/Sidebar.tsx`, `sokol-frontend/src/components/tabs/KantslerTab.tsx` | `Канцлер` оставлен в production UI как roadmap-задел под вторую версию приложения. | Backend/API интеграции с СЭД Канцлер реализовать в v2; текущий экран “В разработке” не блокирует пилот. | `npm run lint`, `npm test` проходят. |
| FE-03 | P1/P2 | `sokol-frontend/src/contexts/SokolDataContext.tsx`, `sokol-frontend/src/components/tabs/ChecksTab.tsx`, `sokol-frontend/src/components/tabs/RecommendationsTab.tsx` | **P1 закрыто:** context сохраняет `total`, таблицы показывают warning “Показано X из Y” при bulk-limit 500/1000 и поясняют, что export работает по загруженной выборке. Остаётся P2: формы/списки всё ещё завязаны на bulk-fetch. | Для списков перейти на server pagination/search; для form lookup использовать endpoint поиска/получения по id/serial, а не только локальный массив. | Unit/component: при `total > items.length` показывается warning; e2e/server mock: поиск элемента за пределами первой страницы всё равно работает. |
| FE-04 | P1 | `sokol-frontend/src/api/recommendations.ts`, `sokol-frontend/src/contexts/SokolDataContext.tsx`, `sokol-frontend/src/components/checks/CheckRecommendationsBlock.tsx` | **Закрыто:** bulk import/replace атомарен; добавлен undo последней загрузки из АЗ. | Frontend использует batch append/replace и `POST /recommendations/batch-delete` для отмены импорта; после add показывается сессия «Отменить». | Vitest на batch API; ручной сценарий undo 30+ рекомендаций. |
| FE-05 | P1 | `sokol-frontend/src/components/attachments/*`, `sokol-frontend/src/components/checks/CheckAttachmentsSection.tsx` | Frontend получает upload limits через `/capabilities`, но не использует `/attachments/storage/status` для общего banner/disabled state при недоступном MinIO. Пользователь узнаёт о проблеме только после действия. | Добавить общий `useStorageStatus` query; при `enabled=false`/`reachable=false` показывать amber/red banner и disabled upload controls; сохранить возможность просмотра metadata, если API позволяет. | Component tests: disabled upload при `reachable=false`; текст ошибки понятен; retry обновляет статус. |
| FE-06 | P1 | `sokol-frontend/src/components/recommendations/RecommendationFormPage.tsx`, `sokol-frontend/src/components/tabs/*` | **Закрыто:** `RecommendationFormPage.saveRecommendation` ловит ошибку save; `ChecksTab`/`RecommendationsTab` показывают `LoadingState`/`ErrorState` и retry для failed list fetch. | Добавить component tests для rejected list query. | Component tests: rejected save показывает ошибку; rejected list query показывает retry UI. |
| FE-07 | P2 | `sokol-frontend/src/utils/exports.ts`, analytics dashboards | Экспорты дашбордов завязаны на DOM capture. Изменение layout, скрытые элементы или шрифты могут ломать PDF/DOCX/HTML без TypeScript ошибок. | Разделить `exports.ts` по форматам; для табличных отчётов строить data-driven export; DOM capture оставить только для визуальных скриншотов и покрыть smoke. | Unit на форматирование строк; smoke export для dashboard с fixture data. |
| FE-11 | P2 | `src/components/recommendations/RecommendationFormPage.tsx`, `src/utils/recommendationYearlyNumber.ts` | **Закрыто:** поле «№» показывало `sequence_number` внутри проверки, а не yearly ID. | `resolveRecommendationYearlyDisplayNumber()` синхронизирует UI с колонкой ID (`YY-N`). | Vitest `recommendationYearlyNumber.test.ts`. |
| FE-12 | P2 | `src/components/recommendations/RecommendationFormPage.tsx`, `src/components/attachments/*` | **Закрыто:** UI delete/attachments не учитывал ownership auditor. | `canManageRecommendation` скрывает delete и блокирует upload/remove saved attachments для чужих рекомендаций. | Ручная проверка auditor vs admin. |
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
