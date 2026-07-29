# Docker (UI)

Сеть `sokol` должна уже существовать (поднимается корневым `docker compose` или backend compose).

```bash
cd sokol-frontend
docker compose -f docker/docker-compose.yml up --build -d
```

UI: http://localhost:5180 · API ожидается на http://localhost:8800

Для полного стека предпочтительнее корневой [DOCKER.md](../DOCKER.md).
