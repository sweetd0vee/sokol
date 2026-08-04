# Roadmap — frontend

**Актуально:** август 2026  
**Единый план:** [PLAN.md](../../PLAN.md) — приоритеты, фазы, спринты.

Ниже — backlog, специфичный для UI. Порядок согласован с общим планом.

## Фаза 0 — гигиена

- [x] Клиентская аналитика вместо несуществующего `/analytics/by-person`.
- [x] Документировать порты dev (**5180** / **8802**) vs Docker (**8800**).
- [ ] Явно пометить блок вложений как «не сохраняется на сервере» **или** дождаться upload API (см. PLAN фаза 4.2).

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
- [ ] Upload вложений с форм check/recommendation.

## Не в scope (осознанно)

- Отдельный analytics API — пока достаточно клиентских агрегатов.
- Полный design system — достаточно `UI_STANDARDS.md` + `formLayout.ts`.
