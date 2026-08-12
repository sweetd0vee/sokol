# Сокол — фронтенд

React 19 + TypeScript + Vite 7. Внутренний UI аудита.

## Порты

| Сервис | URL |
|--------|-----|
| UI | http://localhost:5180 |
| API (dev) | http://localhost:8802 |

Прокси Vite: `/api` → `127.0.0.1:8802`. В Docker API на **8800** — [DOCKER.md](../DOCKER.md).

## Быстрый старт

```powershell
# терминал 1 — backend (sokol-backend/run_dev.ps1)
# терминал 2:
cd sokol-frontend
npm install
npm run dev
```

http://localhost:5180 · dev-логин: `admin`/`admin` или `auditor`/`auditor`

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | разработка (5180) |
| `npm run build` | сборка |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

## Env (`.env.development`)

```bash
VITE_DEV_SERVER_PORT=5180
VITE_DEV_API_PORT=8802
```

`VITE_API_URL` — только если нужен прямой URL API (обычно не нужен). CORS на backend: `SOKOL_CORS_ORIGINS=http://localhost:5180`.

## Маршруты

| Путь | Раздел |
|------|--------|
| `/checks`, `/checks/new`, `/checks/:id/edit` | проверки |
| `/recommendations`, `.../new`, `.../:id/edit` | рекомендации |
| `/analytics` | аналитика |
| `/planning` | планирование |
| `/tools` | DOCX-инструменты |
| `/settings` | справочники (admin) |
| `/profile` | профиль |
| `/kantsler` | заглушка |

## Структура `src/`

`api/` · `components/` · `contexts/` · `constants/` · `hooks/` · `utils/` · `types/`

Документация: [docs/README.md](docs/README.md).

## Возможности

JWT auth · CRUD проверок/рекомендаций · справочники · вложения (MinIO) · server analytics · клиентский экспорт таблиц/дашбордов · DOCX tools · профиль (смена пароля — UI-only).

## Частые проблемы

| Симптом | Действие |
|---------|----------|
| 500 / ECONNREFUSED | backend на **8802** |
| 401 | перелогиниться |
| CORS | `SOKOL_CORS_ORIGINS` + restart API |
| Порт 5180 занят | сменить `VITE_DEV_SERVER_PORT` |
