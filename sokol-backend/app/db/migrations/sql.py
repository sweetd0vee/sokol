"""SQL-only schema patches shared by the migrations CLI and Docker bootstrap."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from app.db.runtime import execute_sql_statements

MigrateFn = Callable[[], Awaitable[None]]


@dataclass(frozen=True)
class SqlPatch:
    name: str
    statements: tuple[str, ...]
    message: str

    async def migrate(self) -> None:
        await execute_sql_statements(self.statements)
        print(self.message)
