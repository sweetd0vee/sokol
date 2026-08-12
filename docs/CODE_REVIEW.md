# SOKOL — код-ревью

**Дата:** 12 августа 2026  
**Объект:** `sokol-backend`, `sokol-frontend`, legacy `sokol-instruments`

## Как читать оценки

Оценка дана по блокам, а не «проекту целиком»: **8–10** — блок хорошо реализован и пригоден для пилота; **6–7** — работает, но есть заметные эксплуатационные риски; **≤5** — блок нельзя считать готовым без доработки.

## Сводка по блокам

| Блок | Оценка | Насколько хорошо реализовано | Главный риск |
|------|--------|------------------------------|--------------|
| Backend API / CRUD | **8 / 10** | Проверки, рекомендации, справочники и вложения имеют понятные REST-контракты, validation, RBAC и первый DB integration test | Не все lifecycle покрыты integration tests: recommendations, attachments cleanup, import |
| Ключ проверки | **9 / 10** | Генерация и пересчёт перенесены на backend; frontend больше не отправляет `serial_number` | Нужен regression test на каскад при массовых данных |
| Analytics / planning API | **7.5 / 10** | Сервер считает агрегаты единообразно, UI получает готовые camelCase-модели | При росте данных нужны SQL aggregates/cache |
| DOCX tools | **8 / 10** | Раздел II, ссылки, ДЗ и parse recommendations покрыты тестами и отделены в services | Upload/job модель пока синхронная и in-memory |
| Attachments / MinIO | **7 / 10** | Есть API, metadata в PG и MinIO storage abstraction | Нужны policy, backup и cleanup orphan objects |
| Auth / RBAC | **6.5 / 10** | Internal JWT и роли уже закрывают API от анонимного доступа | Нет OIDC, user lookup/is_active и audit log |
| БД / миграции / import | **5.5 / 10** | PostgreSQL-схема рабочая, seed/import существуют | Нет Alembic baseline; ad-hoc миграции рискованны для prod |
| Frontend формы и доменный UX | **7.5 / 10** | Основные workflows аудитора собраны и связаны с API | Есть demo/stub UI, крупные компоненты |
| Frontend data layer | **7 / 10** | API clients, mappers, React Query и контексты дают понятный поток данных | Bulk-fetch без явного warning при truncation |
| Frontend analytics/export | **7.5 / 10** | Дашборды и экспорты ценны для пользователя | DOM capture/export хрупкие, planning export выключен |
| Тесты / CI | **7 / 10** | Backend unittest/integration, frontend Vitest, Playwright smoke и GitHub Actions workflow уже ловят часть регрессий | Branch protection gate надо включить в GitHub; нет e2e бизнес-сценариев |
| Документация / runbook | **7 / 10** | Основные README/docs покрывают запуск, API, storage, go-live | Часть roadmap/env docs ещё надо синхронизировать с кодом |

**Вердикт:** ограниченный пилот возможен на контролируемом объёме данных. Для промышленного контура сначала закрыть Alembic, CI, prod auth guards, скрытие demo UI и эксплуатацию MinIO.

## Сильные стороны

- HTTP → CRUD → PostgreSQL / API clients → React Query → UI.
- Server analytics, DOCX Раздел II (104 unit-теста на Python 3.12).
- JWT + RBAC; `serial_number` генерируется и пересчитывается на backend (create + PATCH, каскад на recommendations/attachments).
- Экспорт таблиц и дашбордов на frontend.

## Тесты (12.08.2026)

| Пакет | Результат |
|-------|-----------|
| Backend `py -3.12 -m unittest discover -s tests` | **104 теста, OK** (1 skipped) |
| Frontend `npm run lint` | **0 errors, 0 warnings** |
| Frontend `npm test` | **44 теста, 8 файлов, OK** |
| Frontend `npm run test:e2e` | **2 Playwright smoke-теста, OK** |

> Backend требует **Python 3.12** (union types в моделях).

## Критические риски

| ID | Риск | Статус |
|----|------|--------|
| C1 | Нет Alembic — ad-hoc `migrate_*.py` | открыт |
| C2 | JWT: роль из payload, без lookup в БД | открыт |
| C3 | Demo UI: `Kantsler` виден в production nav/route | открыт |
| C4 | Demo/import replace scripts могут очистить рабочие данные без prod guard | открыт |
| C5 | CI workflow есть; required checks надо включить в GitHub branch protection | частично закрыт |

## Закрыто недавно

- **Ключ проверки** — backend-only: create игнорирует клиентский serial; PATCH пересчитывает при смене даты/руководителя/типа.
- **Frontend** — не генерирует ключ; показывает значение из API.
- **Profile password** — форма смены пароля подключена к `POST /api/v1/auth/change-password`; старое замечание про неподключённую форму закрыто.
- **API docs** — `audit-opinion` убран из `sokol-backend/docs/API.md`; endpoint не заявляется как часть текущего API.

## Топ рекомендаций

1. Alembic baseline (P0)
2. Скрыть Kantsler из production nav/route (P0)
3. CI: включить required checks по [CI.md](CI.md) (P1)
4. JWT lookup user + `is_active` (P1)
5. «Показано N из total» в таблицах (P1)
6. MinIO policy + backup/restore runbook (P1)

## Подробный backlog исправлений

Эти пункты сформулированы так, чтобы по ним можно было сразу заводить задачи. Приоритет означает риск для пилота/go-live, а не размер работы.

| ID | Приоритет | Где смотреть | Что не так | Как исправить | Какие тесты добавить |
|----|-----------|--------------|------------|---------------|----------------------|
| BE-01 | P0 | `sokol-backend/app/db/init_db.py`, `sokol-backend/app/db/migrate_*.py` | Схема живёт через `Base.metadata.create_all()` и набор ad-hoc миграций. На UAT/prod нельзя надёжно понять, какие изменения уже применены, нет rollback/history. | Ввести Alembic baseline от текущей схемы; перенести существующие `migrate_*.py` в версии или зафиксировать их как already-applied; запускать `alembic upgrade head` в deploy/runbook. | Smoke на пустой БД: `upgrade head` создаёт таблицы; повторный `upgrade head` no-op; downgrade хотя бы для новых миграций. |
| BE-02 | P1 | `sokol-backend/app/api/deps.py`, `sokol-backend/app/api/v1/endpoints/auth.py` | Bearer auth доверяет `role` и `display_name` из JWT без lookup пользователя в БД. Если пользователя деактивировали или поменяли роль, старый token действует до истечения TTL. | В `get_current_user` брать `sub` из JWT, читать пользователя из БД, проверять `is_active`, роль брать из БД. `role` в token оставить только как cache/diagnostic или убрать. | Тест: деактивированный пользователь с валидным JWT получает 401; пользователь с изменённой ролью больше не проходит admin endpoint. |
| BE-03 | P1 | `sokol-backend/app/api/deps.py`, `sokol-backend/app/core/config.py` | HTTP Basic fallback включён всегда. Для production это второй auth-flow, который сложнее контролировать и логировать. | Добавить настройку `SOKOL_ENABLE_BASIC_AUTH=false` по умолчанию для prod; разрешать Basic только в dev/test или полностью убрать после перехода frontend на login endpoint. | Тесты: при `SOKOL_ENV=prod` Basic не авторизует; Bearer продолжает работать. |
| BE-04 | P1 | `sokol-backend/app/crud/recommendations_crud.py`, `sokol-backend/app/api/v1/endpoints/recommendations.py`, `sokol-backend/app/models/attachments.py` | Удаление рекомендации удаляет только строку recommendation. Вложения рекомендации не имеют FK и остаются в таблице `attachments` и MinIO как orphan objects. | Перед удалением recommendation найти attachments по `entity_type="recommendation"`/`entity_id`; удалить objects из MinIO; удалить rows; затем удалить recommendation и renumber. Ошибки MinIO логировать и возвращать понятный 502 или ставить cleanup retry. | Интеграционный тест: delete recommendation удаляет attachment rows и вызывает storage delete; при сбое storage БД не остаётся в полуудалённом состоянии. |
| BE-05 | P1 | `sokol-backend/app/crud/checks_crud.py`, `sokol-backend/app/services/storage/minio_storage.py` | При изменении полей ключа проверки обновляется `attachments.check_serial_number`, но `bucket` остаётся старым. Получается несоответствие “один bucket на serial_number”: новые metadata указывают на новый serial, а файлы физически лежат в старом bucket. | При смене serial либо переносить objects в новый bucket и обновлять `bucket`, либо отказаться от bucket-per-serial и документировать стабильный bucket key. После успешного переноса удалять старый bucket. | Тест на PATCH check leader/type/date: attachment rows получают новый serial и новый bucket; download/delete продолжают работать. |
| BE-06 | P1 | `sokol-backend/app/api/v1/endpoints/attachments.py` | Upload сначала кладёт файл в MinIO, потом пишет row в БД. Если `create_attachment` падает, object остаётся orphan в MinIO. | Обернуть в compensate flow: при исключении после upload удалить object; логировать cleanup failure отдельно. Для больших файлов рассмотреть streaming и checksum. | Тест: mock `create_attachment` падает, storage.delete_object вызван. |
| BE-07 | P1 | `sokol-backend/app/db/import_seed_data.py`, `sokol-backend/app/db/seed_demo_data.py`, `sokol-backend/app/db/bootstrap_presentation_demo.py` | `--replace` делает `TRUNCATE recommendations, checks` без dry-run и без явного env guard. Ошибка пути/файла или запуск не на той БД может стереть рабочие данные. | Добавить dry-run summary, подтверждение `--confirm-prod-replace`, запрет replace при `SOKOL_ENV=prod` без отдельного флага, backup warning. | Тесты на запрет replace в prod; dry-run не меняет БД и показывает количество строк. |
| FE-01 | P0 | `sokol-frontend/src/App.tsx`, `sokol-frontend/src/components/layout/Sidebar.tsx`, `sokol-frontend/src/components/tabs/KantslerTab.tsx` | В production UI виден раздел `Канцлер`, который является заглушкой “В разработке”. Пользователь может принять его за готовый модуль. | Скрыть пункт меню и route за feature flag, либо убрать route до реализации backend/API. Для прямого URL возвращать redirect/404. | E2E: в prod mode меню не содержит `Канцлер`; переход `/kantsler` не показывает stub. |
| FE-02 | P1 | `sokol-frontend/src/contexts/SokolDataContext.tsx`, `sokol-frontend/src/api/checks.ts`, `sokol-frontend/src/api/recommendations.ts` | Глобальный контекст грузит только `checks limit=500` и `recommendations limit=1000`, но UI не показывает, что данные усечены. Формы, списки и экспорты могут работать не со всем портфелем. | Сохранять `total` в context; показывать banner “Показано N из total”; для списков перейти на server pagination/search; для форм искать check/recommendation по API, а не только в локальном массиве. | Unit: при `total > items.length` показывается warning; e2e/server mock: поиск элемента за пределами первой страницы всё равно работает. |
| FE-03 | P1 | `sokol-frontend/src/contexts/SokolDataContext.tsx` | `replaceRecommendationsForCheck` сначала параллельно удаляет все старые рекомендации, потом параллельно создаёт новые. При частичном сбое данные проверки можно потерять или получить неполный набор. | Перенести bulk replace на backend endpoint с одной транзакцией; frontend отправляет desired list и получает итоговый список. До backend endpoint хотя бы делать последовательный flow с rollback warning и явным error state. | Тест: если create второй рекомендации падает, старые данные не удалены; при успехе порядок `sequence_number` стабилен. |
| FE-04 | P1 | `sokol-frontend/src/components/attachments/*`, `sokol-frontend/src/components/checks/CheckAttachmentsSection.tsx` | Frontend получает upload limits через `/capabilities`, но не использует `/attachments/storage/status` для общего banner/disabled state при недоступном MinIO. Пользователь узнаёт о проблеме только после действия. | Добавить общий `useStorageStatus` query; при `enabled=false`/`reachable=false` показывать amber/red banner и disabled upload controls; сохранить возможность просмотра metadata, если API позволяет. | Component tests: disabled upload при `reachable=false`; текст ошибки понятен; retry обновляет статус. |
| FE-05 | P2 | `sokol-frontend/src/utils/exports.ts`, analytics dashboards | Экспорты дашбордов завязаны на DOM capture. Изменение layout, скрытые элементы или шрифты могут ломать PDF/DOCX/HTML без TypeScript ошибок. | Разделить `exports.ts` по форматам; для табличных отчётов строить data-driven export; DOM capture оставить только для визуальных скриншотов и покрыть smoke. | Unit на форматирование строк; smoke export для dashboard с fixture data. |
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
