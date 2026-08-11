# Code Review — sokol-backend

**Дата:** 2026-08-11  
**Метод:** статический разбор актуального кода, сверка docs↔implementation, просмотр analytics/attachments/export стыка с фронтом.  
**Область:** FastAPI, CRUD, ORM, DOCX tools, analytics, storage, Docker/env.

## Итоговая оценка

| Критерий | Балл |
|----------|------|
| Архитектура слоёв | 7.5/10 |
| Поддерживаемость CRUD | 8/10 |
| DOCX pipeline | 6.5/10 |
| Analytics | 7/10 (checks API) · 4/10 (остальные вкладки ещё на клиенте) |
| Storage / attachments | 7/10 |
| Тесты | 6/10 DOCX · 5/10 API smoke (analytics/attachments mocked) |
| Безопасность | 3/10 |
| Production readiness | 4.5/10 |
| Согласованность с фронтом | 8/10 |
| Документация | 8/10 (после актуализации 11.08) |

**Вердикт:** доменный CRUD и DOCX-контур зрелые; появился server-side analytics для проверок и MinIO-вложения. Для prod по-прежнему критичны auth и Alembic. Runbook миграций/данных: [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md). План — [PLAN.md](../../PLAN.md).

---

## Сильные стороны

1. Чистое разделение endpoints / schemas / crud / models / services.
2. Async SQLAlchemy + dependency injection session.
3. DOCX Раздела II — ZIP/XML с тестами bookmarks/links.
4. `GET /analytics/checks` считает по всей БД (не упирается в list limit 500/1000).
5. Attachments: metadata table + bucket-per-check + sync buckets.
6. DRY справочников через `dictionary_crud`.
7. Docker entrypoint: wait DB/MinIO → schema migrate → seed → optional demo import.

---

## Замечания (по приоритету)

### Critical / High

#### H1. Нет авторизации и RBAC

Все `/api/v1/*` открыты. **Риск:** чтение/удаление аудиторских данных, генерация DOCX, порча справочников и вложений.  
**Рекомендация:** JWT/OIDC (Keycloak), роли `auditor` / `admin`.

#### H2. Нет Alembic

Схема = `create_all` + ручные `migrate_*.py`. **Риск:** расхождение стендов, необратимые ALTER enum.  
**Рекомендация:** baseline + `stamp head` на живых БД, дальше только `alembic upgrade head`. См. [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md).

#### H3. Upload tools целиком в память

`await file.read()` до 100 MB. **Риск:** OOM / DoS при параллельных jobs.  
**Рекомендация:** streaming на диск + семафор.

#### H4. Analytics checks без пагинации/лимитов на сервере

Сервис грузит все checks (+ recommendations) в память процесса. При росте портфеля — рост latency/RAM.  
**Рекомендация:** мониторинг; SQL-агрегации / материализованные срезы; кэш filterOptions.

### Medium

#### M1. Конфиг частично размазан — закрыто

CORS / upload / Ollama / MinIO читаются через `Settings` (`app.core.config`). `main.py` использует `settings.cors_origins`.

#### M2. API/DB coverage still shallow

Есть unittest smoke для `/analytics/*` и `/attachments/*` (моки session/MinIO). Нет integration-тестов на живой Postgres/MinIO и нет полного CRUD smoke.

#### M3. Ad-hoc migrate в entrypoint неполные

Entrypoint гоняет effectiveness + attachments; остальные `migrate_*` зависят от ручного запуска на старых БД.

#### M4. Справочники без FK — частично закрыто

Строковые поля домена по-прежнему без FK; на create/update API валидируются против справочников:
`check_leader` / `auditor` / `manager` → `auditors`, `check_view` → `check_kinds`, оценки эффективности → `effectiveness_ratings` (400 при неизвестном значении). Bulk import/seed обходят CRUD и не проходят эту проверку.

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
| `GET /analytics/checks` | OK (вкладка «Проверки») |
| Analytics other tabs | клиент (`SokolDataContext`) |
| Attachments API | OK при настроенном MinIO |
| Auth | stub FE / open BE |

---

## Рекомендуемый порядок работ

1. Alembic baseline + запрет `create_all` в prod bootstrap.  
2. Auth (Keycloak) + запрет анонимного API.  
3. Расширить API smoke до живой Postgres/MinIO в CI; SQL-оптимизация analytics при росте данных.  
4. SQL-оптимизация analytics при росте данных; API для recommendations/monitoring/DVA.  
5. Streaming upload + job queue для DOCX.

---

## Связанные документы

- [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md)
- [STORAGE.md](STORAGE.md)
- [API.md](API.md)
- [PLAN.md](../../PLAN.md)
- Frontend review: [sokol-frontend/docs/CODE_REVIEW.md](../../sokol-frontend/docs/CODE_REVIEW.md)
