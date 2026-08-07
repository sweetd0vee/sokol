import asyncio
from collections.abc import Sequence

from sqlalchemy import select

from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal
from app.models.check_kinds import CheckKind

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.seed_check_kinds

CHECK_KINDS = [
    "Корпо",
    "Розница",
    "Стратегия и финансы",
    "Риски",
    "ИТ",
    "Безопасность",
    "Комплаенс",
    "Процессинг, трансформация",
    "Маркетинг",
    "Управление делами",
    "АХД",
    "Кадры",
    "Мотивация",
    "Юристы",
    "Холдинг",
]


async def seed_check_kinds(kinds: Sequence[str]) -> int:
    if not kinds:
        return 0
    inserted = 0
    async with AsyncSessionLocal() as session:
        for label in kinds:
            label = label.strip()
            if not label:
                continue
            result = await session.execute(
                select(CheckKind).where(CheckKind.label == label)
            )
            if result.scalar_one_or_none():
                continue
            session.add(CheckKind(label=label))
            inserted += 1
        await session.commit()
    return inserted


async def main() -> None:
    await init_db()
    inserted = await seed_check_kinds(CHECK_KINDS)
    print(f"Seeded check kinds: {inserted}")


if __name__ == "__main__":
    asyncio.run(main())
