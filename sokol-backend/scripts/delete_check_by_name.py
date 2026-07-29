#!/usr/bin/env python3
"""Удалить проверку по точному названию (разовое обслуживание данных)."""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.checks import Check


async def delete_check_by_name(check_name: str) -> int:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Check).where(Check.check_name == check_name))
        checks = result.scalars().all()
        for check in checks:
            print(f"Удаление: id={check.id}, ключ={check.serial_number}, название={check.check_name}")
            await session.delete(check)
        if checks:
            await session.commit()
        return len(checks)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "check_name",
        nargs="?",
        default="Контрольная корректности интеграций",
        help="Точное название проверки для удаления",
    )
    args = parser.parse_args()
    removed = asyncio.run(delete_check_by_name(args.check_name))
    if removed:
        print(f"Удалено проверок: {removed}")
    else:
        print("Проверка с таким названием не найдена в базе.")


if __name__ == "__main__":
    main()
