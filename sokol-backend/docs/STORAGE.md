# MinIO и вложения

Метаданные — PostgreSQL (`attachments`), файлы — MinIO (S3). UI ходит **только через API**.

Как поднимать MinIO, консоль, `mc`, бэкап: [docs/MINIO.md](../../docs/MINIO.md). Схема таблицы: [DATA_AND_DB.md](DATA_AND_DB.md).

## Layout

Один bucket на проверку: `check-{serial_number}` (lowercase, 3–63 символа). При смене ключа проверки backend копирует объекты в новый bucket и удаляет старый.

```
check-{serial}/
  order/ program/ az/ dz/ dz_appendix/{uuid}_{filename}
  recommendations/{rec_id}/{slot}/{uuid}_{filename}
```

Слоты рекомендаций: `recommendation_files`, `control_removal_files`.

## API

| Метод | Путь |
|-------|------|
| GET | `/api/v1/attachments/storage/status` → `{ enabled, reachable, bucket_layout }` |
| GET | `/api/v1/attachments?entity_type=&entity_id=` (`slot` опционален) |
| POST | `/api/v1/attachments` multipart: `entity_type`, `entity_id`, `slot`, `file` |
| GET | `/api/v1/attachments/{id}/download` |
| DELETE | `/api/v1/attachments/{id}` |

Права: recommendation — владелец или admin; check upload — любой authenticated; check delete — admin only.

Хранилище выключено (нет endpoint+keys) → **503**. Сбой MinIO → **502**. Слишком большой файл → **413**. Неподдерживаемый MIME → **415**. Пустое тело / слот → **400**. Нет прав → **403**.

Допустимые MIME: PDF, Office (doc/docx/xls/xlsx/ppt/pptx), jpeg/png/gif/webp, text/plain, zip, `application/octet-stream`.

## Env

| Переменная | Описание |
|------------|----------|
| `SOKOL_MINIO_ENDPOINT` | host:port |
| `SOKOL_MINIO_ACCESS_KEY` / `SECRET_KEY` | credentials |
| `SOKOL_MINIO_SECURE` | `0` HTTP / `1` HTTPS |
| `SOKOL_MINIO_REGION` | опционально |
| `SOKOL_MAX_UPLOAD_MB` | лимит (default 100) |

Включено, только если заданы endpoint + access key + secret key.

Docker: MinIO 9000/9001, том `~/docker-share/minio-data-sokol`.

## Код

`app/services/storage/minio_storage.py` · `app/services/attachments_service.py` · `app/crud/attachments_crud.py` · `app/api/v1/endpoints/attachments.py`

Bucket создаётся при создании проверки; `python -m app.db.sync_check_buckets` — для существующих. Демо-файлы во все слоты: `python -m app.db.seed_demo_attachments`.
