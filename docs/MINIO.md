# MinIO — гайд

MinIO — S3-совместимое хранилище файлов. В SOKOL в нём лежат вложения проверок и рекомендаций. Метаданные файлов (имя, слот, размер) живут в PostgreSQL (`attachments`), сами байты — в MinIO.

UI и бизнес-логика **не ходят в MinIO напрямую**: только backend API. Этот документ — как поднять MinIO, как правильно создавать бакеты, как смотреть файлы и как не сломать раскладку SOKOL.

Краткий контракт приложения: [sokol-backend/docs/STORAGE.md](../sokol-backend/docs/STORAGE.md).

## Порты и доступ

| Что | URL / путь |
|-----|------------|
| S3 API | http://localhost:9000 |
| Консоль (браузер) | http://localhost:9001 |
| Данные на диске (Windows) | `%USERPROFILE%\docker-share\minio-data-sokol` |
| Из контейнера API | `minio:9000` |

Логин консоли — `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` (в `.env`, по умолчанию `sokol` / `change-me`). Те же значения обычно стоят в `SOKOL_MINIO_ACCESS_KEY` / `SOKOL_MINIO_SECRET_KEY`: backend ходит в MinIO как root-пользователь инстанса.

В production смените пароль. Длина пароля MinIO — не короче 8 символов.

## Запуск

Из корня репозитория:

```powershell
docker compose up -d minio
```

Проверка, что сервис жив:

```powershell
curl http://localhost:9000/minio/health/live
```

Консоль: http://localhost:9001

## Правила имён бакетов

Имя бакета — это DNS-имя в S3. MinIO отклонит `make_bucket`, если правила нарушены.

| Правило | Можно | Нельзя |
|---------|--------|--------|
| Длина | 3–63 символа | `ab`, слишком длинное имя |
| Регистр | только lowercase | `Check-26IVP` |
| Символы | `a-z`, `0-9`, `.`, `-` | `_`, пробел, кириллица, `/` |
| Начало и конец | буква или цифра | `-files`, `files.` |
| Подряд | один `-` или `.` | `check--a`, `check..a` |
| Формат | не IP-адрес | `192.168.1.1` |

Примеры:

```text
ok:   check-26ivp01p1
ok:   reports-2026
bad:  Check_26IVP        # заглавные и подчёркивание
bad:  вложения           # кириллица
bad:  check-             # заканчивается на дефис
```

Внутри бакета путь объекта (`object key`) свободнее: слэши, UUID, исходное имя файла. Ограничение 3–63 касается **только имени бакета**, не ключа объекта.

## Как бакеты устроены в SOKOL

SOKOL использует **один бакет на проверку**:

```text
check-{serial_number}
```

`serial_number` приводится к lowercase, недопустимые символы заменяются на `-`, имя обрезается до 63 символов. Код: `check_bucket_name()` в `sokol-backend/app/services/storage/minio_storage.py`.

Пример: проверка `26IVP01P1` → бакет `check-26ivp01p1`.

Внутри бакета:

```text
check-{serial}/
  order/{uuid}_{filename}
  program/{uuid}_{filename}
  az/{uuid}_{filename}
  dz/{uuid}_{filename}
  dz_appendix/{uuid}_{filename}
  recommendations/{rec_id}/recommendation_files/{uuid}_{filename}
  recommendations/{rec_id}/control_removal_files/{uuid}_{filename}
```

Слоты проверки: `order`, `program`, `az`, `dz`, `dz_appendix`.  
Слоты рекомендации: `recommendation_files`, `control_removal_files`.

Рекомендация **не имеет своего бакета**. Файлы рекомендации лежат в бакете связанной проверки.

### Кто создаёт бакеты

| Событие | Что происходит |
|---------|----------------|
| Создание проверки | backend сам делает `make_bucket`, если бакета ещё нет |
| Загрузка вложения | если бакета нет — создаётся перед `put_object` |
| Смена serial проверки | объекты копируются в новый бакет, старый удаляется |
| Удаление проверки | объекты и бакет удаляются |
| Старт API в Docker | `python -m app.db.sync_check_buckets` создаёт недостающие бакеты по всем `checks` |
| Ручной импорт данных | после импорта: `python -m app.db.sync_check_buckets` |

**Не создавайте бакеты `check-*` руками** в консоли, если можете обойтись приложением. Иначе легко получить бакет без строки в `attachments` или наоборот — метаданные без файла.

Руками имеет смысл создавать только служебные бакеты вне схемы SOKOL (черновики, ручной бэкап, эксперименты). Не называйте их `check-...`, чтобы не пересечься с проверками.

## Консоль MinIO

1. Откройте http://localhost:9001
2. Войдите root-пользователем.
3. **Buckets** — список бакетов. Для SOKOL это набор `check-*`.
4. Клик по бакету — объекты внутри. Папки (`order/`, `recommendations/`) — это префиксы ключей, не отдельные бакеты.
5. **Create Bucket** — ручное создание. Имя сразу в lowercase, без подчёркиваний.
6. Object Browser позволяет скачать или залить файл. Файл, залитый только через консоль, **не появится** в UI SOKOL: в PostgreSQL не будет строки `attachments`.

Консоль — для диагностики и бэкапов. Боевые вложения грузите через UI/API.

## MinIO Client (`mc`)

CLI удобнее консоли для скриптов и бэкапа.

Установка (Windows, через winget или с [min.io/docs](https://min.io/docs/minio/linux/reference/minio-mc.html)):

```powershell
winget install MinIO.Client
```

Алиас на локальный инстанс (пароль тот же, что `MINIO_ROOT_PASSWORD`):

```powershell
mc alias set sokol http://127.0.0.1:9000 sokol change-me
mc admin info sokol
```

### Бакеты

```powershell
# список
mc ls sokol

# создать (только если это не бакет проверки SOKOL)
mc mb sokol/scratch-lab

# есть ли бакет
mc ls sokol/check-26ivp01p1

# удалить пустой бакет
mc rb sokol/scratch-lab

# удалить бакет вместе с объектами — опасно
mc rb --force sokol/scratch-lab
```

`mc mb` соблюдает те же S3-правила имени. Если команда падает с `InvalidBucketName` — проверьте таблицу правил выше.

### Файлы

```powershell
# содержимое бакета проверки
mc ls --recursive sokol/check-26ivp01p1

# скачать объект
mc cp sokol/check-26ivp01p1/order/abc123_prikaz.docx .\prikaz.docx

# залить в служебный бакет (не в check-*, если нет строки в БД)
mc cp .\notes.txt sokol/scratch-lab/notes.txt

# зеркало бакета на диск
mc mirror sokol/check-26ivp01p1 D:\backup\minio\check-26ivp01p1
```

Не подменяйте объекты в `check-*` через `mc cp`, если метаданные в PostgreSQL должны остаться валидными: `object_key` в таблице `attachments` должен совпадать с ключом в MinIO.

## Политики и доступ

По умолчанию бакеты приватные: без access key файлы не отдаются. Так и должно быть.

Не делайте бакеты публичными (`mc anonymous set public ...`) — вложения аудиторских документов не должны быть доступны по прямой ссылке.

Для SOKOL достаточно одного пользователя (root / `SOKOL_MINIO_ACCESS_KEY`) с полным доступом. Отдельные IAM-политики на бакет имеет смысл заводить только если MinIO шарят несколько сервисов.

Переменные backend:

| Переменная | Назначение |
|------------|------------|
| `SOKOL_MINIO_ENDPOINT` | `host:port`, без `http://`. В Docker: `minio:9000`, с хоста: `127.0.0.1:9000` |
| `SOKOL_MINIO_ACCESS_KEY` | ключ доступа |
| `SOKOL_MINIO_SECRET_KEY` | секрет, должен совпадать с паролем пользователя MinIO |
| `SOKOL_MINIO_SECURE` | `0` HTTP, `1` HTTPS |
| `SOKOL_MINIO_REGION` | обычно пусто |
| `SOKOL_MAX_UPLOAD_MB` | лимит размера вложения (по умолчанию 100) |

Если endpoint/ключи пустые, MinIO для backend **выключен**: загрузка вложений вернёт 503.

Проверка с API (нужен JWT):

```http
GET /api/v1/attachments/storage/status
```

Ожидается `enabled: true`, `reachable: true`.

## Бэкап и восстановление

Dump PostgreSQL **не содержит файлов**. Бэкапить нужно том MinIO отдельно.

Том Docker: `%USERPROFILE%\docker-share\minio-data-sokol`.

Вариант 1 — зеркало через `mc` (удобно выборочно):

```powershell
mc mirror sokol D:\backup\sokol-minio
```

Вариант 2 — копия тома при остановленном контейнере:

```powershell
docker compose stop minio
# скопировать папку minio-data-sokol
docker compose start minio
```

После restore PostgreSQL:

1. Поднять MinIO с тем же (или залитым) томом.
2. Прогнать `python -m app.db.sync_check_buckets` — создаст пустые бакеты для проверок, у которых файлов ещё нет.
3. Сверить `attachments.bucket` + `attachments.object_key` с реальными объектами (`mc ls --recursive`). Строка в БД без объекта = битое вложение.

## Типичные ошибки

| Симптом | Причина | Что делать |
|---------|---------|------------|
| 503 на upload | `SOKOL_MINIO_*` не заданы | заполнить endpoint и ключи |
| 502 на upload | MinIO не запущен или неверный endpoint | `docker compose ps minio`, health `/minio/health/live` |
| `InvalidBucketName` | имя не по правилам S3 | lowercase, 3–63, без `_` |
| Access Denied в консоли | неверный пароль | `MINIO_ROOT_PASSWORD` из `.env` |
| Файл есть в консоли, нет в UI | залит в обход API | грузить через SOKOL; или завести `attachments` вручную (не рекомендуется) |
| Файл есть в UI, download 502 | объект стёрт в MinIO | восстановить из бэкапа или удалить строку `attachments` |
| После смены serial файлы пропали | миграция бакета не прошла | смотреть логи backend `Failed to migrate MinIO bucket` |
| `sync_check_buckets` пишет skip | MinIO disabled / unreachable | проверить env и что контейнер `minio` Up |

Локальный uvicorn на `8802` ходит в MinIO на хосте: в `sokol-backend` env должен быть `SOKOL_MINIO_ENDPOINT=127.0.0.1:9000`, не `minio:9000` (это имя резолвится только внутри Docker-сети).

## Связанные файлы

| Файл | Зачем |
|------|--------|
| `docker-compose.yml` | сервис `minio` |
| `.env.example` | ключи MinIO |
| `sokol-backend/app/services/storage/minio_storage.py` | бакеты, upload/download/copy/delete |
| `sokol-backend/app/db/sync_check_buckets.py` | досоздать бакеты по проверкам |
| `sokol-backend/docs/STORAGE.md` | API вложений и layout |
| `DOCKER.md` | порты и том на диске |
