# Code Review — sokol-frontend

**Дата:** 2026-08-07 (актуализация; исходный разбор 2026-07-28)  
**Метод:** статический разбор актуального `src/` + сверка с backend API + ревью рефакторинга Settings.  
**Область:** routing, contexts, API, вкладки, формы, tools, settings, profile.

## Итоговая оценка

| Критерий | Балл |
|----------|------|
| Архитектура и структура | 7.5/10 |
| Читаемость | 7.5/10 (+ DRY settings) |
| UX-консистентность | 8/10 |
| Надёжность / ошибки | 5.5/10 |
| Производительность (статика) | 6.5/10 |
| Тесты | 1/10 |
| Безопасность | 3/10 |
| Согласованность с backend | 7.5/10 |
| Документация | 8.5/10 |

**Итого ≈ 6.8/10.** Сильный UX-каркас и API-обвязка CRUD/tools; справочники вынесены в переиспользуемые панели; критичны stub-auth и отсутствие тестов. План — [PLAN.md](../../PLAN.md).

---

## Сильные стороны

1. Понятное разделение `api` / `contexts` / `components` / `utils`.
2. TanStack Query + `SokolDataProvider` дают единый CRUD-фасад для checks/recommendations.
3. Mappers и `errors.ts` аккуратно нормализуют FastAPI-ответы (включая blob errors tools).
4. Settings ходят в backend CRUD; четыре справочника в SegmentedControl, включая **Виды проверок**.
5. **Рефакторинг Settings (2026-08-07):** `makeSettingsCrud` в `api/settings.ts`; `useSingleFieldDictionary` + `SingleFieldDictionaryPanel` для аудиторов / видов проверок / оценок — меньше копипасты модалок.
6. Повторяемый UI kit и визуальный язык `sber`.
7. Tools поддерживают все три DOCX-режима backend, включая `section-ii-links`.

---

## Замечания (по приоритету)

### Critical / High

#### H1. Auth — декорация

`LoginPage` принимает любые non-empty credentials; нет JWT; Axios без `Authorization`.

**Риск:** любой, кто открыл UI к открытому API, работает с полными данными.  
**Рекомендация:** Keycloak/OIDC + interceptor; AuthGuard по валидному токену (PLAN фаза 2).

#### H2. ~~Analytics сломан на стыке с backend~~ — снято (август 2026)

Клиентские дашборды из `SokolDataContext`; отдельный analytics API не вызывается.

#### H3. Смена пароля — fake success UX

`ProfilePage` показывает модалку смены пароля без API.

**Рекомендация:** убрать до auth API либо disabled + «через SSO».

### Medium

#### M1. Bulk fetch + client filters

`limit: 500` / `1000` без server-side filter UI. При росте данных — долгий first paint.

#### M2. Вложения только локально

Пользователь добавляет файлы на форме, но они не сохраняются.

**Рекомендация:** MinIO + attachments API (PLAN playbook A) **или** явная пометка «не сохраняется» до API.

#### M3. Крупные page-компоненты

`ChecksTab`, `RecommendationsTab`, `CheckFormPage` всё ещё тяжёлые. Settings стал тоньше, но `auditTypes` (code+name) ещё не вынесен в dual-field panel.

#### M4. «Мои» завязаны на localStorage ФИО

Не совпадёт с будущим SSO displayName.

#### M5. Нет frontend tests

Нет Vitest/RTL/Playwright в scripts.

#### M6. Два порта API (Docker vs local)

`.env.development` = **8802**, Docker UI → API **8800**.

#### M7. «Виды проверок» в Settings ≠ options формы проверки

Справочник CRUD готов; форма/константы `CHECK_VIEW_OPTIONS` могут расходиться с `check_kinds`. Нужен wire после подтверждения бизнеса (PLAN D.3).

### Low

#### L1. `console.error` / тихие catch в Settings вместо toast

#### L2. Kantsler stub в основной навигации — шум

#### L3. Зависимость `xlsx` + `xlsx-js-style` — дублирование; `npm audit` в CI

#### L4. QueryClient: `retry: 1` глобально — мелочь

---

## Устаревшие findings (сняты)

- нестабильные ключи справочников без `id` → **исправлено**;
- delete/persistence справочников только локально → **исправлено**;
- мёртвый контракт `analytics/by-person` → **снято**;
- SettingsTab как непрозрачный монолит из 4× копипасты label-CRUD → **частично исправлено** (single-field panel + crud factory).

---

## Приоритетный план

Сводный план + playbooks MinIO / bank deploy / реальные данные — **[PLAN.md](../../PLAN.md)**. Frontend backlog — [ROADMAP.md](ROADMAP.md).

---

## Стык FE ↔ BE (чеклист)

| Контракт | FE | BE | Статус |
|----------|----|----|--------|
| Checks CRUD | ✅ | ✅ | OK |
| Recommendations CRUD | ✅ | ✅ | OK |
| Settings: auditors / audit_types / ratings | ✅ | ✅ | OK |
| Settings: check_kinds («Виды проверок») | ✅ Settings UI | ✅ API | OK в списках; **не** в форме проверки |
| section-ii / section-ii-links / memorandum | ✅ | ✅ | OK |
| parse-recommendations | ✅ | ✅ | OK |
| analytics API | ❌ (client-side) | ❌ | OK — FE не вызывает |
| Auth Bearer | ❌ | ❌ | оба stub |
| File attachments | UI only | ❌ | gap; playbook A |
