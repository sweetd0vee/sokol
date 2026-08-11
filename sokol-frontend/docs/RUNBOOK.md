# Запуск frontend

## Требования

- Node.js 20+ (проверено на 22.x)
- npm 9+
- Запущенный `sokol-backend` на порту, совпадающем с `VITE_DEV_API_PORT`

## Установка

```bash
cd sokol-frontend
npm install
```

## Dev-сервер

```bash
npm run dev
```

UI: **http://127.0.0.1:5180**

## Переменные окружения

Файл `.env.development` (актуально):

```env
VITE_DEV_SERVER_PORT=5180
VITE_DEV_API_PORT=8802
```

Vite проксирует `/api` → `http://127.0.0.1:8802`.

Опционально `.env.local`:

```env
VITE_API_URL=http://127.0.0.1:8802
```

`VITE_API_URL` нужен только для прямого обращения к API (минуя proxy). В обычном dev оставляйте пустым / не задавайте — используйте относительный `/api`.

**Важно:** backend `run_dev.ps1` слушает **8802**. Если поднять uvicorn на 8800 без смены env — вкладки с API и «Инструменты» получат network/proxy errors.

CORS на backend:

```env
SOKOL_CORS_ORIGINS=http://localhost:5180
```

## Сборка и preview

```bash
npm run build
npm run preview
```

`build` = `tsc -b && vite build`.

## Docker

```bash
cd sokol-frontend
docker compose -f docker/docker-compose.yml up
```

- UI: `http://localhost:5180`
- Образ `sber/sokol-fe:master` (см. `docker/README.md`)
- Сеть `sokol` должна существовать (часто создаётся backend compose)
- Проверьте, что `VITE_API_URL` / proxy target совпадает с реальным портом API

## Проверки качества

```bash
npm run lint
npm run build
npm test
```

Vitest: `npm test` (`vitest run`).

## Частые проблемы

| Симптом | Действие |
|---------|----------|
| 500 / ECONNREFUSED на `/api` | Запустить backend на **8802** или поправить `VITE_DEV_API_PORT` |
| 401 / редирект на login | JWT отсутствует или просрочен — войти заново (`admin`/`admin` или `auditor`/`auditor`) |
| CORS | `SOKOL_CORS_ORIGINS=http://localhost:5180` + restart API |
| Аналитика пустая / ошибка загрузки | Нужен backend на **8802** с роутами `/api/v1/analytics/*`; перезапустите uvicorn |
| Audit-opinion 502 / timeout | Нужна Ollama с моделью; клиентский timeout 600s |
| `vite: Permission denied` | `chmod +x node_modules/.bin/vite` (Unix) |
| Rollup native missing | удалить `node_modules` + lockfile → `npm install` |
| Порт 5180 занят | сменить `VITE_DEV_SERVER_PORT` или освободить порт |

## Favicon

`index.html` может ссылаться на `/sberbank.png`. Положите файл в `public/` или обновите ссылку.
