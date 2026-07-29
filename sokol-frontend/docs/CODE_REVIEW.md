# Code Review — sokol-frontend

**Дата:** 2026-07-28  
**Метод:** статический разбор актуального `src/` + сверка с backend API.  
**Область:** routing, contexts, API, вкладки, формы, tools, settings, profile.

## Итоговая оценка

| Критерий | Балл |
|----------|------|
| Архитектура и структура | 7.5/10 |
| Читаемость | 7/10 |
| UX-консистентность | 8/10 |
| Надёжность / ошибки | 5.5/10 |
| Производительность (статика) | 6.5/10 |
| Тесты | 1/10 |
| Безопасность | 3/10 |
| Согласованность с backend | 5/10 |
| Документация (после обновления) | 8/10 |

**Итого ≈ 6.4/10.** Сильный UX-каркас и API-обвязка CRUD/tools; критичны stub-auth, мёртвый analytics-контракт и отсутствие тестов.

---

## Сильные стороны

1. Понятное разделение `api` / `contexts` / `components` / `utils`.
2. TanStack Query + `SokolDataProvider` дают единый CRUD-фасад для checks/recommendations.
3. Mappers и `errors.ts` аккуратно нормализуют FastAPI-ответы (включая blob errors tools).
4. Settings реально ходят в backend CRUD (create/update/delete) — устаревшие замечания про «только local state» сняты.
5. Повторяемый UI kit и визуальный язык `sber`.
6. Tools поддерживают все три DOCX-режима backend, включая `section-ii-links`.
7. Навигация check ↔ recommendation через `location.state` продумана.

---

## Замечания (по приоритету)

### Critical / High

#### H1. Auth — декорация

`LoginPage` принимает любые non-empty credentials; нет JWT; Axios без `Authorization`.

**Риск:** любой, кто открыл UI к открытому API, работает с полными данными.  
**Рекомендация:** Keycloak/OIDC + interceptor; AuthGuard должен проверять валидность токена, не только localStorage flag.

#### H2. Analytics сломан на стыке с backend

`api/analytics.ts` → `GET /api/v1/analytics/by-person`, но в `sokol-backend` router analytics **нет**.

**Риск:** вкладка всегда в ErrorState; ложное ожидание готовности фичи.  
**Рекомендация (выбрать одно):**
- реализовать endpoint на backend; или
- считать агрегаты на клиенте из `checks`/`recommendations`; или
- скрыть вкладку / показать «в разработке».

#### H3. Смена пароля — fake success UX

`ProfilePage` показывает модалку смены пароля без API.

**Риск:** пользователь уверен, что пароль изменён.  
**Рекомендация:** убрать до появления auth API либо явно disabled + текст «недоступно».

### Medium

#### M1. Bulk fetch + client filters

`limit: 500` / `1000` без server-side filter UI. При росте данных — долгий first paint и лишний трафик.

**Рекомендация:** серверные `search`/`status` уже есть на API — начать использовать; виртуализация таблиц.

#### M2. Вложения только локально

Пользователь добавляет файлы на форме проверки/рекомендации, но они не сохраняются.

**Риск:** потеря данных при reload, ложное ощущение архива документов.  
**Рекомендация:** upload API + MinIO **или** явная пометка «черновик, не сохраняется».

#### M3. Крупные page-компоненты

`ChecksTab`, `RecommendationsTab`, `CheckFormPage`, `SettingsTab` — много useState и разметки.

**Рекомендация:** hooks `useTableFilters`, вынести table toolbar / filter bar.

#### M4. «Мои» / «Обо мне» завязаны на localStorage ФИО

Не совпадает с будущим SSO displayName; опечатка в профиле → пустой список.

#### M5. Нет frontend tests

Нет Vitest/RTL/Playwright в scripts. Регрессии mappers/status enums ловятся поздно.

#### M6. Два порта API (Docker vs local)

`.env.development` = **8802**, Docker UI → API **8800**. README/`docs` это документируют; путаница возможна при смешении режимов без сверки таблицы портов.

### Low

#### L1. `console.error` в Settings вместо единого toast/error UI

#### L2. Kantsler stub в основной навигации — шум для пользователей

#### L3. Зависимость `xlsx` + `xlsx-js-style` — дублирование; нужен `npm audit` в CI

#### L4. QueryClient: `retry: 1` глобально — для 404 analytics даёт лишний повтор

---

## Устаревшие findings (сняты)

Предыдущий `CODE_REVIEW.md` указывал:

- нестабильные ключи справочников без `id` → **исправлено** (UUID с API);
- delete/persistence справочников только локально → **исправлено** (API delete/create/update).

Не опирайтесь на старые пункты 1, 3, 4 прежней редакции.

---

## Приоритетный план

1. Закрыть Analytics (endpoint / client / hide).
2. Убрать или пометить fake password change.
3. Выравнять порты 8802 во всех env/docs/compose.
4. Подписать вложения как non-persistent **или** сделать upload.
5. Auth interceptor + реальный login.
6. Vitest на mappers + smoke Playwright login→checks list.
7. Подключить server-side filters в списках.

---

## Стык FE ↔ BE (чеклист)

| Контракт | FE | BE | Статус |
|----------|----|----|--------|
| Checks CRUD | ✅ | ✅ | OK |
| Recommendations CRUD | ✅ | ✅ | OK |
| Settings CRUD | ✅ | ✅ | OK |
| section-ii | ✅ | ✅ | OK |
| section-ii-links | ✅ | ✅ | OK |
| memorandum | ✅ | ✅ | OK |
| parse-recommendations | ✅ | ✅ | OK |
| analytics/by-person | ✅ | ❌ | **разрыв** |
| Auth Bearer | ❌ | ❌ | оба stub |
| File attachments | UI only | ❌ | не в scope API |
