from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.audit_types import AuditType


async def seed_audit_types(audit_types: Sequence[tuple[str, str]]) -> int:
    if not audit_types:
        return 0
    inserted = 0
    async with AsyncSessionLocal() as session:
        for code, name in audit_types:
            code = code.strip()
            name = name.strip()
            if not code or not name:
                continue
            result = await session.execute(
                select(AuditType).where(AuditType.code == code)
            )
            if result.scalar_one_or_none():
                continue
            session.add(AuditType(code=code, name=name))
            inserted += 1
        await session.commit()
    return inserted
