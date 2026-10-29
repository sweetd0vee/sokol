import asyncio

from sqlalchemy import text

from app.db.session import engine


async def main() -> None:
    async with engine.connect() as conn:
        counts = (
            await conn.execute(
                text(
                    """
                    SELECT
                      (SELECT count(*) FROM checks) AS checks,
                      (SELECT count(*) FROM recommendations) AS recs
                    """
                )
            )
        ).one()
        samples = (
            await conn.execute(
                text(
                    """
                    SELECT serial_number, left(check_name, 140)
                    FROM checks
                    ORDER BY id
                    LIMIT 8
                    """
                )
            )
        ).all()
    print(tuple(counts))
    for row in samples:
        print(row[0])
        print(row[1])
        print("---")


if __name__ == "__main__":
    asyncio.run(main())
