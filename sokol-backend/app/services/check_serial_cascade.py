"""Cascade serial_number rewrites across checks, recommendations, attachments, MinIO."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attachments import Attachment
from app.models.checks import Check
from app.models.recommendations import Recommendation
from app.services.storage.minio_storage import check_bucket_name, get_storage

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SerialRewrite:
    check_id: int
    old_serial: str
    new_serial: str


def _temp_serial(check_id: int) -> str:
    return f"__cascade_{check_id}__"


def replace_auditor_code_in_serial(serial: str, old_code: str, new_code: str) -> str | None:
    """Rewrite the 3-letter auditor segment in ``YYCODE…`` keys. Returns None if not matched."""
    old = old_code.strip().upper()
    new = new_code.strip().upper()
    if len(old) != 3 or len(new) != 3:
        return None
    value = (serial or "").strip()
    if len(value) < 5 or value[2:5].upper() != old:
        return None
    return f"{value[:2]}{new}{value[5:]}"


async def apply_serial_rewrites(
    session: AsyncSession,
    rewrites: list[SerialRewrite],
    *,
    commit: bool = False,
) -> None:
    """Apply serial renames with temp keys; cascade to recommendations and attachments.

    MinIO objects are copied before DB updates; old buckets are deleted after a successful
    commit when ``commit=True``. If ``commit=False``, the caller must commit and then call
    ``cleanup_old_serial_buckets``.
    """
    if not rewrites:
        return

    storage = get_storage()
    if storage is not None:
        for item in rewrites:
            if item.old_serial == item.new_serial:
                continue
            try:
                await storage.copy_check_bucket_objects(item.old_serial, item.new_serial)
            except Exception:  # noqa: BLE001
                logger.exception(
                    "Failed to migrate MinIO bucket for check serial %s -> %s",
                    item.old_serial,
                    item.new_serial,
                )
                raise

    check_ids = [item.check_id for item in rewrites]
    result = await session.execute(select(Check).where(Check.id.in_(check_ids)))
    checks_by_id = {check.id: check for check in result.scalars().all()}

    for item in rewrites:
        check = checks_by_id.get(item.check_id)
        if check is None:
            continue
        check.serial_number = _temp_serial(item.check_id)
    await session.flush()

    for item in rewrites:
        check = checks_by_id.get(item.check_id)
        if check is None:
            continue
        check.serial_number = item.new_serial
        await session.execute(
            update(Recommendation)
            .where(Recommendation.check_id == item.check_id)
            .values(serial_number=item.new_serial),
        )
        await session.execute(
            update(Attachment)
            .where(Attachment.check_serial_number == item.old_serial)
            .values(
                check_serial_number=item.new_serial,
                bucket=check_bucket_name(item.new_serial),
            ),
        )

    if commit:
        await session.commit()
        await cleanup_old_serial_buckets(rewrites)


async def cleanup_old_serial_buckets(rewrites: list[SerialRewrite]) -> None:
    storage = get_storage()
    if storage is None:
        return
    for item in rewrites:
        if check_bucket_name(item.old_serial) == check_bucket_name(item.new_serial):
            continue
        try:
            await storage.delete_check_bucket(item.old_serial)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to delete old MinIO bucket for check %s", item.old_serial)


async def cascade_auditor_code_in_check_keys(
    session: AsyncSession,
    *,
    check_leader: str,
    old_code: str,
    new_code: str,
) -> list[SerialRewrite]:
    """Rewrite check keys for one auditor after a dictionary code change."""
    old = old_code.strip().upper()
    new = new_code.strip().upper()
    if old == new:
        return []

    result = await session.execute(
        select(Check)
        .where(Check.check_leader == check_leader)
        .order_by(Check.start_date.asc(), Check.id.asc())
    )
    checks = list(result.scalars().all())
    rewrites: list[SerialRewrite] = []
    for check in checks:
        new_serial = replace_auditor_code_in_serial(check.serial_number, old, new)
        if new_serial is None or new_serial == check.serial_number:
            continue
        rewrites.append(
            SerialRewrite(
                check_id=check.id,
                old_serial=check.serial_number,
                new_serial=new_serial,
            )
        )

    if rewrites:
        await apply_serial_rewrites(session, rewrites, commit=False)
    return rewrites
