"""Idempotent seed functions for reference dictionaries and users."""

from app.db.catalogs import AUDIT_TYPES, CHECK_KINDS, EFFECTIVENESS_RATINGS
from app.db.seeds.audit_types import seed_audit_types
from app.db.seeds.auditors import seed_auditors
from app.db.seeds.check_kinds import seed_check_kinds
from app.db.seeds.departments import seed_departments
from app.db.seeds.effectiveness import seed_effectiveness_ratings
from app.db.seeds.users import seed_users

__all__ = [
    "seed_audit_types",
    "seed_auditors",
    "seed_check_kinds",
    "seed_departments",
    "seed_effectiveness_ratings",
    "seed_reference_dictionaries",
    "seed_users",
]


async def seed_reference_dictionaries() -> None:
    await seed_audit_types(AUDIT_TYPES)
    await seed_check_kinds(CHECK_KINDS)
    await seed_effectiveness_ratings(EFFECTIVENESS_RATINGS)
