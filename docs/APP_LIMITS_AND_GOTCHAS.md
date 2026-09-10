# Лимиты и тонкости SOKOL

Для разработчиков, сопровождения и пользователей пилота. Ограничения, которые легко принять за баги.

## Коротко

| Область | Сейчас | Важно |
|---------|--------|-------|
| Списки checks/recommendations | До **10000** за запрос | Полный набор для пилота. Дальше — server pagination. |
| Users / справочники | До **200** | Компактные словари; есть `search`. |
| Upload | `SOKOL_MAX_UPLOAD_MB`, default **100 МБ** | Общий лимит tools и вложений; UI берёт `/api/v1/capabilities`. |
| DOCX tools | Frontend ждёт **10 минут** | Upload стримится на диск. Одновременно крутятся `SOKOL_DOCX_MAX_CONCURRENT` (default 2) документов, остальные ждут очередь. Нестандартная вёрстка АЗ может разобраться неполно. |
| JWT | default **480 мин** | 401 вне login → logout. |
| Analytics cache | React Query **60 с** | После правок дашборд может отстать. |
| Capabilities cache | **5 мин** | Смена лимита upload видна после refetch. |
| Storage status | **15 с**, refetch on focus | Banner MinIO до upload. |
| Bundle | Vite warning о размере | Analytics/export/constructor; lazy routes в backlog. |

## Списки

`SokolDataContext` при входе:

- `GET /api/v1/checks?limit=10000`
- `GET /api/v1/recommendations?limit=10000`

Backend `limit` max 10000. Фильтры, сортировка, пагинация таблицы (по 50) и экспорт таблиц — по загруженному набору. Пагинация показывает «Показано X–Y из Z» для **загруженного** набора; отдельного предупреждения, что в БД больше 10000 строк, нет.

Если данных станет больше 10000: server-side pagination/search; export «страница / все через backend»; формы — lookup по id/serial, не весь список.

## API limits

| Endpoint | Default | Max |
|----------|---------|-----|
| `GET /checks`, `GET /recommendations` | 200 | 10000 |
| `GET /users`, dictionary list | 50 | 200 |
| `POST /recommendations/batch` и `batch-delete` | — | 200 items |
| Attachments list | по entity | нет общего list |

## Файлы и MinIO

```bash
SOKOL_MAX_UPLOAD_MB=100
GET /api/v1/capabilities   → max_upload_mb, max_upload_bytes, docx_max_concurrent, docx_max_queue, docx_queue_wait_seconds
GET /api/v1/attachments/storage/status  → enabled, reachable
```

Если capabilities ещё не пришли, frontend fallback **100 МБ**.

**Tools** (только `.docx`): section-ii, section-ii-links, memorandum, parse-recommendations. Control-file: вход DOCX, выход XLSX. Результат не пишется в MinIO. Обработка идёт через in-process очередь (`SOKOL_DOCX_MAX_CONCURRENT` default 2, `SOKOL_DOCX_MAX_QUEUE` default 8); переполнение → **503** + `Retry-After`. Vite proxy timeout рассчитан на длинные запросы. Если таблицы Раздела II нет, ДЗ / parse / файл контроля читают наблюдения раздела III.

**Вложения:** metadata в PostgreSQL, байты в MinIO. Не настроено (`SOKOL_MINIO_*` пустые) → **503**. Сбой операции → **502**. Смена serial копирует bucket. Frontend опрашивает `/attachments/storage/status` при открытии секции вложений: `enabled=false` / `reachable=false` → banner + disabled upload + retry. Tools (DOCX) от MinIO не зависят.

## Auth

1. `POST /api/v1/auth/login` — логин матчит `username` и `aliases`.
2. Token в `localStorage` (`sokol_auth`).
3. Axios: `Authorization: Bearer …`.
4. 401 вне login → очистка storage и `/login`.

Пользователи живут в таблице `users` (seed/sync), не в `SOKOL_AUTH_USERS` (переменной нет).

| Настройка | Default |
|-----------|---------|
| `SOKOL_JWT_EXPIRE_MINUTES` | 480 |
| `SOKOL_JWT_SECRET` | dev default; в prod слабый секрет не стартует |
| HTTP Basic | on в development, **off** в prod |

OIDC нет. Смена пароля — `POST /auth/change-password`. Аватары только на фронте.

## Порты

| | Dev | Docker |
|--|-----|--------|
| UI | 5180 | 5180 |
| API | 8802 | 8800 |
| Postgres | 5433 | 5433 |
| MinIO | 9000 / 9001 | то же |

`VITE_DEV_API_PORT` — только Vite proxy. `VITE_API_URL` вшивается на build. Пустой `SOKOL_CORS_ORIGINS` → `*` без credentials.

## Analytics, planning, constructor

Агрегаты с backend, `staleTime` ~60 с. Visual export (html/pdf/docx/xlsx) — DOM capture. **Планирование экспортируется.** Конструктор — `/constructor`, снимки в localStorage, без backend API. Подробно: [ANALYTICS.md](ANALYTICS.md).

Виды проверок в Settings, формах и фильтрах списков — из API (`/settings/check_kinds`).

## Справочники и ключ проверки

API create/update валидирует labels; физические FK с `ON UPDATE CASCADE`. Import Excel **досоздаёт** неизвестные labels (`ensure_*`), в отличие от UI.

`serial_number` только backend. Смена даты / квартала / руководителя / типа пересчитывает ключ, rec serial, attachments и MinIO bucket. Смена `auditors.code` также каскадно переписывает ключи проверок этого руководителя и MinIO buckets. Квартал (`check_quarter` 1–4) участвует в ключе.

## Импорт из АЗ

`parse-recommendations` + `batch`. Если таблицы Раздела II нет, парсер берёт наблюдения раздела III. Нестандартный DOCX может разобраться неполно. Объекты аудита канонизируются по `departments`. Batch атомарный; результат всё равно смотреть глазами.

## Похожие ошибки

| Симптом | Что проверить |
|---------|---------------|
| Не связаться с API | 8802 (dev) / 8800 (Docker) `/docs` |
| 401 | JWT истёк — перелогиниться |
| 413 | размер vs `/capabilities` |
| 503 вложения | MinIO не настроен |
| 502 вложения | MinIO не запущен / битый object |
| DOCX висит | размер, очередь на сервере, вёрстка АЗ, логи backend |
| 503 tools | очередь документов переполнена — повторить через несколько секунд |
| CORS | `SOKOL_CORS_ORIGINS`, restart API |
| Нет новой строки в таблице | React Query / refetch |
| Vite chunk warning | ожидаемо, не runtime |

## Smoke перед показом

Login → списки → create/edit check и recommendation → вложение (если MinIO) → DOCX на эталонном АЗ → analytics / planning / constructor → table export.

```bash
cd sokol-frontend && npm run lint && npm test && npm run build
cd sokol-backend && py -3.12 -m compileall app tests
cd sokol-backend && py -3.12 -m unittest discover -s tests -p "test_*.py" -v
```
