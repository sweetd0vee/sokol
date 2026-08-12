# CI gate

В репозитории есть GitHub Actions workflow `.github/workflows/ci.yml`.

## Что проверяет CI

| Job | Проверки |
|-----|----------|
| `Backend (Python 3.12)` | `compileall app scripts tests`, `python -m unittest discover -s tests -p "test_*.py" -v` |
| `Frontend (Node 22)` | `npm run lint`, `npm test`, `npm run build` |

Backend job поднимает PostgreSQL 16 service container и запускает тесты с:

```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_test
SOKOL_JWT_SECRET=ci-test-jwt-secret
SOKOL_RUN_DB_INTEGRATION_TESTS=1
```

## Как сделать gate обязательным

GitHub Actions YAML только создаёт checks. Обязательность включается в настройках репозитория:

1. Открыть `Settings` -> `Branches` -> `Branch protection rules`.
2. Создать или обновить правило для `main`/`master`.
3. Включить `Require a pull request before merging`.
4. Включить `Require status checks to pass before merging`.
5. Добавить required checks:
   - `Backend (Python 3.12)`
   - `Frontend (Node 22)`
6. Включить `Require branches to be up to date before merging`.
7. Сохранить правило.

После этого PR нельзя будет смержить, пока оба CI job не зелёные.
