"""FK-backed dictionary usage checks and recommendation-department links."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import delete, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.dictionary_crud import find_dictionary_duplicate_by_label
from app.models.auditors import Auditor
from app.models.check_kinds import CheckKind
from app.models.checks import Check
from app.models.departments import Department
from app.models.effectiveness_ratings import EffectivenessRating
from app.models.recommendations import Recommendation, RecommendationAuditObject
from app.utils.dictionary_text import UNSPECIFIED_AUDIT_OBJECT

EFFECTIVENESS_FIELDS = (
    "process_effectiveness",
    "svk_effectiveness",
    "sur_effectiveness",
    "svik_effectiveness",
)


def normalize_optional_dictionary_label(value: object) -> str | None:
    if value is None:
        return None
    stripped = str(value).strip()
    return stripped or None


async def ensure_unspecified_department(session: AsyncSession) -> None:
    existing = await find_dictionary_duplicate_by_label(
        session, Department, Department.name, UNSPECIFIED_AUDIT_OBJECT
    )
    if existing is not None:
        return
    session.add(Department(name=UNSPECIFIED_AUDIT_OBJECT))
    await session.flush()


async def sync_recommendation_audit_objects(
    session: AsyncSession,
    recommendation_id: int,
    department_names: Sequence[str],
) -> None:
    names = list(dict.fromkeys(name for name in department_names if name and str(name).strip()))
    if UNSPECIFIED_AUDIT_OBJECT in names:
        await ensure_unspecified_department(session)
    await session.execute(
        delete(RecommendationAuditObject).where(
            RecommendationAuditObject.recommendation_id == recommendation_id
        )
    )
    session.add_all(
        [
            RecommendationAuditObject(
                recommendation_id=recommendation_id,
                department_name=name,
            )
            for name in names
        ]
    )


async def _exists(session: AsyncSession, statement) -> bool:
    result = await session.scalar(statement.limit(1))
    return result is not None


async def replace_recommendation_audit_object_label(
    session: AsyncSession,
    old_name: str,
    new_name: str,
) -> int:
    result = await session.execute(
        text(
            "UPDATE recommendations "
            "SET audit_object = array_replace(audit_object, :old_name, :new_name) "
            "WHERE :old_name = ANY(audit_object)"
        ),
        {"old_name": old_name, "new_name": new_name},
    )
    return int(result.rowcount or 0)


async def auditor_label_in_use(session: AsyncSession, full_name: str) -> bool:
    leader_query = select(Check.id).where(Check.check_leader == full_name)
    auditor_query = select(Recommendation.id).where(Recommendation.auditor == full_name)
    return await _exists(session, leader_query) or await _exists(session, auditor_query)


async def department_label_in_use(session: AsyncSession, name: str) -> bool:
    link_query = select(RecommendationAuditObject.recommendation_id).where(
        RecommendationAuditObject.department_name == name
    )
    if await _exists(session, link_query):
        return True
    array_query = select(Recommendation.id).where(Recommendation.audit_object.contains([name]))
    return await _exists(session, array_query)


async def check_kind_label_in_use(session: AsyncSession, label: str) -> bool:
    return await _exists(session, select(Check.id).where(Check.check_view == label))


async def effectiveness_label_in_use(session: AsyncSession, label: str) -> bool:
    return await _exists(
        session,
        select(Check.id).where(
            or_(
                Check.process_effectiveness == label,
                Check.svk_effectiveness == label,
                Check.sur_effectiveness == label,
                Check.svik_effectiveness == label,
            )
        ),
    )


async def dictionary_item_in_use(session: AsyncSession, item: object) -> bool:
    if isinstance(item, Auditor):
        return await auditor_label_in_use(session, item.full_name)
    if isinstance(item, Department):
        return await department_label_in_use(session, item.name)
    if isinstance(item, CheckKind):
        return await check_kind_label_in_use(session, item.label)
    if isinstance(item, EffectivenessRating):
        return await effectiveness_label_in_use(session, item.label)
    return False


def dictionary_identity(item: object) -> tuple[str, str] | None:
    if isinstance(item, Auditor):
        return "auditors", item.full_name
    if isinstance(item, Department):
        return "departments", item.name
    if isinstance(item, CheckKind):
        return "check_kinds", item.label
    if isinstance(item, EffectivenessRating):
        return "effectiveness_ratings", item.label
    return None
