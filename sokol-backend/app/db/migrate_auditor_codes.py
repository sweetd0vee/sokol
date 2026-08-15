"""Adds persistent auditor codes used in check serial numbers."""

import asyncio

from sqlalchemy import text

from app.db.auditor_names import AUDITOR_CODES
from app.db.session import engine
from app.utils.check_key import get_leader_initials_code
from app.utils.dictionary_text import normalize_dictionary_label

# python -m app.db.migrate_auditor_codes


async def migrate() -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text("ALTER TABLE auditors ADD COLUMN IF NOT EXISTS code VARCHAR(3)")
        )
        rows = (
            await conn.execute(text("SELECT id, full_name, code FROM auditors ORDER BY full_name"))
        ).all()

        canonical_codes = {
            normalize_dictionary_label(name): code
            for name, code in AUDITOR_CODES.items()
        }
        used_codes: set[str] = set()
        for row in rows:
            normalized_name = normalize_dictionary_label(row.full_name)
            code = canonical_codes.get(normalized_name)
            if code is None:
                code = (row.code or "").strip().upper()
            if not code:
                code = get_leader_initials_code(row.full_name)
            if (
                len(code) != 3
                or not code.isascii()
                or not code.isalpha()
            ):
                raise RuntimeError(
                    f"Auditor code must contain exactly 3 Latin letters "
                    f"for {row.full_name!r}: {code!r}"
                )
            if code in used_codes:
                raise RuntimeError(f"Duplicate auditor code during migration: {code}")
            used_codes.add(code)
            await conn.execute(
                text("UPDATE auditors SET code = :code WHERE id = :id"),
                {"code": code, "id": row.id},
            )

        await conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_auditors_code "
                "ON auditors (code)"
            )
        )
        await conn.execute(
            text("ALTER TABLE auditors ALTER COLUMN code TYPE VARCHAR(3)")
        )
        await conn.execute(text("ALTER TABLE auditors ALTER COLUMN code SET NOT NULL"))

    print("Auditor code migration completed.")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
