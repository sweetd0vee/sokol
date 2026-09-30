# Docker (UI) — production static (nginx)

Сеть `sokol` должна уже существовать (корневой `docker compose` или backend-only). API на хосте **8800**.

Образ: Node 22 multi-stage `npm run build` → nginx. `VITE_API_URL` задаётся **build-arg** (вшивается в бандл).

```bash
cd sokol-frontend
# при смене API URL нужна пересборка:
docker compose -f docker/docker-compose.yml build --build-arg VITE_API_URL=http://localhost:8800
docker compose -f docker/docker-compose.yml up -d
```

| Переменная / arg | Типичное значение |
|------------------|-------------------|
| `VITE_API_URL` | `http://localhost:8800` (URL API **как его видит браузер**) |

Порт с хоста: http://localhost:5180 → контейнер `:80`.

Локальная разработка без Docker: `npm run dev` в `sokol-frontend/` (не этот образ).

Полный стек: [DOCKER.md](../../DOCKER.md).
