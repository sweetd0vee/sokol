# Roadmap — frontend

**Актуально:** 7 августа 2026  
**Go-live:** **1 сентября 2026** — жёсткий календарь в [PLAN.md → Go-live](../../PLAN.md#go-live-01092026--жёсткий-план).  
**Единый план:** [PLAN.md](../../PLAN.md).

До 01.09: только go-live scope (auth UI, wire check_kinds, disclaimer/MinIO, скрыть заглушки nav).

Ниже — backlog, специфичный для UI. Порядок согласован с общим планом.

## Фаза 0 — гигиена

- [x] Клиентская аналитика вместо несуществующего `/analytics/by-person`.
- [x] Документировать порты dev (**5180** / **8802**) vs Docker (**8800**).
- [x] DRY Settings: `makeSettingsCrud` + `SingleFieldDictionaryPanel`; справочник «Виды проверок».
- [ ] Явно пометить блок вложений как «не сохраняется на сервере» **или** дождаться upload API (см. PLAN playbook A / фаза 4.2).
- [ ] Подключить options формы проверки к `/settings/check_kinds` (после подтверждения бизнеса).

## Фаза 1 — CI и тесты

- [ ] GitHub Actions: `lint` + `build`.
- [ ] Vitest: mappers, `errors.ts`, status/color helpers.
- [ ] (Позже) Playwright smoke: login → checks → recommendation.

## Фаза 2 — auth

- [ ] Keycloak/OIDC вместо stub login.
- [ ] Axios interceptor + AuthGuard по валидному токену.
- [ ] Убрать fake «смена пароля» или disabled + пояснение.
- [ ] «Мои проверки» — server identity, не только localStorage ФИО.

## Фаза 3 — UX и масштаб

- [ ] Server-side filter/pagination в `ChecksTab` / `RecommendationsTab` (API уже поддерживает query).
- [ ] Рефакторинг крупных страниц → hooks (`useTableFilters`, toolbar).
- [ ] Единый toast/error UI (Settings и формы).
- [ ] Виртуализация таблиц при росте данных.

## Фаза 4 — продукт

- [ ] **Наблюдения** — подключить UI к backend CRUD (после появления API).
- [ ] **Планирование** — заменить заглушку (требования TBD).
- [ ] **Канцлер** — интеграция СЭД или скрыть из nav до готовности.
- [ ] Upload вложений с форм check/recommendation (PLAN playbook A).

## Не в scope (осознанно)

- Отдельный analytics API — пока достаточно клиентских агрегатов.
- Полный design system — достаточно `UI_STANDARDS.md` + `formLayout.ts`.
