# Roadmap — backend

Актуально на июль 2026. Порядок — по ценности для стабильности и стыка с UI.

## Фаза 0 — согласование и гигиена (1–3 дня)

- [x] Зафиксировать в документации два режима портов: Docker **8800**, local `run_dev.ps1` **8802** (+ фронт `.env.development`).
- [ ] (Опционально) Унифицировать порт API в коде (один порт для Docker и local), если onboarding всё ещё путает.
- [ ] Свести конфиг в один `Settings` (CORS, max upload).
- [ ] Пометить/убрать неиспользуемые Compose-сервисы (MinIO, MailHog) или завести feature flags.
- [ ] Закрыть разрыв **Analytics**: endpoint `/api/v1/analytics/by-person` или смена контракта фронта.

## Фаза 1 — данные и миграции (1–2 недели)

- [ ] Внедрить Alembic; baseline от текущей схемы.
- [ ] Перенести `migrate_*.py` в ревизии.
- [ ] Prod: запрет `create_all` как единственного механизма.
- [ ] Integration tests CRUD на тестовой БД.

## Фаза 2 — безопасность (2–4 недели)

- [ ] OIDC/Keycloak или JWT; `Authorization` на всех мутациях и чтении домена.
- [ ] Роли: просмотр / редактирование / admin справочников.
- [ ] Аудит логирования критичных операций (delete check, tools generate).

## Фаза 3 — DOCX platform (ongoing)

- [ ] Семафор/очередь на `/tools`.
- [ ] Streaming upload на диск.
- [ ] Каталог золотых АЗ в CI.
- [ ] Рефакторинг `docx_generator` / `docx_parser` на фазы.
- [ ] Тесты / устойчивость `audit_opinion` (моки Ollama, golden DOCX).

## Фаза 4 — продукт

- [ ] Хранение вложений (MinIO) + метаданные в БД.
- [ ] Server-side pagination/filter, используемые фронтом.
- [ ] Нормализация аудиторов/типов (FK или validation).
- [ ] Экспорт/импорт пакетных операций через API.

## Метрики готовности к prod

| Критерий | Сейчас | Цель |
|----------|--------|------|
| Auth | нет | обязательно |
| Миграции | create_all | Alembic |
| CI | нет | unittest + lint на PR |
| Analytics | разрыв FE/BE | согласовано |
| Upload | in-memory | stream + limit concurrency |
| API tests | нет | smoke CRUD + tools |
| Ollama / audit-opinion | есть в tools | моки + healthcheck в CI |
