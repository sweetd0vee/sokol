# Docker (UI)

Сеть `sokol` должна уже существовать (поднимается корневым `docker compose` или backend compose). API ожидается на **8800**.

```bash
cd sokol-frontend
docker compose -f docker/docker-compose.yml up --build -d
# или хелперы: docker/docker-compose-up.sh · docker-compose-up.bat
```

| Переменная | Типичное значение |
|------------|-------------------|
| `VITE_API_URL` | `http://localhost:8800` |
| `VITE_DEV_API_HOST` | `api` (внутри compose-сети) |
| `VITE_DEV_API_PORT` | `8800` |

Образ: `sber/sokol-fe:master`. UI: http://localhost:5180.

Для полного стека предпочтительнее корневой [DOCKER.md](../../DOCKER.md).
