# Код-ревью backend

**Общая оценка:** 7.4 / 10 · Python 3.12, FastAPI, SQLAlchemy async, MinIO  
**Смысл оценки:** backend уже выглядит как рабочий API для пилота, но промышленная готовность упирается в миграции, auth hardening, lifecycle файлов в MinIO и защиту import/seed операций.

## Архитектура

```
app/api/v1/endpoints/  →  crud/  →  PostgreSQL
                      →  services/reports/  (DOCX)
                      →  services/analytics/
                      →  services/storage/  (MinIO)
```

**Плюсы:** плоская структура, async I/O, DOCX в thread pool, централизованный auth на роутерах.

**Минусы:** нет service layer для CRUD; `app/db/` смешивает seed/migrate/import; дублирование section_ii в `sokol-instruments/`.

## Оценка по блокам

| Блок | Оценка | Что хорошо | Что ограничивает |
|------|--------|------------|------------------|
| API routing / CRUD | **8 / 10** | Роуты разделены по доменам, есть pagination, validation справочников и роли | Бизнес-логика частично живёт в CRUD, integration tests пока закрывают не все lifecycle |
| Checks / ключ проверки | **9 / 10** | `serial_number` генерируется backend-only и пересчитывается на PATCH; каскад на recommendations/attachments | Нужны тесты на массовые пересчёты и конфликтные данные |
| Recommendations | **7.5 / 10** | Статусы, фильтры, связи с проверками и импорт из АЗ покрывают основной workflow | Bulk replace без транзакционного UX на frontend; cleanup файлов при delete открыт |
| Settings / справочники | **8 / 10** | Общий CRUD для словарей, admin-only mutations, validation в доменных create/PATCH | Нет FK на доменные поля, часть связей строковая |
| Analytics | **7.5 / 10** | Серверные агрегаты по checks/recommendations/monitoring/dva/planning согласованы с UI | In-memory подход нормален для пилота, но не для большого портфеля |
| DOCX reports | **8 / 10** | Раздел II, links, memorandum и parser вынесены в services и хорошо тестируются | Нет очереди, streaming upload и golden DOCX CI |
| Attachments / MinIO | **6.5 / 10** | Есть metadata model, storage service, upload/list/download/delete API | Есть orphan-сценарии при delete recommendation, upload DB failure и смене serial |
| Auth / RBAC | **6.5 / 10** | JWT Bearer закрывает API; роли `auditor`/`admin` применены на delete/settings; change-password реализован | Роль берётся из token payload; Basic fallback всегда включён; нет user lookup/is_active на каждый request |
| БД / миграции / import | **5.5 / 10** | `create_all`, seed и import позволяют быстро поднять dev/pilot | Нет Alembic baseline; `migrate_*.py` опасны для повторяемого prod |
| Tests | **7.5 / 10** | Есть auth/attachments/dictionaries/analytics tests и DB-backed checks CRUD integration | Нужны integration tests для recommendations, attachments cleanup, Alembic и serial/MinIO migration |

## Security

| Аспект | Статус |
|--------|--------|
| JWT Bearer | ✅ |
| PBKDF2 пароли | ✅ |
| DELETE / settings | admin only ✅ |
| Role из JWT без DB lookup | ⚠️ P1 |
| Default JWT secret в dev | ⚠️ override на prod |
| HTTP Basic fallback | ⚠️ отключить/feature-flag на prod |

## API

- Pagination checks/recommendations: skip/limit ✅
- Dictionary validation на create/update ✅
- Analytics: in-memory по всей БД — OK до ~1k записей
- Attachments + MinIO ✅

### Ключ проверки ✅

`checks_crud.py`: create генерирует unique serial; PATCH пересчитывает при смене `start_date` / `check_leader` / `check_type`; каскад на `recommendations.serial_number` и `attachments.check_serial_number`.

## DOCX tools

| Tool | Статус |
|------|--------|
| Раздел II (+ links) | ✅ реализовано, ~70+ parser tests |
| Докладная / parse-recommendations | ✅ |

`audit-opinion` не считается частью текущего API: endpoint/routes отсутствуют и уже не описаны в `docs/API.md`. Оставшиеся `SOKOL_OLLAMA_*` — backlog/env-хвост, не готовая функция.

## БД

- Схема: `create_all` + `migrate_*.py` — **нет Alembic** (P0).
- Import `--replace` опасен на prod.
- Entrypoint: init → migrate → seed → optional demo.

## Тесты

104 теста на Python 3.12 (1 skipped). Сильное покрытие section_ii, auth/RBAC, dictionary validation, analytics и smoke attachments. DB-backed integration уже есть для checks CRUD, но нет такого же покрытия для recommendations lifecycle, cleanup вложений, import replace и миграций.

## Подробные findings

### BE-01 · P0 · Нет Alembic baseline

**Где:** `app/db/init_db.py`, `app/db/migrate_*.py`, `tests/test_checks_crud_integration.py`.

**Симптом:** dev/test поднимают схему через `Base.metadata.create_all()`, а изменения накатываются отдельными скриптами `migrate_*.py`. В `tests/test_checks_crud_integration.py` схема также создаётся напрямую из metadata.

**Риск:** на UAT/prod невозможно надёжно воспроизвести историю схемы, проверить порядок миграций и откатить неудачное изменение. Разные окружения могут иметь разные наборы колонок/индексов, хотя код уже ожидает новые поля.

**Как исправить:**

1. Добавить Alembic в backend dependencies.
2. Создать baseline revision по текущему состоянию моделей.
3. Зафиксировать, какие существующие `migrate_*.py` считаются уже применёнными.
4. В deploy/runbook заменить `init_db/create_all` для prod на `alembic upgrade head`.
5. Оставить `create_all` только для локального ephemeral dev/test, если это действительно нужно.

**Тесты:** пустая PostgreSQL БД → `alembic upgrade head` → приложение стартует; повторный `upgrade head` не меняет схему; новая миграция имеет downgrade или явно documented no-downgrade.

### BE-02 · P1 · Bearer auth доверяет role из JWT

**Где:** `app/api/deps.py`, `app/api/v1/endpoints/auth.py`, `app/models/users.py`.

**Симптом:** `get_current_user` декодирует token и возвращает `CurrentUser` из полей `sub`, `role`, `display_name`. База пользователей не читается для Bearer-запроса. `change-password` уже делает lookup и проверяет `is_active`, но остальные endpoints нет.

**Риск:** если пользователя деактивировали, поменяли роль или удалили, старый token продолжит давать доступ до истечения TTL. При текущем TTL 480 минут это почти рабочий день.

**Как исправить:**

1. После decode брать только `sub` из token.
2. Читать пользователя через `get_user_by_username(session, username)`.
3. Проверять `user is not None` и `user.is_active`.
4. Формировать `CurrentUser` из БД, а не из token.
5. Решить судьбу `role` в token: убрать или оставить как неавторитетную подсказку.

**Тесты:** валидный JWT деактивированного пользователя возвращает 401; пользователь с token роли admin, но ролью auditor в БД, получает 403 на admin endpoint.

### BE-03 · P1 · HTTP Basic fallback включён всегда

**Где:** `app/api/deps.py`, `app/core/config.py`.

**Симптом:** `get_current_user` принимает и Bearer, и Basic credentials. Basic не ограничен dev/test окружением.

**Риск:** появляется второй способ входа, который легко забыть при hardening. Он не нужен frontend login flow и усложняет аудит доступа.

**Как исправить:** добавить `SOKOL_ENABLE_BASIC_AUTH`; по умолчанию разрешить в development/test, запретить в prod. В `get_current_user` не проверять `_basic`, если flag выключен.

**Тесты:** при prod config Basic получает 401, Bearer продолжает работать.

### BE-04 · P1 · Delete recommendation оставляет orphan attachments

**Где:** `app/crud/recommendations_crud.py`, `app/api/v1/endpoints/recommendations.py`, `app/models/attachments.py`, `app/services/storage/minio_storage.py`.

**Симптом:** `delete_recommendation` удаляет recommendation и renumber, но не трогает attachments. У `Attachment` нет FK на recommendation/check, только `entity_type`, `entity_id`, `check_serial_number`, `bucket`, `object_key`.

**Риск:** после удаления рекомендации остаются строки attachments и файлы в MinIO. UI может больше не показывать эти файлы, но storage будет расти, backup/restore станет грязным, а download по прямому attachment id может остаться возможным.

**Как исправить:**

1. Добавить CRUD helper `list_attachments(entity_type="recommendation", entity_id=recommendation.id)`.
2. В delete recommendation удалить MinIO objects и DB rows.
3. Определить политику ошибки: fail whole delete при MinIO 502 или удалить DB и поставить cleanup retry.
4. Добавить административный orphan cleanup script/report.

**Тесты:** deletion удаляет rows и вызывает `storage.delete_object`; при storage failure возвращается ожидаемый статус и recommendation не исчезает silently.

### BE-05 · P1 · Смена serial_number не переносит MinIO bucket

**Где:** `app/crud/checks_crud.py`, `app/services/storage/minio_storage.py`, `app/db/recalculate_check_serial_numbers.py`.

**Симптом:** при PATCH проверки, если меняются `start_date`, `check_leader` или `check_type`, код обновляет `recommendations.serial_number` и `attachments.check_serial_number`. Но `Attachment.bucket` остаётся старым, а объекты физически остаются в bucket старого serial.

**Риск:** нарушается инвариант storage service “один bucket на проверку по serial_number”. Delete check удалит objects по старому `attachment.bucket`, но затем попробует удалить bucket нового serial, а старый bucket может остаться пустым. Скрипты синхронизации bucket по serial тоже будут видеть неполную картину.

**Как исправить:** выбрать один инвариант:

1. **Bucket следует за serial:** при смене serial создать новый bucket, скопировать objects, обновить `Attachment.bucket`, удалить старые objects/bucket после commit.
2. **Bucket стабилен:** хранить bucket по immutable `check.id`, а serial использовать только как metadata/display.

Для текущей архитектуры быстрее первый вариант, потому что `check_bucket_name(serial_number)` уже используется в storage.

**Тесты:** создать check + attachment, изменить leader/date/type, проверить новый serial, новый bucket, успешный download и delete cleanup.

### BE-06 · P1 · Upload может оставить object без DB row

**Где:** `app/api/v1/endpoints/attachments.py`.

**Симптом:** endpoint загружает файл в MinIO, затем создаёт `Attachment` row. Если DB commit падает после успешного upload, object остаётся в MinIO без metadata.

**Риск:** orphan files не видны пользователю, но занимают storage и попадают в backup.

**Как исправить:** обернуть создание row в `try/except`; если после `storage.upload` падает `create_attachment`, вызвать `storage.delete_object(stored.bucket, stored.object_key)` и залогировать результат cleanup.

**Тесты:** mock `create_attachment` бросает исключение, `delete_object` вызван один раз.

### BE-07 · P1 · Import/seed replace опасен для рабочей БД

**Где:** `app/db/import_seed_data.py`, `app/db/seed_demo_data.py`, `app/db/bootstrap_presentation_demo.py`.

**Симптом:** `--replace` делает `TRUNCATE TABLE recommendations, checks RESTART IDENTITY CASCADE`. `bootstrap_presentation_demo` по умолчанию вызывает replace.

**Риск:** запуск не в той среде стирает рабочие проверки и рекомендации. Сейчас защита только организационная.

**Как исправить:** запретить replace при `SOKOL_ENV=prod` без явного `--confirm-prod-replace`; добавить dry-run, отчёт сколько строк будет удалено/создано, и backup warning.

**Тесты:** prod replace без confirm падает; dry-run не меняет БД; replace требует database name с `test/demo` в тестовом сценарии.

### BE-08 · P2 · Analytics in-memory масштабируется только для пилота

**Где:** `app/services/analytics/*`, `app/api/v1/endpoints/analytics.py`.

**Симптом:** аналитические сервисы возвращают полезные агрегаты, но значимая часть расчётов держится в Python-слое после выборки данных.

**Риск:** при росте портфеля проверки/рекомендации начнут тормозить dashboards и экспорты; pagination в CRUD не решает analytics.

**Как исправить:** самые тяжёлые агрегаты перенести в SQL `GROUP BY`; добавить индексы по датам, статусам, serial/check_id; для dashboard использовать cache с invalidation после CRUD.

**Тесты:** performance fixture на 5k/20k rows; snapshot агрегатов до/после SQL rewrite.

## Findings

| Приоритет | Finding |
|-----------|---------|
| P0 | Alembic |
| P0 | Guard demo import на prod |
| P1 | JWT user lookup |
| P1 | Recommendation/attachment cleanup integration tests |
| P1 | Serial change → MinIO bucket migration |
| P2 | Analytics SQL aggregates при росте данных |
| P3 | Consolidate sokol-instruments |

Задачи: [ACTION_PLAN.md](ACTION_PLAN.md)
