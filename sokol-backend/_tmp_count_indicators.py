import asyncio

from sqlalchemy import text

from app.db.session import engine


async def main() -> None:
    async with engine.connect() as conn:
        rows = (
            await conn.execute(
                text(
                    "SELECT indicator, count(id) FROM recommendations "
                    "GROUP BY indicator ORDER BY count(id) DESC"
                )
            )
        ).all()
        for indicator, count in rows:
            print(repr(indicator), count)


if __name__ == "__main__":
    asyncio.run(main())
