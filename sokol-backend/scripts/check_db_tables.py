"""Проверка подключения к БД и списка таблиц."""
import asyncio

from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine


async def main() -> None:
    url = settings.database_url
    if not url:
        print("ERROR: DATABASE_URL не задан. Проверьте sokol-backend/.secrets/sokol.env")
        return

    # показываем только хост/базу без пароля
    target = url.split("@")[-1] if "@" in url else url
    print(f"DATABASE_URL -> ...@{target}")

    try:
        async with engine.connect() as conn:
            row = (
                await conn.execute(
                    text("SELECT current_database(), inet_server_addr(), inet_server_port()")
                )
            ).one()
            print(f"Подключено: database={row[0]}, host={row[1]}, port={row[2]}")

            tables = (
                await conn.execute(
                    text(
                        "SELECT tablename FROM pg_tables "
                        "WHERE schemaname = 'public' ORDER BY tablename"
                    )
                )
            ).fetchall()
            if tables:
                print("Таблицы в public:")
                for (name,) in tables:
                    print(f"  - {name}")
            else:
                print("Таблицы в public: (пусто)")
    except Exception as exc:
        print(f"ERROR подключения: {exc}")
        print("Убедитесь, что Postgres запущен и порт/логин в DATABASE_URL верные.")


if __name__ == "__main__":
    asyncio.run(main())
