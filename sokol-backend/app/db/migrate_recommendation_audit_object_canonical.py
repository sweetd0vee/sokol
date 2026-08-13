"""Canonicalizes recommendation audit objects against departments dictionary."""

import asyncio

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.departments import Department
from app.models.recommendations import Recommendation
from app.services.analytics.common import parse_audit_object_parts
from app.utils.dictionary_text import dictionary_match_key

# python -m app.db.migrate_recommendation_audit_object_canonical


async def migrate() -> None:
    async with AsyncSessionLocal() as session:
        departments = list((await session.execute(select(Department.name))).scalars().all())
        lookup = {
            dictionary_match_key(name): name
            for name in departments
            if name and name.strip()
        }
        if not lookup:
            from app.db.department_names import DEPARTMENTS

            lookup = {dictionary_match_key(name): name for name in DEPARTMENTS}

        recommendations = list((await session.execute(select(Recommendation))).scalars().all())
        unmatched: set[str] = set()
        updated = 0

        for recommendation in recommendations:
            canonical: list[str] = []
            seen: set[str] = set()
            for part in parse_audit_object_parts(recommendation.audit_object):
                matched = lookup.get(dictionary_match_key(part))
                value = matched or part
                if matched is None and part != "Не указан":
                    unmatched.add(part)
                if value not in seen:
                    canonical.append(value)
                    seen.add(value)
            if not canonical:
                canonical = ["Не указан"]
            if canonical != recommendation.audit_object:
                recommendation.audit_object = canonical
                updated += 1

        await session.commit()
        print(f"Recommendation audit_object canonicalization completed. Updated: {updated}.")
        if unmatched:
            print("Unmatched values:")
            for value in sorted(unmatched, key=str.casefold):
                print(f"- {value}")


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
