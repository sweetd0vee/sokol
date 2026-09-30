# CI gate

Workflow: `.github/workflows/ci.yml`.

## Что проверяет

| Job | Проверки |
|-----|----------|
| `Backend (Python 3.12)` | `compileall app scripts tests`, `unittest discover -s tests -p "test_*.py"` |
| `Frontend (Node 22)` | `npm run lint`, `npm test` (Vitest), `npm run build`, Playwright e2e (auth + constructor, API мокается) |

Backend поднимает PostgreSQL 16 и гоняет тесты с:

```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_test
SOKOL_JWT_SECRET=ci-test-jwt-secret
SOKOL_RUN_DB_INTEGRATION_TESTS=1
```

**Не входит в CI:** живой бэкенд для e2e. Playwright поднимает только Vite и мокает `/api`.

## Обязательный merge gate

YAML только создаёт checks. Чтобы красный CI блокировал merge, в GitHub должен быть ruleset или branch protection.

Нужные правила для default branch (`main` / `master`):

1. `Settings` → `Rules` → `Rulesets` (предпочтительно) или `Settings` → `Branches` → branch protection.
2. `Require a pull request before merging`.
3. `Require status checks to pass before merging`.
4. Required checks: `Backend (Python 3.12)`, `Frontend (Node 22)`.
5. `Require branches to be up to date before merging`.

Прямой URL: `https://github.com/sweetd0vee/sokol/settings/rules`.
