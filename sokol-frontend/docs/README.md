# Frontend — документация

## Документы

| Файл | Содержание |
|------|------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Структура, state, API-слой |
| [ANALYTICS.md](ANALYTICS.md) | Дашборды `/analytics` |
| [SOKOL_Аналитика.docx](SOKOL_Аналитика.docx) | Бизнес-описание дашбордов со скриншотами |
| [PLANNING.md](PLANNING.md) | Раздел `/planning` |
| [UI_STANDARDS.md](UI_STANDARDS.md) | Сетка форм, цвета |
| [CODE_REVIEW](../../docs/CODE_REVIEW_FRONTEND.md) | Код-ревью |
| Backend | [API.md](../../sokol-backend/docs/API.md), [REPORTS.md](../../sokol-backend/docs/REPORTS.md) |
| [PLAN.md](../../PLAN.md) | Roadmap |

## Кратко

SPA на React 19 + Vite 7:

- **Auth** — JWT, роли `admin` / `department_head` / `auditor`. В UI `isAdmin` = admin или руководитель департамента (settings mutate, DELETE проверок, пользователи).
- **Данные** — TanStack Query + `SokolDataProvider` (checks/recommendations, до 10000 строк).
- **Analytics/planning** — `GET /api/v1/analytics/*`.
- **Tools** — upload `.docx` → backend (Раздел II, гиперссылки, файл контроля, ДЗ).
- **Профиль** — аватар в localStorage, смена пароля через API; admin создаёт пользователей (`POST /users`).

Токены форм: `src/constants/formLayout.ts`.

## Стек

React Router 7 · TanStack Query 5 · Axios · Tailwind · Recharts · react-grid-layout · xlsx / exceljs / docx / pdfmake / html-to-image (экспорт) · Vitest · Playwright

## Порты

| Режим | UI | API |
|-------|-----|-----|
| Dev | 5180 | 8802 |
| Docker | 5180 | 8800 |

## Роли

| Роль | Возможности в UI |
|------|------------------|
| `auditor` | CRUD домена, analytics, tools, вложения; DELETE рекомендации — только своей (`auditor` ↔ ФИО) |
| `department_head` | как admin в UI (`isAdmin`) |
| `admin` | + справочники, DELETE проверок, удаление вложений проверки, `GET/POST /users` |

Фильтр «Мои» сравнивает руководителя / аудитора / менеджера с ФИО из JWT (`shortName`) через `personMatch` (фамилия + инициалы), не с server identity.

## Основные потоки

1. **Проверка** — форма → `POST /checks`; `serial_number` только с backend; вложения (удаление — admin); импорт рекомендаций из АЗ (`POST /tools/parse-recommendations` + `POST /recommendations/batch`).
2. **Рекомендация** — форма с индикаторами, closure, продлениями, снятием с контроля, вложениями.
3. **Инструменты** — вкладки АЗ / ДЗ: section-ii, section-ii-links, control-file, memorandum.
4. **Экспорт** — таблицы: XLSX/DOCX/PDF на клиенте; дашборды: visual export (html/pdf/docx/xlsx).

Алгоритм Раздела II — [REPORTS.md](../../sokol-backend/docs/REPORTS.md).
