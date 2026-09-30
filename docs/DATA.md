# Данные

PostgreSQL 16 и MinIO. В Docker compose порты БД/MinIO на хост **не** публикуются (API → `db:5432`, `minio:9000`). Локальный loopback — [DOCKER.md](../DOCKER.md) (`docker-compose.dev-ports.yml` → `127.0.0.1:5433` / `9000`). **Схема — Alembic** (`alembic upgrade head`, ревизия `20260930_0001` = текущие модели). `init_db` / Docker bootstrap вызывают `ensure_schema`: пустая БД → upgrade; старый стенд без `alembic_version` → legacy-патчи + `stamp head` (**строки данных не трогает**). Прямой SQL по `serial_number`, labels и `attachments.bucket` ломает связи: ключи и бакеты двигает только каскад в сервисе.

## Таблицы

| Таблица | Связи |
|---------|--------|
| `checks` | → `recommendations` `ON DELETE CASCADE` |
| `recommendations` | FK `check_id`; `serial_number` денормализован |
| `recommendation_audit_objects` | `(recommendation_id, department_name)` |
| `attachments` | полиморфно `entity_type` + `entity_id`, физического FK на домен нет |
| `auditors` | unique `full_name`, unique `code` (3 латинские буквы) |
| `departments`, `check_kinds`, `effectiveness_ratings` | unique label |
| `audit_types` | `code` + `name`, без unique и без FK в домен |
| `users` | unique `username`; роли `admin` / `department_head` / `auditor` |

Домен ссылается на справочники строками с FK (`ON UPDATE CASCADE`; delete `RESTRICT`, оценки — `SET NULL`). Массив `recommendations.audit_object` дублирует junction для аналитики (GIN).

Enum-значения пишутся как values, API переходы не ограничивает: статусы проверки `not_started` / `in_progress` / `completed`; рекомендации `completed` / `unresolved` / `on_control` / `in_progress`; доп. статус `on_time` / `deadline_violated` / `on_control` / `in_progress`.

## Ключ и поля, которые легко перепутать

`serial_number` уникален, формат `{YY}{AUDITOR_CODE}{QUARTER}{P|V|K}{N}` (`planned`→P, `unscheduled`→V, `thematic`→K). Пример: `26KVS3P1`. `check_type` — код ключа, не FK на `audit_types`. Массовый пересчёт: `python -m app.db.recalculate_check_serial_numbers`.

- `deadline` — срок контроля. Перенос записывает в него самую позднюю дату. `execution_deadline` автостатус не читает: срок исполнения — `actual_completion_date`.
- `deadline_extensions` / `control_removals` — JSON `{date?, comment?}`.
- Вложения: `slot`, `check_serial_number`, `bucket` = `check-{serial}` в нижнем регистре, `object_key`. Слоты check: `order`, `program`, `az`, `dz`, `dz_appendix`. Слоты рекомендации: `recommendation_files`, `control_removal_files`.
- `users.aliases` — строка через запятую. Аватаров в БД нет. Soft-delete и audit log нет.

API create/update проверяет labels. Неизвестный объект аудита → **400**, пустой → «Не указан». `manager` — свободный текст. Delete in-use и «Не указан» → **409**. Import, в отличие от UI, неизвестные labels досоздаёт.

Индексы аналитики: `checks.start_date` / `status` / `check_leader`, `recommendations.deadline` / `auditor` / `status` / `materiality_level`, GIN `audit_object`, плюс `ix_attachments_entity_lookup`. Период проверок и планирования — `start_date`; рекомендаций и мониторинга — `deadline`.

## Seed, import, миграции

### Alembic (основной путь)

Из `sokol-backend/` при заданном `DATABASE_URL`:

```bash
alembic current
alembic upgrade head
alembic revision --autogenerate -m "add_column_foo"
alembic upgrade head
```

Новое изменение схемы: правка моделей → `alembic revision --autogenerate` → ревью SQL → commit → на стендах `upgrade head`. Baseline `20260930_0001` строит таблицы из `Base.metadata` (включая аналитические индексы в `__table_args__`). **Demo/боевые строки Alembic не удаляет**, пока revision явно не делает `DROP`/`TRUNCATE`.

Существующий стенд без `alembic_version`: при старте API/`init_db` один раз прогонит idempotent legacy-патчи и сделает `stamp head`. Данные checks/recommendations остаются.

### Excel seed / справочники

Excel seed (`checks.xlsx`, `recommendations.xlsx`) — корневой `data/` или `SOKOL_DATA_DIR`. Шаблон файла контроля и картинки существенности — `sokol-backend/data/`. Резолв: `app/utils/paths.py`.

```bash
python -c "import asyncio; from app.db.init_db import init_db; asyncio.run(init_db())"
python -m app.db.seed_auditors
python -m app.db.seed_departments
python -m app.db.seed_audit_types
python -m app.db.seed_check_kinds
python -m app.db.seed_effectiveness_ratings
python -m app.db.seed_users
python -m app.db.import_seed_data                 # новые serial
python -m app.db.import_seed_data --replace       # TRUNCATE; в prod ещё --confirm-prod-replace
python -m app.db.sync_check_buckets
```

Пароли seed: `SOKOL_ADMIN_PASSWORD` (default `admin`) для admin и department_head, `SOKOL_DEFAULT_USER_PASSWORD` (default `auditor`) для аудиторов. Если `users` пуста: `Админ А.А.` / `admin`, `Ковалев С.С.` / `admin` (`department_head`), аудиторы (ФИО) / `auditor`.

Демо Excel / синтетика / presentation / вложения — команды в [DEMO.md](DEMO.md). Прочее: `sync_dictionaries`. Legacy-патчи (только ремонт старых стендов): `python -m app.db.migrations --list|--all|NAME`.

Legacy CLI: `python -m app.db.migrations --list|--bootstrap|--all|NAME` — для ручного ремонта стендов до Alembic. Docker больше не вызывает `--bootstrap` отдельно: это внутри `ensure_schema` при stamp. `--all` без destructive пропускает `recommendation_indicators`. Перед `--replace` и ручным migrate на общем стенде — бэкап.

Новый стенд: Postgres и MinIO → `init_db` и bootstrap → seed → import или demo → `sync_check_buckets` → smoke `/status`, `/checks`, `/analytics/checks`.

## MinIO

Один приватный bucket на проверку: `check-{serial}` (lowercase, 3–63, только `a-z0-9.-`). Рекомендация своего бакета не имеет.

```text
check-{serial}/
  order|program|az|dz|dz_appendix/{uuid}_{filename}
  recommendations/{rec_id}/{slot}/{uuid}_{filename}
```

Create проверки делает `make_bucket`, если MinIO включён (сбой логируется, проверка всё равно коммитится). Upload создаёт bucket перед `put_object`. Смена serial копирует объекты и удаляет старый bucket. Delete проверки удаляет объекты и bucket. Бакеты руками и заливку в обход API не делать: не будет строки `attachments`.

Включено, только если заданы endpoint, access и secret.

| Переменная | Назначение |
|------------|------------|
| `SOKOL_MINIO_ENDPOINT` | `host:port` без схемы. Docker: `minio:9000`, локальный API: `127.0.0.1:9000` |
| `SOKOL_MINIO_ACCESS_KEY` / `SECRET_KEY` | обычно root MinIO |
| `SOKOL_MINIO_SECURE` | `0` HTTP / `1` HTTPS |
| `SOKOL_MAX_UPLOAD_MB` | default 100 |

Том `~/docker-share/minio-data-sokol`. Консоль с хоста — только после `dev-ports` на `127.0.0.1:9001`. Логин: `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` (default `sokol` / `change-me`). Не делать `mc anonymous set public` и не подменять объекты через `mc cp`, если `object_key` должен остаться верным. Боевые снимки пишет сервис `backup`, не ручной `mc mirror`.

```bash
mc alias set sokol http://127.0.0.1:9000 sokol change-me
mc mirror sokol ~/backup/sokol-minio
```

MIME: PDF, Office, jpeg/png/gif/webp, text/plain, zip, `octet-stream`. Код: `minio_storage.py`, `attachments_service.py`, `check_serial_cascade.py`.

| Симптом | Причина |
|---------|---------|
| 503 | не заданы `SOKOL_MINIO_*` |
| 502 | MinIO недоступен или объект стёрт |
| `InvalidBucketName` | не lowercase / не 3–63 / есть `_` |
| файл в консоли, нет в UI | залит в обход API |
| файлы пропали после смены ключа | в логе `Failed to migrate MinIO bucket` |
| локальный API не видит MinIO | endpoint должен быть `127.0.0.1:9000`, не hostname `minio` |

## Бэкап

Сервис `backup` в Compose (образ `docker/backup/Dockerfile`) сам снимает Postgres и MinIO в **00:05 Europe/Moscow (UTC+3)**. Снимки: `~/docker-share/sokol-backups/<UTC-штамп>/` — `postgres.dump`, каталог `minio/`, `MANIFEST.txt`. Хранит 14 дней и не меньше трёх снимков. Успех пишет `LAST_OK`; healthcheck красный, если снимка нет 48 часов.

```bash
docker compose exec backup /opt/sokol-backup/backup.sh
```

Restore **затирает** живую БД и бакеты. Сначала остановить API:

```bash
docker compose stop api ui
docker compose run --rm -e SOKOL_RESTORE_CONFIRM=I_UNDERSTAND backup /opt/sokol-backup/restore.sh 2026-09-30T021500Z
docker compose start api ui
```

После restore из контейнера API: `python -m app.db.sync_check_buckets`. Dump без файлов не бывает: MinIO входит в тот же снимок. Том `sokol-backups` лежит рядом с данными — скопируйте его ещё на другую машину или диск.

Без Docker sidecar, вручную (нужен `docker-compose.dev-ports.yml` или свой Postgres/MinIO на loopback):

```bash
pg_dump -h 127.0.0.1 -p 5433 -U postgres -d sokol_db -F c -f sokol_db.dump
pg_restore -h 127.0.0.1 -p 5433 -U postgres -d sokol_db --clean --if-exists sokol_db.dump
mc alias set sokol http://127.0.0.1:9000 sokol change-me
mc mirror sokol ~/backup/sokol-minio
```
