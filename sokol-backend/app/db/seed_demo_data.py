"""Throwaway synthetic checks/recommendations. Not used in Docker. Delete before prod."""

from __future__ import annotations

import argparse

from app.core.config import settings
from app.core.startup_validation import assert_seed_replace_safe_for_env
from app.db.catalogs import AUDITORS, CHECK_KINDS, DEPARTMENTS, EFFECTIVENESS_RATINGS
from app.db.demo_data import build_check_rows, build_recommendation_rows
from app.db.init_db import init_db
from app.db.runtime import run_async_main, truncate_operational_tables
from app.db.seeds.auditors import seed_auditors
from app.db.seeds.check_kinds import seed_check_kinds
from app.db.seeds.departments import seed_departments
from app.db.seeds.effectiveness import seed_effectiveness_ratings
from app.db.session import AsyncSessionLocal
from app.models.checks import Check, CheckStatus
from app.models.recommendations import (
    Recommendation,
    RecommendationAdditionalStatus,
    RecommendationStatus,
)
from app.services.dictionary_integrity import sync_recommendation_audit_objects
from app.services.dictionary_validation import canonicalize_audit_objects

DEFAULT_COUNT = 100


def check_from_demo_row(row: dict) -> Check:
    return Check(
        serial_number=row["serial_number"],
        check_name=row["check_name"],
        short_name=row.get("short_name"),
        check_type=row["check_type"],
        check_view=row["check_view"],
        check_quarter=row["check_quarter"],
        start_date=row["start_date"],
        end_date=row.get("end_date"),
        check_leader=row["check_leader"],
        status=CheckStatus(row["status"]),
        created_at=row["created_at"],
        description=row.get("description"),
        order_document_number=row.get("order_document_number"),
        order_document_date=row.get("order_document_date"),
        program_document_number=row.get("program_document_number"),
        program_document_date=row.get("program_document_date"),
        az_document_number=row.get("az_document_number"),
        az_document_date=row.get("az_document_date"),
        dz_document_number=row.get("dz_document_number"),
        dz_document_date=row.get("dz_document_date"),
        process_effectiveness=row.get("process_effectiveness") or None,
        svk_effectiveness=row.get("svk_effectiveness") or None,
        sur_effectiveness=row.get("sur_effectiveness") or None,
        svik_effectiveness=row.get("svik_effectiveness") or None,
    )


def recommendation_from_demo_row(row: dict, *, check_id: int, audit_object: list[str]) -> Recommendation:
    return Recommendation(
        check_id=check_id,
        serial_number=row["serial_number"],
        sequence_number=row["sequence_number"],
        name=row["name"],
        observation_name=row.get("observation_name"),
        description=row["description"],
        indicator=row["indicator"],
        additional_indicator=row.get("additional_indicator") or "не указан",
        materiality_level=row["materiality_level"],
        audit_object=audit_object,
        deadline=row.get("deadline"),
        auditor=row["auditor"],
        manager=row["manager"],
        status=RecommendationStatus(row["status"]),
        additional_status=RecommendationAdditionalStatus(row["additional_status"]),
        created_at=row["created_at"],
        actual_completion_date=row.get("actual_completion_date"),
        extension_1_reason=row.get("extension_1_reason"),
        extension_1_date=row.get("extension_1_date"),
        extension_1_comment=row.get("extension_1_comment"),
        extension_2_reason=row.get("extension_2_reason"),
        extension_2_comment=row.get("extension_2_comment"),
        remove_from_control_reason=row.get("remove_from_control_reason"),
        remove_from_control_date=row.get("remove_from_control_date"),
        remove_from_control_comment=row.get("remove_from_control_comment"),
        deadline_extensions=row.get("deadline_extensions") or None,
        control_removals=row.get("control_removals") or None,
        closure_information=row.get("closure_information"),
    )


async def seed_demo_data(count: int = DEFAULT_COUNT, *, replace: bool = False) -> tuple[int, int]:
    if count < 1:
        raise ValueError("count must be >= 1")
    assert_seed_replace_safe_for_env(env=settings.sokol_env, replace=replace)

    check_rows = build_check_rows(count)
    recommendation_rows = build_recommendation_rows(check_rows, count)

    await init_db()
    await seed_auditors(AUDITORS)
    await seed_departments(DEPARTMENTS)
    await seed_check_kinds(CHECK_KINDS)
    await seed_effectiveness_ratings(EFFECTIVENESS_RATINGS)

    async with AsyncSessionLocal() as session:
        if replace:
            await truncate_operational_tables(session)

        serial_to_id: dict[str, int] = {}
        for row in check_rows:
            check = check_from_demo_row(row)
            session.add(check)
            await session.flush()
            serial_to_id[row["serial_number"]] = check.id

        for row in recommendation_rows:
            objects = await canonicalize_audit_objects(session, row["audit_object"])
            recommendation = recommendation_from_demo_row(
                row,
                check_id=serial_to_id[row["serial_number"]],
                audit_object=objects,
            )
            session.add(recommendation)
            await session.flush()
            await sync_recommendation_audit_objects(
                session,
                recommendation.id,
                recommendation.audit_object,
            )

        await session.commit()

    return len(check_rows), len(recommendation_rows)


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Insert synthetic demo rows. Opt-in wipe via --replace. Not used by Docker.",
    )
    parser.add_argument("--count", type=int, default=DEFAULT_COUNT)
    parser.add_argument(
        "--replace",
        action="store_true",
        help="TRUNCATE checks/recommendations/attachments before insert.",
    )
    args = parser.parse_args()
    checks_count, recommendations_count = await seed_demo_data(args.count, replace=args.replace)
    print(f"Seeded checks: {checks_count}")
    print(f"Seeded recommendations: {recommendations_count}")


if __name__ == "__main__":
    run_async_main(main)
