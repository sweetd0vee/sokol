# MinIO и вложения

Метаданные — PostgreSQL (`attachments`), файлы — MinIO (S3). UI ходит **только через API**.

Как поднимать MinIO, консоль, `mc`, бэкап: [docs/MINIO.md](../../docs/MINIO.md). Схема таблицы: [DATA_AND_DB.md](DATA_AND_DB.md).

## Layout

Один bucket на проверку: `check-{serial_number}` (lowercase, 3–63 символа). При смене ключа проверки **или** `auditors.code` backend копирует объекты в новый bucket и удаляет старый (`check_serial_cascade`). При удалении проверки — объекты и bucket удаляются.

```
check-{serial}/
  order/ program/ az/ dz/ dz_appendix/{uuid}_{filename}
  recommendations/{rec_id}/{slot}/{uuid}_{filename}
```

Слоты рекомендаций: `recommendation_files`, `control_removal_files`.

Bucket создаётся при `create_check`, если MinIO включён (сбой ensure логируется, проверка всё равно коммитится). Пустые проверки также получают bucket через `sync_check_buckets` или при первом upload.

## API

| Метод | Путь |
|-------|------|
| GET | `/api/v1/attachments/storage/status` → `{ enabled, reachable, bucket_layout }` |
| GET | `/api/v1/attachments?entity_type=&entity_id=` (`slot` опционален) |
| POST | `/api/v1/attachments` multipart: `entity_type`, `entity_id`, `slot`, `file` |
| GET | `/api/v1/attachments/{id}/download` |
| DELETE | `/api/v1/attachments/{id}` |

Права: recommendation upload/delete — владелец или admin; check upload — любой authenticated; check delete — admin only. List/download — любой authenticated.

Frontend опрашивает `GET /storage/status` при открытии секции вложений (`useStorageStatus`). `enabled=false` или `reachable=false` → banner, upload disabled, retry. Tools (DOCX) от MinIO не зависят.

Хранилище выключено (нет endpoint+keys) → **503**. Сбой MinIO → **502**. Слишком большой файл → **413**. Неподдерживаемый MIME → **415**. Пустое тело / слот → **400**. Нет прав → **403**.

Допустимые MIME: PDF, Office (doc/docx/xls/xlsx/ppt/pptx), jpeg/png/gif/webp, text/plain, `application/zip`, `application/x-zip-compressed`, `application/octet-stream`.

## Env

| Переменная | Описание |
|------------|----------|
| `SOKOL_MINIO_ENDPOINT` | host:port |
| `SOKOL_MINIO_ACCESS_KEY` / `SECRET_KEY` | credentials |
| `SOKOL_MINIO_SECURE` | `0` HTTP / `1` HTTPS |
| `SOKOL_MINIO_REGION` | опционально |
| `SOKOL_MAX_UPLOAD_MB` | лимит (default 100) |

Включено, только если заданы endpoint + access key + secret key. `SOKOL_DATA_DIR` относится к Excel/templates, не к MinIO.

Docker: MinIO 9000/9001, том `~/docker-share/minio-data-sokol`.

## Код

`app/services/storage/minio_storage.py` · `app/services/attachments_service.py` · `app/services/check_serial_cascade.py` · `app/crud/attachments_crud.py` · `app/api/v1/endpoints/attachments.py`

`python -m app.db.sync_check_buckets` — для существующих проверок. Демо-файлы во все слоты: `python -m app.db.seed_demo_attachments`.
