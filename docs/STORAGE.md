# MinIO и вложения

Метаданные — PostgreSQL (`attachments`), байты — MinIO (S3). UI ходит **только через API**. Схема: [DATA_AND_DB.md](DATA_AND_DB.md).

## Layout

Один bucket на проверку: `check-{serial_number}` (lowercase, 3–63 символа; недопустимые символы → `-`). Рекомендация своего бакета не имеет.

```
check-{serial}/
  order/ program/ az/ dz/ dz_appendix/{uuid}_{filename}
  recommendations/{rec_id}/{slot}/{uuid}_{filename}
```

Слоты rec: `recommendation_files`, `control_removal_files`.

Имя бакета — DNS S3: только `a-z0-9.-`, не `_`, не кириллица, не IP, не начинается/кончается `-`/`.`. Код: `check_bucket_name()`.

| Событие | MinIO |
|---------|-------|
| create check | `make_bucket` если включён (сбой ensure логируется, проверка коммитится) |
| upload | bucket создаётся перед `put_object` |
| смена serial / `auditors.code` | copy в новый bucket, старый удаляется |
| delete проверки | объекты и bucket удаляются |
| Docker start / после import | `python -m app.db.sync_check_buckets` |
| demo | `python -m app.db.seed_demo_attachments` |

**Не создавайте `check-*` руками** и не заливайте файлы в консоли в обход API — не будет строки `attachments`.

## API

| Метод | Путь |
|-------|------|
| GET | `/api/v1/attachments/storage/status` → `{ enabled, reachable, bucket_layout }` |
| GET | `/attachments?entity_type=&entity_id=` (`slot?`) |
| POST | `/attachments` multipart: `entity_type`, `entity_id`, `slot`, `file` |
| GET | `/attachments/{id}/download` |
| DELETE | `/attachments/{id}` |

Права: rec upload/delete — владелец или admin; check upload — любой authenticated; check delete — admin. List/download — любой authenticated.

Frontend: `useStorageStatus` (poll 15 с, refetch on focus). `enabled=false` / `reachable=false` → banner, upload disabled, retry. Tools (DOCX) от MinIO не зависят.

Ошибки: слот/пустое тело → **400**; слишком большой → **413**; MIME → **415**; не настроен → **503**; сбой → **502**; нет прав → **403**.

MIME: PDF, Office (doc/docx/xls/xlsx/ppt/pptx), jpeg/png/gif/webp, text/plain, zip, `octet-stream`.

Код: `minio_storage.py` · `attachments_service.py` · `check_serial_cascade.py` · `attachments_crud.py` · `endpoints/attachments.py`.

## Env

Включено, только если заданы endpoint + access + secret. `SOKOL_DATA_DIR` к MinIO не относится.

| Переменная | Назначение |
|------------|------------|
| `SOKOL_MINIO_ENDPOINT` | `host:port` без схемы. Docker: `minio:9000`, локальный uvicorn: `127.0.0.1:9000` |
| `SOKOL_MINIO_ACCESS_KEY` / `SECRET_KEY` | credentials (обычно = MinIO root) |
| `SOKOL_MINIO_SECURE` | `0` HTTP / `1` HTTPS |
| `SOKOL_MINIO_REGION` | опционально |
| `SOKOL_MAX_UPLOAD_MB` | лимит (default 100) |

Docker: порты 9000 / 9001, том `~/docker-share/minio-data-sokol` (Windows: `%USERPROFILE%\docker-share\minio-data-sokol`). Логин консоли: `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` (default `sokol` / `change-me`, ≥8 символов).

## Эксплуатация

```bash
docker compose up -d minio
curl http://localhost:9000/minio/health/live
```

Консоль: http://localhost:9001 — диагностика. Бакеты приватные: не `mc anonymous set public`.

```bash
mc alias set sokol http://127.0.0.1:9000 sokol change-me
mc ls sokol
mc ls --recursive sokol/check-26ivp01p1
mc mirror sokol ~/backup/sokol-minio
```

Не подменяйте объекты в `check-*` через `mc cp`, если `attachments.object_key` должен остаться валидным.

Dump PostgreSQL **не содержит файлов**. Бэкап: `mc mirror` или копия тома при остановленном контейнере. После restore PG: поднять MinIO → `sync_check_buckets` → сверить `bucket` + `object_key` с `mc ls --recursive`.

## Типичные ошибки

| Симптом | Что делать |
|---------|------------|
| 503 upload | задать `SOKOL_MINIO_*` |
| 502 upload | `docker compose ps minio`, health live |
| `InvalidBucketName` | lowercase, 3–63, без `_` |
| файл в консоли, нет в UI | залит в обход API |
| download 502 | объект стёрт — restore или удалить строку `attachments` |
| после смены serial файлы пропали | логи `Failed to migrate MinIO bucket` |
| `sync_check_buckets` skip | MinIO disabled / unreachable |
| локальный API не видит MinIO | endpoint `127.0.0.1:9000`, не hostname `minio` |
