# Сокол — фронтенд

Веб-интерфейс для внутреннего продукта «Сокол»: панели рекомендаций, проверок, аналитики, настроек и инструментов, а также профиля пользователя.

## Порты (локальная разработка)

| Сервис | URL |
|--------|-----|
| UI (Vite) | http://localhost:5180 |
| API (бэкенд) | http://localhost:8802 |

Порты в `.env.development`. Прокси Vite: `/api` → `http://127.0.0.1:8802`.

В **Docker** API на хосте — **8800** (`VITE_API_URL=http://localhost:8800`); см. корневой [DOCKER.md](../DOCKER.md).

## Возможности

- Авторизация: JWT (`POST /api/v1/auth/login`), Bearer interceptor, роли `admin` / `auditor` (OIDC — следующий шаг).
- Разделы: Проверки, Рекомендации, Наблюдения (демо без API), Аналитика, Планирование, Канцлер (заглушка), Настройки, Инструменты, Профиль.
- Формы проверок/рекомендаций: токены в `src/constants/formLayout.ts`.
- Вложения: через backend `/attachments` + MinIO.
- Инструменты: Раздел II АЗ (± гиперссылки), ДЗ, раздел I «Аудиторское мнение» (Ollama).
- Аналитика: `GET /api/v1/analytics/{checks|recommendations|monitoring|dva}`; экспорт XLSX/PDF/DOCX/HTML. Подробно: [docs/ANALYTICS.md](docs/ANALYTICS.md).
- Планирование: `GET /api/v1/analytics/planning` — [docs/PLANNING.md](docs/PLANNING.md) (экспорт пока выключен).
- Профиль: ФИО + аватар в localStorage; смена пароля — UI без API.
- Экспорт таблиц проверок и рекомендаций в XLSX, DOCX и PDF.

## Стек

- React 19 + TypeScript
- Vite 7
- TanStack Query, Axios
- Tailwind CSS
- Recharts (аналитика), xlsx-js-style / docx / pdfmake / html-to-image (экспорт)

## Быстрый старт

**1. Запустите бэкенд** (отдельный терминал, см. `sokol-backend/README.md`):

```powershell
cd sokol-backend
.\run_dev.ps1
```

**2. Запустите фронтенд:**

```bash
cd sokol-frontend
npm install
npm run dev
```

**3. Откройте:** http://localhost:5180

## Скрипты

- `npm run dev` — локальная разработка (порт **5180**)
- `npm run build` — сборка
- `npm run preview` — предпросмотр сборки
- `npm run lint` — линтинг
- `npm test` — Vitest
- `npm run docs:analytics-tz:full` — пересборка ANALYTICS_TZ.docx (нужен UI)

## Переменные окружения

Файл `.env.development` (в репозитории):

```bash
VITE_DEV_SERVER_PORT=5180
VITE_DEV_API_PORT=8802
```

Опционально в `.env.local`:

- `VITE_API_URL` — прямой URL API (минуя proxy). В обычном dev **не нужен**: запросы идут на origin `5180`, `/api` проксируется на бэкенд **8802**.

## Структура проекта

- `src/api` — HTTP‑клиент и запросы
- `src/components` — страницы и UI‑компоненты (`checks`, `recommendations`, `analytics`, `tabs`, …)
- `src/constants` — статусы, layout-токены форм (`formLayout.ts`)
- `src/contexts` — контексты (авторизация, данные)
- `src/data` — локальные демо-данные, пока нет backend API для сущности
- `src/hooks` — переиспользуемые React hooks
- `src/utils` — даты, экспорт, скачивание файлов, проверка `.docx`

Документация: [docs/README.md](docs/README.md) · аналитика: [docs/ANALYTICS.md](docs/ANALYTICS.md) · план развития: [PLAN.md](../PLAN.md).

## Актуальные маршруты

| Путь | Назначение |
|------|------------|
| `/checks`, `/checks/new`, `/checks/:id/edit` | проверки |
| `/recommendations`, `/recommendations/new`, `/recommendations/:id/edit` | рекомендации |
| `/observations`, `/observations/new`, `/observations/:id/edit` | наблюдения: демо-таблица + заглушка формы |
| `/analytics` | аналитика: серверные дашборды checks/recs/monitoring/DVA |
| `/planning` | планирование: `GET /analytics/planning` |
| `/tools` | инструменты генерации документов |
| `/kantsler` | раздел «Канцлер» (заглушка) |
| `/settings` | справочники |
| `/profile` | профиль |

Отдельной вкладки `/export` нет: экспорт встроен в таблицы и дашборды.

## Частые проблемы

**Ошибка 500 / network при генерации документов** — бэкенд не запущен или слушает не **8802**. Проверьте http://localhost:8802/docs

**Порт UI занят** — измените `VITE_DEV_SERVER_PORT` в `.env.development` и `SOKOL_CORS_ORIGINS` в `sokol-backend/.secrets/sokol.env`.
