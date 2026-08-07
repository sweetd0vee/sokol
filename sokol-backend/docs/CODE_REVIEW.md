# Code Review — sokol-backend

**Дата:** 2026-08-07 (актуализация; исходный разбор 2026-07-28)  
**Метод:** статический разбор актуального кода + `unittest` (**61** test, 1 skipped) + ревью справочников/`dictionary_crud`.  
**Область:** FastAPI, CRUD, ORM, DOCX tools, Docker/env, стык с фронтом.

## Итоговая оценка

| Критерий | Балл |
|----------|------|
| Архитектура слоёв | 7.5/10 |
| Поддерживаемость CRUD | 8/10 (+ shared dictionary helpers) |
| DOCX pipeline | 6.5/10 (сложность высока, тесты помогают) |
| Тесты | 6/10 DOCX · 2/10 API/DB |
| Безопасность | 3/10 |
| Production readiness | 4/10 |
| Согласованность с фронтом | 7.5/10 |

**Вердикт:** сильный DOCX-контур и аккуратный CRUD-скелет; справочники унифицированы через `dictionary_crud`. Для промышленной эксплуатации не хватает auth, Alembic, CI и object storage. План внедрения — [PLAN.md](../../PLAN.md) (playbooks A–D).

---

## Сильные стороны

1. **Чистое разделение** endpoints / schemas / crud / models / reports.
2. **Async SQLAlchemy + asyncpg** с dependency injection session.
3. **DOCX Раздела II** — осознанный ZIP/XML подход с валидациями границ и тестами bookmarks/links.
4. **Два режима Section II** (`section-ii` / `section-ii-links`) явно разделены.
5. **Temp cleanup** через BackgroundTasks; лимит upload; MIME/расширение проверяются.
6. Seed/import Excel для демо-данных; seed видов проверок (`check_kinds`).
7. **DRY справочников:** `app/crud/dictionary_crud.py` — общие create/get/list/count/update/delete + ilike search; тонкие обёртки на ресурс сохраняют стабильные API-префиксы.

---

## Замечания (по приоритету)

### Critical / High

#### H1. Нет авторизации и RBAC

Все `/api/v1/*` доступны без токена. Для аудиторских данных это недопустимо во внешнем/shared network.

**Риск:** чтение/удаление проверок, генерация документов, порча справочников.  
**Рекомендация:** JWT/OIDC (Keycloak), middleware + роли минимум `auditor` / `admin`. См. PLAN фаза 2 и playbook C.

#### H2. Нет Alembic — схема через `create_all` + ручные `migrate_*.py`

**Риск:** расхождение prod/dev, опасные ALTER TYPE для enum статусов, невозможность отката.  
**Рекомендация:** Alembic baseline + перенос ad-hoc скриптов; prod только `alembic upgrade head`. См. PLAN playbook B.

#### H3. ~~Frontend вызывает `/api/v1/analytics/by-person`~~ — снято (август 2026)

Фронт считает аналитику на клиенте; backend analytics API не требуется для текущей UI.

#### H4. Upload целиком в память

`_read_upload` → `await file.read()` до лимита 100 MB на каждый tools-запрос.

**Риск:** OOM при параллельных upload, DoS.  
**Рекомендация:** streaming на диск, семафор на concurrent DOCX jobs (фаза 3).

#### H5. Нет персистентного файлового хранилища для вложений

MinIO в compose (`profiles: ["extras"]`) не интегрирован; доменные вложения существуют только на клиенте.

**Рекомендация:** PLAN playbook A (attachments API + metadata table + bucket layout).

### Medium

#### M1. Конфиг размазан

`Settings` знает только `database_url` / prefix / app_name. CORS и upload — через `os.getenv`.

**Рекомендация:** единый `Settings` с валидацией (фаза 0.4).

#### M2. Синхронный DOCX на HTTP worker

`asyncio.to_thread` не блокирует loop, но нет очереди, прогресса, таймаута на уровне сервиса (только axios 120s на фронте).

#### M3. Крупные модули `docx_generator.py` / `docx_parser.py`

Дробить на фазы (strip / parse / locate / build / rewrite) + golden АЗ в CI.

#### M4. Compose-сервисы без кода

MinIO/MailHog в extras — ок как заготовка; до интеграции держать вне default up и не включать в bank UAT без playbook A.

#### M5. Нет integration/API tests

CRUD, cascade delete, enum round-trip, tools multipart, settings dictionaries — только ручная проверка / Swagger.

#### M6. Два порта API (Docker vs local)

`run_dev.ps1` → **8802**, Docker → **8800**. Документировано; опционально унифицировать.

#### M7. Справочник `check_kinds` не связан с доменом

Таблица и API есть; поля проверки (`check_view` / аналоги) всё ещё свободные строки / FE-константы. Нужен продуктовый wire + data cleanup перед FK.

### Low

#### L1. Нет structured logging / correlation id

#### L2. `ParsedRecommendationItem` объявлен в endpoint-файле

Лучше перенести в `schemas/`.

#### L3. Справочники не связаны FK с доменными полями

Приемлемо на текущем этапе; планировать validation/FK (фаза 4.3).

#### L4. Exception handlers отсутствуют

Сырые 500 без единого формата `detail` для не-HTTPException.

#### L5. Endpoint-слой справочников всё ещё копипастится

После DRY в CRUD можно (опционально) вынести factory роутов; **не** схлопывать в один URL `/settings/{kind}`.

---

## Замечания по конкретным областям

### CRUD / settings

- Паттерн единообразен; label-справочники (`check_kinds`, `effectiveness_ratings`, `auditors`) и `audit_types` используют `dictionary_crud`.
- Фильтры list на сервере есть, но фронт тянет большие страницы и фильтрует клиентски.
- Cascade delete checks → recommendations корректен на уровне ORM.

### Reports

- Разделение section_ii (XML) vs memorandum (python-docx) обосновано.
- Эвристики заголовков требуют каталога эталонных АЗ в CI.

### Безопасность DOCX

- Проверка расширения/MIME поверхностна.
- Нет антивируса/sandbox; ZIP bombs теоретически возможны до лимита размера.
- Политика XXE/ElementTree — зафиксировать тестами при hardening.

---

## Приоритетный план

Сводный план фаз, playbooks MinIO / миграции / bank deploy / реальные данные — в **[PLAN.md](../../PLAN.md)**. Backend backlog — [ROADMAP.md](ROADMAP.md).

---

## Что не считать багом

- Отсутствие Celery — осознанный текущий scope.
- Хранение вложений только на клиенте — нет backend API для файлов (задокументированный gap).
- Stub auth на фронте — симптом H1.
- Отсутствие analytics API — осознанно.
