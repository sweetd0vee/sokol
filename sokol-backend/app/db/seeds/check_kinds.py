from __future__ import annotations

from collections.abc import Sequence

from app.db.seeds.label_rows import seed_exact_label_rows
from app.models.check_kinds import CheckKind


async def seed_check_kinds(kinds: Sequence[str]) -> int:
    return await seed_exact_label_rows(CheckKind, kinds)
