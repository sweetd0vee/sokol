# Frontend — документация

## Документы

| Файл | Содержание |
|------|------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Структура, state, API-слой |
| [ANALYTICS.md](ANALYTICS.md) | Дашборды `/analytics` |
| [PLANNING.md](PLANNING.md) | Раздел `/planning` |
| [UI_STANDARDS.md](UI_STANDARDS.md) | Сетка форм, цвета |
| [CODE_REVIEW](../../docs/CODE_REVIEW_FRONTEND.md) | Код-ревью |
| Backend | [API.md](../../sokol-backend/docs/API.md), [REPORTS.md](../../sokol-backend/docs/REPORTS.md) |
| [PLAN.md](../../PLAN.md) | Roadmap |

## Кратко

SPA на React 19 + Vite 7:

- **Auth** — JWT, роли `admin`/`auditor`, `AdminGuard` для settings/DELETE.
- **Данные** — TanStack Query + `SokolDataProvider` (checks/recommendations).
- **Analytics/planning** — `GET /api/v1/analytics/*`.
- **Tools** — upload `.docx` → backend.
- **Канцлер** — заглушка.

Токены форм: `src/constants/formLayout.ts`.

## Стек

React Router 7 · TanStack Query 5 · Axios · Tailwind · Recharts · xlsx/docx/pdfmake (экспорт) · Vitest

## Порты

| Режим | UI | API |
|-------|-----|-----|
| Dev | 5180 | 8802 |
| Docker | 5180 | 8800 |

## Роли

| Роль | Возможности |
|------|-------------|
| `auditor` | CRUD домена, analytics, tools, вложения |
| `admin` | + справочники, DELETE |

Фильтр «Мои» сравнивает руководителя с ФИО из профиля (localStorage), не с server identity.

## Основные потоки

1. **Проверка** — форма → `POST /checks`, вложения, импорт рекомендаций из АЗ (`parse-recommendations`).
2. **Рекомендация** — форма с контрольной зоной, closure, вложения.
3. **Инструменты** — `ToolsTab` → `DocxToolPanel` (section-ii, memorandum).
4. **Экспорт** — таблицы: XLSX/DOCX/PDF на клиенте; дашборды: visual export (xlsx/pdf/docx/html).

Алгоритм Раздела II — [REPORTS.md](../../sokol-backend/docs/REPORTS.md).
