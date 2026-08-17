import asyncio
import argparse
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook
from sqlalchemy import select, text

from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal
from app.models.checks import Check, CheckStatus
from app.models.recommendations import Recommendation, RecommendationAdditionalStatus, RecommendationStatus
from app.services.dictionary_validation import canonicalize_audit_objects

# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db python -m app.db.import_seed_data --replace

from app.utils.paths import get_repo_data_dir

DATA_DIR = get_repo_data_dir()


def _parse_date(value) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def _optional_str(value) -> str | None:
    if value is None or value == "":
        return None
    return str(value).strip()


def _read_rows(path: Path, sheet_name: str) -> list[dict]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    sheet = workbook[sheet_name]
    rows = list(sheet.iter_rows(values_only=True))
    workbook.close()
    if not rows:
        return []
    headers = [str(item).strip() for item in rows[0]]
    result: list[dict] = []
    for row in rows[1:]:
        if not any(row):
            continue
        result.append({headers[index]: row[index] for index in range(len(headers))})
    return result


async def import_seed_data(
    *,
    replace: bool = False,
    checks_path: Path | None = None,
    recommendations_path: Path | None = None,
) -> None:
    checks_path = checks_path or (DATA_DIR / "checks.xlsx")
    recommendations_path = recommendations_path or (DATA_DIR / "recommendations.xlsx")
    if not checks_path.is_file():
        raise FileNotFoundError(f"Не найден файл {checks_path}")
    if not recommendations_path.is_file():
        raise FileNotFoundError(f"Не найден файл {recommendations_path}")

    check_rows = _read_rows(checks_path, "checks")
    recommendation_rows = _read_rows(recommendations_path, "recommendations")

    await init_db()

    async with AsyncSessionLocal() as session:
        if replace:
            await session.execute(text("TRUNCATE TABLE recommendations, checks RESTART IDENTITY CASCADE"))
            await session.commit()

        existing_checks = await session.execute(select(Check.serial_number))
        existing_serials = {row[0] for row in existing_checks.all()}

        serial_to_id: dict[str, int] = {}
        inserted_checks = 0
        for row in check_rows:
            serial = str(row["serial_number"]).strip()
            if serial in existing_serials:
                result = await session.execute(select(Check).where(Check.serial_number == serial))
                check = result.scalar_one()
                serial_to_id[serial] = check.id
                continue

            start_date = _parse_date(row["start_date"])
            if start_date is None:
                raise ValueError("start_date обязателен для каждой проверки.")
            check_quarter = int(
                row.get("check_quarter") or ((start_date.month - 1) // 3 + 1)
            )
            if check_quarter not in {1, 2, 3, 4}:
                raise ValueError("check_quarter должен быть числом от 1 до 4.")

            check_kwargs = {
                "serial_number": serial,
                "check_name": str(row["check_name"]).strip(),
                "check_type": str(row["check_type"]).strip(),
                "check_view": str(row["check_view"]).strip(),
                "check_quarter": check_quarter,
                "start_date": start_date,
                "end_date": _parse_date(row.get("end_date")),
                "check_leader": str(row["check_leader"]).strip(),
                "status": CheckStatus(str(row["status"]).strip()),
                "created_at": _parse_date(row.get("created_at")) or date.today(),
                "description": _optional_str(row.get("description")),
            }
            optional_check_fields = {
                "short_name": _optional_str(row.get("short_name")),
                "order_document_number": _optional_str(row.get("order_document_number")),
                "order_document_date": _parse_date(row.get("order_document_date")),
                "program_document_number": _optional_str(row.get("program_document_number")),
                "program_document_date": _parse_date(row.get("program_document_date")),
                "az_document_number": _optional_str(row.get("az_document_number")),
                "az_document_date": _parse_date(row.get("az_document_date")),
                "dz_document_number": _optional_str(row.get("dz_document_number")),
                "dz_document_date": _parse_date(row.get("dz_document_date")),
                "process_effectiveness": _optional_str(row.get("process_effectiveness")),
                "svk_effectiveness": _optional_str(row.get("svk_effectiveness")),
                "sur_effectiveness": _optional_str(row.get("sur_effectiveness")),
                "svik_effectiveness": _optional_str(row.get("svik_effectiveness")),
            }
            check_kwargs.update(
                {
                    field: value
                    for field, value in optional_check_fields.items()
                    if hasattr(Check, field)
                }
            )
            check = Check(**check_kwargs)
            session.add(check)
            await session.flush()
            serial_to_id[serial] = check.id
            inserted_checks += 1

        await session.commit()

        existing_recs = await session.execute(select(Recommendation.id))
        if existing_recs.first():
            print("Recommendations table is not empty — skip recommendations import.")
            print(f"Inserted checks: {inserted_checks}")
            return

        inserted_recommendations = 0
        for row in recommendation_rows:
            serial = str(row["serial_number"]).strip()
            check_id = serial_to_id.get(serial)
            if check_id is None:
                result = await session.execute(select(Check).where(Check.serial_number == serial))
                check = result.scalar_one_or_none()
                if not check:
                    raise ValueError(f"Проверка с ключом {serial} не найдена для рекомендации.")
                check_id = check.id
                serial_to_id[serial] = check_id

            recommendation_kwargs = {
                "check_id": check_id,
                "serial_number": serial,
                "sequence_number": int(row.get("sequence_number") or 1),
                "name": str(row["name"]).strip(),
                "observation_name": _optional_str(row.get("observation_name")),
                "description": str(row.get("description") or row["name"]).strip(),
                "indicator": str(row.get("indicator") or "не указан").strip(),
                "materiality_level": str(row.get("materiality_level") or "средний").strip(),
                "audit_object": await canonicalize_audit_objects(session, row["audit_object"]),
                "deadline": _parse_date(row.get("deadline")),
                "auditor": str(row["auditor"]).strip(),
                "manager": str(row["manager"]).strip(),
                "status": RecommendationStatus(str(row["status"]).strip()),
                "additional_status": RecommendationAdditionalStatus(str(row["additional_status"]).strip()),
                "created_at": _parse_date(row.get("created_at")) or date.today(),
            }
            optional_recommendation_fields = {
                "actual_completion_date": _parse_date(row.get("actual_completion_date")),
                "extension_1_reason": _optional_str(row.get("extension_1_reason")),
                "extension_1_date": _parse_date(row.get("extension_1_date")),
                "extension_1_comment": _optional_str(row.get("extension_1_comment")),
                "extension_2_reason": _optional_str(row.get("extension_2_reason")),
                "extension_2_comment": _optional_str(row.get("extension_2_comment")),
                "remove_from_control_reason": _optional_str(row.get("remove_from_control_reason")),
                "remove_from_control_date": _parse_date(row.get("remove_from_control_date")),
                "remove_from_control_comment": _optional_str(row.get("remove_from_control_comment")),
                "closure_verification_status": _optional_str(row.get("closure_verification_status")),
                "closure_information": _optional_str(row.get("closure_information")),
            }
            recommendation_kwargs.update(
                {
                    field: value
                    for field, value in optional_recommendation_fields.items()
                    if hasattr(Recommendation, field)
                }
            )
            recommendation = Recommendation(**recommendation_kwargs)
            session.add(recommendation)
            inserted_recommendations += 1

        await session.commit()
        print(f"Inserted checks: {inserted_checks}")
        print(f"Inserted recommendations: {inserted_recommendations}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import seed XLSX files into SOKOL database.")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Очистить recommendations и checks перед импортом XLSX.",
    )
    parser.add_argument(
        "--checks",
        type=Path,
        default=None,
        help="Путь к XLSX проверок (лист checks). По умолчанию data/checks.xlsx.",
    )
    parser.add_argument(
        "--recommendations",
        type=Path,
        default=None,
        help="Путь к XLSX рекомендаций (лист recommendations). По умолчанию data/recommendations.xlsx.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asyncio.run(
        import_seed_data(
            replace=args.replace,
            checks_path=args.checks,
            recommendations_path=args.recommendations,
        )
    )


if __name__ == "__main__":
    main()
