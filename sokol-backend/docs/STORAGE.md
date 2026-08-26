# MinIO и вложения

Метаданные — PostgreSQL (`attachments`), файлы — MinIO (S3). UI ходит **только через API**.

Как создавать бакеты, консоль, `mc`, бэкап: [docs/MINIO.md](../../docs/MINIO.md).

## Layout

Один bucket на проверку: `check-{serial_number}` (lowercase).

```
check-{serial}/
  order/ program/ az/ dz/ dz_appendix/
  recommendations/{rec_id}/{slot}/{uuid}_{filename}
```

Слоты рекомендаций: `recommendation_files`, `control_removal_files`.

## API

| Метод | Путь |
|-------|------|
| GET | `/api/v1/attachments/storage/status` |
| GET | `/api/v1/attachments?entity_type=&entity_id=` |
| POST | `/api/v1/attachments` (multipart) |
| GET | `/api/v1/attachments/{id}/download` |
| DELETE | `/api/v1/attachments/{id}` |

Upload: `entity_type` (`check`|`recommendation`), `entity_id`, `slot`, `file`.

## Env

| Переменная | Описание |
|------------|----------|
| `SOKOL_MINIO_ENDPOINT` | host:port |
| `SOKOL_MINIO_ACCESS_KEY` / `SECRET_KEY` | credentials |
| `SOKOL_MINIO_SECURE` | `0` HTTP / `1` HTTPS |
| `SOKOL_MAX_UPLOAD_MB` | лимит размера |

Docker: MinIO на 9000/9001, том `~/docker-share/minio-data-sokol`.

## Код

`app/services/storage/minio_storage.py` · `app/crud/attachments_crud.py` · `app/api/v1/endpoints/attachments.py` · FE: `src/api/attachments.ts`

Bucket создаётся при создании проверки; `sync_check_buckets` — для существующих.
