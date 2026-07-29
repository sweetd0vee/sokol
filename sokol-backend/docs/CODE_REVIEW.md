# Code Review — sokol-backend

**Дата:** 2026-07-28  
**Метод:** статический разбор актуального кода + `unittest` (**60 OK**).  
**Область:** FastAPI, CRUD, ORM, DOCX tools, Docker/env, стык с фронтом.

## Итоговая оценка

| Критерий | Балл |
|----------|------|
| Архитектура слоёв | 7/10 |
| Поддерживаемость CRUD | 7/10 |
| DOCX pipeline | 6.5/10 (сложность высока, тесты помогают) |
| Тесты | 6/10 DOCX · 2/10 API/DB |
| Безопасность | 3/10 |
| Production readiness | 4/10 |
| Согласованность с фронтом | 5/10 |

**Вердикт:** сильный DOCX-контур и аккуратный CRUD-скелет; для промышленной эксплуатации не хватает auth, миграций, CI и закрытия разрывов с UI (analytics).

---

## Сильные стороны

1. **Чистое разделение** endpoints / schemas / crud / models / reports.
2. **Async SQLAlchemy + asyncpg** с dependency injection session.
3. **DOCX Раздела II** — осознанный ZIP/XML подход с валидациями границ и тестами bookmarks/links.
4. **Два режима Section II** (`section-ii` / `section-ii-links`) явно разделены.
5. **Temp cleanup** через BackgroundTasks; лимит upload; MIME/расширение проверяются.
6. Seed/import Excel для демо-данных.

---

## Замечания (по приоритету)

### Critical / High

#### H1. Нет авторизации и RBAC

Все `/api/v1/*` доступны без токена. Для аудиторских данных это недопустимо во внешнем/shared network.

**Риск:** чтение/удаление проверок, генерация документов, порча справочников.  
**Рекомендация:** JWT/OIDC (Keycloak уже намечен на фронте), middleware + роли минимум `auditor` / `admin`.

#### H2. Нет Alembic — схема через `create_all` + ручные `migrate_*.py`

**Риск:** расхождение prod/dev, опасные ALTER TYPE для enum статусов, невозможность отката.  
**Рекомендация:** ввести Alembic, перенести ad-hoc скрипты в ревизии, запретить «тихое» create_all в prod.

#### H3. Frontend вызывает `/api/v1/analytics/by-person` — endpoint отсутствует

`AnalyticsTab` всегда получает ошибку API.

**Рекомендация:** реализовать агрегирующий endpoint **или** временно считать аналитику на клиенте из уже загруженных checks/recommendations и убрать мёртвый API-контракт.

#### H4. Upload целиком в память

`_read_upload` → `await file.read()` до лимита 100 MB на каждый tools-запрос.

**Риск:** OOM при параллельных upload, DoS.  
**Рекомендация:** streaming на диск, меньший default лимит, семафор на concurrent DOCX jobs.

### Medium

#### M1. Конфиг размазан

`Settings` знает только `database_url` / prefix / app_name. CORS и upload — через `os.getenv`.

**Рекомендация:** единый `Settings` с валидацией.

#### M2. Синхронный DOCX на HTTP worker

`asyncio.to_thread` не блокирует loop, но нет очереди, прогресса, таймаута на уровне сервиса (только axios 120s на фронте).

**Рекомендация:** job queue (или хотя бы ограничение concurrency) + статус job.

#### M3. Крупные модули `docx_generator.py` / `docx_parser.py`

Сотни строк оркестрации и эвристик в одном файле — высокий cognitive load и риск регрессий вне покрытых сценариев.

**Рекомендация:** дробить на фазы (strip / parse / locate / build / rewrite) с явными интерфейсами и фикстурами «золотых» АЗ.

#### M4. Compose-сервисы без кода

MinIO, MailHog, LanguageTool в инфраструктуре, но приложение их не вызывает — путаница для новых разработчиков.

**Рекомендация:** убрать из default compose или пометить `profiles: [experimental]` и дописать интеграцию.

#### M5. Нет integration/API tests

CRUD, cascade delete, enum round-trip, tools multipart — только ручная проверка / Swagger.

#### M6. Два порта API (Docker vs local)

`run_dev.ps1` → **8802**, Docker → **8800**. Документация (корневой README, DOCKER.md, `*/docs`) это фиксирует; риск — запутать новичка, если не читать таблицу портов. Опционально унифицировать в коде (см. ROADMAP фаза 0).

### Low

#### L1. Нет structured logging / correlation id

Сложно диагностировать падения DOCX в проде.

#### L2. `ParsedRecommendationItem` объявлен в endpoint-файле

Лучше перенести в `schemas/`.

#### L3. Справочники не связаны FK с доменными полями

Дублирование строк ФИО/типов — риск опечаток; приемлемо на текущем этапе, но стоит планировать нормализацию или validation against справочника.

#### L4. Exception handlers отсутствуют

Сырые 500 без единого формата `detail` для не-HTTPException.

---

## Замечания по конкретным областям

### CRUD

- Паттерн единообразен и читаем.
- Фильтры list на сервере есть, но фронт тянет большие страницы и фильтрует клиентски — нагрузка на БД при росте данных вырастет.
- Cascade delete checks → recommendations корректен на уровне ORM.

### Reports

- Разделение section_ii (XML) vs memorandum (python-docx) обосновано.
- `memorandum_doc_parser` слабо задействован tools API — мёртвый/запасной код; либо подключить endpoint, либо пометить internal.
- Эвристики заголовков требуют каталога эталонных АЗ в CI.

### Безопасность DOCX

- Проверка расширения/MIME поверхностна (MIME легко подделать).
- Нет антивируса/sandbox; ZIP bombs теоретически возможны до лимита размера.
- XML from untrusted Office docs — классический риск XXE; ElementTree обычно не резолвит внешние entity по умолчанию, но стоит явно зафиксировать политику и тесты.

---

## Приоритетный план фиксов

1. Auth (хотя бы API key / JWT для внутренней сети).
2. Alembic + зафиксировать enum’ы статусов рекомендаций.
3. Analytics endpoint **или** отключить вкладку / client-side fallback.
4. (Опционально) Унифицировать порты 8800/8802 в коде; docs уже описывают оба режима.
5. Streaming upload + concurrency limit для `/tools`.
6. API tests (TestClient + тестовая БД).
7. CI: compileall + unittest + (позже) lint.

---

## Что не считать багом

- Отсутствие Celery — осознанный текущий scope.
- Хранение вложений только на клиенте — нет backend API для файлов.
- Stub auth на фронте — симптом общего H1, не изолированный баг UI.
