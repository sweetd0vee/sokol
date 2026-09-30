# Демо-данные

Всё ниже — для локальной разработки и презентаций. Перед продом demo выключают и переходят на реальный Excel/import. В `SOKOL_ENV=prod` загрузка demo и `SOKOL_SEED_REPLACE` запрещены.

Команды из каталога `sokol-backend/` при заданном `DATABASE_URL`.

## Что есть

| Путь | Что делает | Docker |
|------|------------|--------|
| Excel `data/checks.xlsx` + `recommendations.xlsx` | Импорт через `import_seed_data` | Только при явном `SOKOL_LOAD_DEMO_DATA=1` |
| `python -m app.db.seed_demo_data` | Синтетические проверки/рекомендации без Excel | Нет |
| `python -m app.db.bootstrap_presentation_demo` | Генерит presentation Excel и заливает с TRUNCATE | Нет |
| `python -m app.db.seed_demo_attachments` | Демо-файлы во все слоты одной проверки | Нет |

Compose по умолчанию: `SOKOL_LOAD_DEMO_DATA=0`. Пустой стенд сам demo не подгружает.

## Синтетика (`seed_demo_data`)

Throwaway-модуль. Не вызывается из Docker. Перед продом можно удалить `app/db/seed_demo_data.py` (и связанные `demo_data.py` / тесты, если больше не нужны).

```bash
# вставить ~100 проверок (id выдаёт Postgres; wipe нет)
python -m app.db.seed_demo_data

# то же с явным объёмом
python -m app.db.seed_demo_data --count 100

# сначала TRUNCATE checks/recommendations/attachments, потом вставка
python -m app.db.seed_demo_data --replace --count 100
```

`--replace` в prod без подтверждения не пройдёт (тот же guard, что у seed replace).

## Excel в Docker

```bash
# в .env или окружении compose
SOKOL_LOAD_DEMO_DATA=1
# опционально перезалить поверх существующих checks:
# SOKOL_SEED_REPLACE=1
```

Без флага entrypoint пишет `SOKOL_LOAD_DEMO_DATA disabled — skip demo import.` и оставляет только справочники/users.

Локальный импорт тех же файлов без Docker:

```bash
python -m app.db.import_seed_data
python -m app.db.import_seed_data --replace
# в prod: ещё --confirm-prod-replace
```

Файлы: корневой `data/` или `SOKOL_DATA_DIR`.

## Presentation demo

Генерирует `checks.xlsx` / `recommendations.xlsx` в data-dir и импортирует с replace:

```bash
python -m app.db.bootstrap_presentation_demo
```

## Демо-вложения (MinIO)

Нужен настроенный MinIO и уже существующая проверка с рекомендациями:

```bash
python -m app.db.seed_demo_attachments
python -m app.db.seed_demo_attachments --check-id 1 --replace
```

## Перед продом

1. `SOKOL_LOAD_DEMO_DATA=0`, `SOKOL_SEED_REPLACE` выключен.
2. `SOKOL_ENV=prod`, свои пароли seed и JWT.
3. Залить реальные данные через `import_seed_data` (или UI), не через `seed_demo_data`.
4. При желании удалить синтетический seeder из репозитория.

Схема БД, MinIO и бэкапы — [DATA.md](DATA.md). Docker — [DOCKER.md](../DOCKER.md).
