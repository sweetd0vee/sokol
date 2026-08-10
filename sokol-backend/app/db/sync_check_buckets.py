"""Синхронизация bucket MinIO для существующих проверок."""

import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.checks import Check
from app.services.storage.minio_storage import get_storage


async def sync_check_buckets() -> None:
    if not settings.minio_enabled:
        print("MinIO disabled — skip bucket sync.")
        return

    storage = get_storage()
    if storage is None:
        print("MinIO storage unavailable — skip bucket sync.")
        return

    if not await storage.ping():
        print("MinIO is not reachable — skip bucket sync.")
        return

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Check.serial_number))
        serials = [row[0] for row in result.all()]

    created = 0
    for serial in serials:
        await storage.ensure_check_bucket(serial)
        created += 1
    print(f"MinIO buckets ensured for {created} checks.")


def main() -> None:
    asyncio.run(sync_check_buckets())


if __name__ == "__main__":
    main()
