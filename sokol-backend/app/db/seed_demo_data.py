# -*- coding: utf-8 -*-
"""Пересоздание демо-данных: 100 проверок и 100 рекомендаций (id = 1..N)."""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.db.demo_data import build_check_rows, build_recommendation_rows
from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal
from app.models.checks import Check, CheckStatus
from app.models.recommendations import (
    Recommendation,
    RecommendationAdditionalStatus,
    RecommendationStatus,
)

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.seed_demo_data

DEMO_COUNT = 100


async def seed_demo_data(count: int = DEMO_COUNT, *, replace: bool = True) -> tuple[int, int]:
    checks = build_check_rows(count)
    recommendations = build_recommendation_rows(checks, count)

    await init_db()

    async with AsyncSessionLocal() as session:
        if replace:
            await session.execute(text("TRUNCATE TABLE recommendations, checks RESTART IDENTITY CASCADE"))
            await session.commit()

        serial_to_id: dict[str, int] = {}
        for index, row in enumerate(checks, start=1):
            check = Check(
                id=index,
                serial_number=row["serial_number"],
                check_name=row["check_name"],
                check_type=row["check_type"],
                check_view=row["check_view"],
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
                process_effectiveness=row.get("process_effectiveness"),
                svk_effectiveness=row.get("svk_effectiveness"),
                sur_effectiveness=row.get("sur_effectiveness"),
                svik_effectiveness=row.get("svik_effectiveness"),
            )
            session.add(check)
            serial_to_id[row["serial_number"]] = index

        await session.flush()

        for index, row in enumerate(recommendations, start=1):
            serial = row["serial_number"]
            session.add(
                Recommendation(
                    id=index,
                    check_id=serial_to_id[serial],
                    serial_number=serial,
                    sequence_number=row["sequence_number"],
                    name=row["name"],
                    description=row["description"],
                    indicator=row["indicator"],
                    materiality_level=row["materiality_level"],
                    audit_object=row["audit_object"],
                    deadline=row.get("deadline"),
                    auditor=row["auditor"],
                    manager=row["manager"],
                    status=RecommendationStatus(row["status"]),
                    additional_status=RecommendationAdditionalStatus(row["additional_status"]),
                    created_at=row["created_at"],
                    actual_completion_date=row.get("actual_completion_date"),
                    closure_information=row.get("closure_information"),
                )
            )

        await session.commit()

        # Явные id не двигают sequence — выравниваем после вставки.
        await session.execute(
            text(
                "SELECT setval(pg_get_serial_sequence('checks', 'id'), "
                "(SELECT COALESCE(MAX(id), 1) FROM checks))"
            )
        )
        await session.execute(
            text(
                "SELECT setval(pg_get_serial_sequence('recommendations', 'id'), "
                "(SELECT COALESCE(MAX(id), 1) FROM recommendations))"
            )
        )
        await session.commit()

    return len(checks), len(recommendations)


async def main() -> None:
    checks_count, recommendations_count = await seed_demo_data()
    print(f"Seeded checks: {checks_count}")
    print(f"Seeded recommendations: {recommendations_count}")


if __name__ == "__main__":
    asyncio.run(main())
