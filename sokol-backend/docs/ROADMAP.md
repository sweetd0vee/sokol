# Roadmap — backend

Актуально на июль 2026. Порядок — по ценности для стабильности и стыка с UI.

## Фаза 0 — согласование и гигиена (1–3 дня)

- [ ] Выравнять порт API (8800 vs 8802) в `run_dev.ps1`, Docker, корневом README, CORS, фронт `.env`.
- [ ] Свести конфиг в один `Settings` (CORS, max upload).
- [ ] Пометить/убрать неиспользуемые Compose-сервисы (MinIO, MailHog, LT) или завести feature flags.
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
- [ ] Опционально: LanguageTool post-check текста рекомендаций.

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
