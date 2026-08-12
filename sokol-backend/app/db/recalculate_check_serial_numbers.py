"""Пересчёт ключей проверок по актуальным правилам (год + руководитель + тип)."""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass

from sqlalchemy import select, update

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.attachments import Attachment
from app.models.checks import Check
from app.models.recommendations import Recommendation
from app.services.storage.minio_storage import check_bucket_name, get_storage
from app.utils.check_key import assign_serial_numbers


@dataclass(frozen=True)
class SerialChange:
    check_id: int
    old_serial: str
    new_serial: str


def _temp_serial(check_id: int) -> str:
    return f"__recalc_{check_id}__"


async def _load_checks(session) -> list[Check]:
    result = await session.execute(
        select(Check).order_by(Check.start_date.asc(), Check.id.asc()),
    )
    return list(result.scalars().all())


def _build_serial_assignments(checks: list[Check]) -> tuple[dict[int, str], list[SerialChange]]:
    payload = [
        {
            "id": check.id,
            "start_date": check.start_date,
            "check_leader": check.check_leader,
            "check_type": check.check_type,
        }
        for check in checks
    ]
    assigned = assign_serial_numbers(payload)
    final_by_id = {item["id"]: item["serial_number"] for item in assigned}

    changes: list[SerialChange] = []
    for check in checks:
        new_serial = final_by_id[check.id]
        if new_serial != check.serial_number:
            changes.append(
                SerialChange(
                    check_id=check.id,
                    old_serial=check.serial_number,
                    new_serial=new_serial,
                )
            )
    return final_by_id, changes


async def _copy_bucket_objects(old_serial: str, new_serial: str) -> int:
    storage = get_storage()
    if storage is None:
        return 0
    return await storage.copy_check_bucket_objects(old_serial, new_serial)


async def recalculate_check_serial_numbers(*, apply: bool) -> int:
    async with AsyncSessionLocal() as session:
        checks = await _load_checks(session)
        final_by_id, changes = _build_serial_assignments(checks)

        if not changes:
            print("Все ключи уже соответствуют правилам — изменений нет.")
            return 0

        print(f"Найдено проверок для обновления: {len(changes)} из {len(checks)}")
        for change in changes:
            print(f"  id={change.check_id}: {change.old_serial} -> {change.new_serial}")

        if not apply:
            print("\nЭто пробный прогон. Для записи в БД запустите с флагом --apply")
            return len(changes)

        minio_enabled = settings.minio_enabled and get_storage() is not None
        if minio_enabled:
            print("\nМиграция объектов MinIO...")
            for change in changes:
                copied = await _copy_bucket_objects(change.old_serial, change.new_serial)
                if copied:
                    print(f"  {change.old_serial}: скопировано объектов — {copied}")

        print("\nОбновление БД...")
        for check in checks:
            check.serial_number = _temp_serial(check.id)
        await session.flush()

        for check in checks:
            check.serial_number = final_by_id[check.id]

        for change in changes:
            await session.execute(
                update(Recommendation)
                .where(Recommendation.check_id == change.check_id)
                .values(serial_number=change.new_serial),
            )
            await session.execute(
                update(Attachment)
                .where(Attachment.check_serial_number == change.old_serial)
                .values(
                    check_serial_number=change.new_serial,
                    bucket=check_bucket_name(change.new_serial),
                ),
            )

        await session.commit()

        if minio_enabled:
            print("\nУдаление устаревших bucket MinIO...")
            for change in changes:
                if check_bucket_name(change.old_serial) != check_bucket_name(change.new_serial):
                    await get_storage().delete_check_bucket(change.old_serial)  # type: ignore[union-attr]

    return len(changes)


def main() -> None:
    parser = argparse.ArgumentParser(description="Пересчёт ключей проверок (serial_number)")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Записать изменения в БД (без флага — только показать diff)",
    )
    args = parser.parse_args()
    count = asyncio.run(recalculate_check_serial_numbers(apply=args.apply))
    if args.apply and count:
        print(f"\nГотово: обновлено ключей — {count}")


if __name__ == "__main__":
    main()
