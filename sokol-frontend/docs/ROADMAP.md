# Roadmap — frontend

**Актуально:** 11 августа 2026  
**Go-live:** **1 сентября 2026** — [PLAN.md → Go-live](../../PLAN.md#go-live-01092026--жёсткий-план).

## Фаза 0 — гигиена

- [x] Клиентская аналитика вместо несуществующего `/analytics/by-person`.
- [x] Server analytics: checks / recommendations / monitoring / dva / planning.
- [x] Планирование: рабочие дашборды (не stub).
- [x] Документировать порты dev (**5180** / **8802**) vs Docker (**8800**).
- [x] DRY Settings: `makeSettingsCrud` + `SingleFieldDictionaryPanel`.
- [x] Attachments UI → backend API / MinIO.
- [ ] Подключить options формы проверки к `/settings/check_kinds`.
- [ ] Включить экспорт планирования (сейчас `canExport={false}`).

## Фаза 1 — CI и тесты

- [x] Vitest + базовые unit-тесты (`npm test`).
- [ ] GitHub Actions: `lint` + `build` + `test`.
- [ ] Расширить Vitest: mappers, analytics export helpers, filters.
- [ ] (Позже) Playwright smoke: login → checks → analytics export.

## Фаза 2 — auth

- [x] JWT login + Axios Bearer interceptor + AuthGuard.
- [x] RBAC в UI (`admin` / `auditor`, `AdminGuard`).
- [ ] Keycloak/OIDC поверх JWT.
- [ ] Убрать fake «смена пароля».
- [ ] «Мои проверки» — server identity.

## Фаза 3 — продукт

- [x] Server analytics для рекомендаций / мониторинга / ДВА / planning.
- [ ] Server-driven pagination/filters для больших таблиц.
- [ ] Наблюдения: форма + API (если в scope).
- [ ] Канцлер: контракт СЭД или скрыть из nav.

Детали — [PLAN.md](../../PLAN.md).
