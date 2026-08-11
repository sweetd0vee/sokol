# Code Review — sokol-backend

**Дата:** 2026-08-11  
**Метод:** статический разбор актуального кода, сверка docs↔implementation, просмотр analytics/attachments/export стыка с фронтом.  
**Область:** FastAPI, CRUD, ORM, DOCX tools, analytics, storage, Docker/env, auth.

## Итоговая оценка

| Критерий | Балл |
|----------|------|
| Архитектура слоёв | 7.5/10 |
| Поддерживаемость CRUD | 8/10 |
| DOCX pipeline | 6.5/10 |
| Analytics | 7.5/10 (все вкладки + planning на API) |
| Storage / attachments | 7/10 |
| Тесты | 6/10 DOCX · 6/10 API smoke (auth/analytics/attachments mocked) |
| Безопасность | 7/10 (JWT+RBAC; нет OIDC/audit log) |
| Production readiness | 5.5/10 |
| Согласованность с фронтом | 8.5/10 |
| Документация | 8.5/10 (актуализация 11.08) |

**Вердикт:** доменный CRUD, DOCX, server analytics и MinIO-вложения зрелые; JWT+RBAC закрывает path B. Для prod критичны Alembic и банковский IdP/OIDC. Runbook миграций/данных: [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md). План — [PLAN.md](../../PLAN.md).

---

## Сильные стороны

1. Чистое разделение endpoints / schemas / crud / models / services.
2. Async SQLAlchemy + dependency injection session.
3. DOCX Раздела II — ZIP/XML с тестами bookmarks/links.
4. Analytics API для checks / recommendations / monitoring / dva / planning (не упирается в list limit).
5. Attachments: metadata table + bucket-per-check + sync buckets.
6. DRY справочников через `dictionary_crud` + validation на mutate.
7. Internal JWT + RBAC; Docker entrypoint: wait DB/MinIO → schema migrate → seed → optional demo import.

---

## Замечания (по приоритету)

### Critical / High

#### H1. Нет авторизации и RBAC — закрыто (path B)

Internal JWT: `POST /api/v1/auth/login`, Bearer на `/api/v1/*` кроме health.  
Роли: `auditor` (домен R/W), `admin` (справочники mutate + DELETE). Пользователи из `SOKOL_AUTH_USERS` или локальные defaults. OIDC/Keycloak — следующий шаг.

#### H2. Нет Alembic

Схема = `create_all` + ручные `migrate_*.py`. **Риск:** расхождение стендов, необратимые ALTER enum.  
**Рекомендация:** baseline + `stamp head` на живых БД, дальше только `alembic upgrade head`. См. [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md).

#### H3. Upload tools целиком в память

`await file.read()` до 100 MB. **Риск:** OOM / DoS при параллельных jobs.  
**Рекомендация:** streaming на диск + семафор.

#### H4. Analytics без пагинации/лимитов на сервере

Сервисы грузят сущности (+ recommendations) в память процесса. При росте портфеля — рост latency/RAM.  
**Рекомендация:** мониторинг; SQL-агрегации / материализованные срезы; кэш filterOptions.

### Medium

#### M1. Конфиг частично размазан — закрыто

CORS / upload / JWT / MinIO читаются через `Settings` (`app.core.config`). `main.py` использует `settings.cors_origins`.

#### M2. API/DB coverage still shallow

Есть unittest smoke для auth, `/analytics/*` и `/attachments/*` (моки session/MinIO). Нет integration-тестов на живой Postgres/MinIO и нет полного CRUD smoke.

#### M3. Ad-hoc migrate в entrypoint неполные

Entrypoint гоняет effectiveness + attachments; остальные `migrate_*` зависят от ручного запуска на старых БД.

#### M4. Справочники без FK — частично закрыто

Строковые поля домена по-прежнему без FK; на create/update API валидируются против справочников:
`check_leader` / `auditor` → `auditors`, `check_view` → `check_kinds`, оценки эффективности → `effectiveness_ratings` (400 при неизвестном значении). `manager` (руководитель объекта) — свободный текст. Bulk import/seed обходят CRUD и не проходят эту проверку.

#### M5. Синхронный DOCX на HTTP worker

`to_thread` без очереди и прогресса; длинные jobs держат worker.

### Low

#### L1. Нет soft-delete / audit log мутаций.
#### L2. Demo `--replace` в Docker при неверной env опасен для shared DB.
#### L3. MailHog в compose не используется кодом.

---

## FE ↔ BE стык (актуально)

| Тема | Статус |
|------|--------|
| CRUD checks/recommendations/settings | OK |
| Analytics (все вкладки + planning) | OK |
| Attachments API | OK при настроенном MinIO |
| Auth | JWT + RBAC (auditor/admin); OIDC позже |

---

## Рекомендуемый порядок работ

1. Alembic baseline + запрет `create_all` в prod bootstrap.  
2. OIDC/Keycloak (если IdP) + audit log; убрать fake password на FE.  
3. Расширить API smoke до живой Postgres/MinIO в CI; SQL-оптимизация analytics при росте данных.  
4. Streaming upload + job queue для DOCX.

---

## Связанные документы

- [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md)
- [STORAGE.md](STORAGE.md)
- [API.md](API.md)
- [PLAN.md](../../PLAN.md)
- Frontend review: [sokol-frontend/docs/CODE_REVIEW.md](../../sokol-frontend/docs/CODE_REVIEW.md)
