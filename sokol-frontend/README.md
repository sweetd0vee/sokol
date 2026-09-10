# Сокол — фронтенд

React 19 + TypeScript + Vite 7. Внутренний UI аудита.

## Порты

| Сервис | URL |
|--------|-----|
| UI | http://localhost:5180 |
| API (dev) | http://localhost:8802 |

Прокси Vite: `/api` → `127.0.0.1:8802` (`VITE_DEV_API_HOST` / `VITE_DEV_API_PORT`). В Docker API на **8800** — [DOCKER.md](../DOCKER.md).

## Быстрый старт

```bash
# терминал 1 — backend на 8802
# терминал 2:
cd sokol-frontend
npm install
npm run dev
```

http://localhost:5180 · dev-логин: `Админ А.А.` / `admin` (alias `admin`), аудиторы (ФИО) / `auditor`.

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | разработка (5180) |
| `npm run build` | сборка |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run test:watch` | Vitest watch |
| `npm run test:e2e` | Playwright (не в CI) |
| `npm run docs:analytics-screenshots` | скриншоты дашбордов → `../docs/analytics-screenshots/` |
| `npm run docs:analytics-tz` | DOCX ТЗ аналитики → `../docs/` |
| `npm run docs:analytics-tz:full` | скриншоты + ТЗ |

## Env (`.env.development`)

```bash
VITE_DEV_SERVER_PORT=5180
VITE_DEV_API_HOST=127.0.0.1
VITE_DEV_API_PORT=8802
```

`VITE_API_URL` — прямой URL API (Docker-сборка обычно `http://localhost:8800`). CORS на backend: `SOKOL_CORS_ORIGINS=http://localhost:5180`.

## Маршруты

| Путь | Раздел |
|------|--------|
| `/login` | вход |
| `/checks`, `/checks/new`, `/checks/:id/edit` | проверки |
| `/recommendations`, `.../new`, `.../:id/edit` | рекомендации |
| `/analytics` | аналитика |
| `/planning` | планирование |
| `/constructor`, `/constructor/:id` | конструктор дашбордов |
| `/tools` | DOCX-инструменты |
| `/settings` | справочники (admin) |
| `/profile` | профиль |

Неизвестный путь → `/checks`.

## Структура `src/`

`api/` · `components/` (в т.ч. `forms/`, `planning/`, `analytics/`) · `contexts/` · `constants/` · `hooks/` · `utils/` · `config/` · `assets/` · `types/`

Документация: [docs/README.md](../docs/README.md).

## Возможности

JWT auth · CRUD проверок/рекомендаций · справочники · вложения (MinIO) · server analytics · visual export analytics/planning/constructor · DOCX tools · профиль со сменой пароля через API.

## Частые проблемы

| Симптом | Действие |
|---------|----------|
| 500 / ECONNREFUSED | backend на **8802** |
| 401 | перелогиниться |
| CORS | `SOKOL_CORS_ORIGINS` + restart API |
| Порт 5180 занят | сменить `VITE_DEV_SERVER_PORT` |
