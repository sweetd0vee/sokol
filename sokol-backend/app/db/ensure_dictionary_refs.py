"""Insert missing dictionary rows so domain FKs can be applied."""

from __future__ import annotations

import string
from collections.abc import Callable, Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.crud.dictionary_crud import find_dictionary_duplicate_by_label
from app.models.auditors import Auditor
from app.models.check_kinds import CheckKind
from app.models.departments import Department
from app.models.effectiveness_ratings import EffectivenessRating
from app.services.dictionary_integrity import ensure_unspecified_department
from app.utils.check_key import get_leader_initials_code
from app.utils.dictionary_text import normalize_dictionary_label


def allocate_auditor_code(full_name: str, used: set[str]) -> str:
    initials = "".join(
        ch
        for ch in get_leader_initials_code(full_name).upper()
        if ch.isascii() and ch.isalpha()
    )
    if len(initials) >= 3:
        candidate = initials[:3]
        if candidate not in used:
            return candidate
    padded = (initials + "XXX")[:3]
    if len(padded) == 3 and padded.isalpha() and padded not in used:
        return padded
    for first in string.ascii_uppercase:
        for second in string.ascii_uppercase:
            for third in string.ascii_uppercase:
                code = f"{first}{second}{third}"
                if code not in used:
                    return code
    raise RuntimeError("No free auditor codes left.")


async def _ensure_normalized_rows(
    session: AsyncSession,
    *,
    model: type[DeclarativeBase],
    column,
    values: Iterable[str],
    make_row: Callable[[str], object],
) -> int:
    inserted = 0
    for raw in values:
        label = normalize_dictionary_label(str(raw or "").strip())
        if not label:
            continue
        existing = await find_dictionary_duplicate_by_label(session, model, column, label)
        if existing is not None:
            continue
        session.add(make_row(label))
        inserted += 1
        await session.flush()
    return inserted


async def _list_missing_normalized_labels(
    session: AsyncSession,
    *,
    model: type[DeclarativeBase],
    column,
    values: Iterable[str],
) -> list[str]:
    missing: list[str] = []
    seen: set[str] = set()
    for raw in values:
        label = normalize_dictionary_label(str(raw or "").strip())
        if not label or label in seen:
            continue
        seen.add(label)
        existing = await find_dictionary_duplicate_by_label(session, model, column, label)
        if existing is None:
            missing.append(label)
    return missing


async def find_missing_department_names(session: AsyncSession, names: Iterable[str]) -> list[str]:
    await ensure_unspecified_department(session)
    return await _list_missing_normalized_labels(
        session,
        model=Department,
        column=Department.name,
        values=names,
    )


async def find_missing_check_kind_labels(session: AsyncSession, labels: Iterable[str]) -> list[str]:
    return await _list_missing_normalized_labels(
        session,
        model=CheckKind,
        column=CheckKind.label,
        values=labels,
    )


async def find_missing_effectiveness_labels(session: AsyncSession, labels: Iterable[str]) -> list[str]:
    return await _list_missing_normalized_labels(
        session,
        model=EffectivenessRating,
        column=EffectivenessRating.label,
        values=labels,
    )


async def find_missing_auditor_names(session: AsyncSession, names: Iterable[str]) -> list[str]:
    return await _list_missing_normalized_labels(
        session,
        model=Auditor,
        column=Auditor.full_name,
        values=names,
    )


async def ensure_department_names(session: AsyncSession, names: Iterable[str]) -> int:
    await ensure_unspecified_department(session)
    return await _ensure_normalized_rows(
        session,
        model=Department,
        column=Department.name,
        values=names,
        make_row=lambda name: Department(name=name),
    )


async def ensure_check_kind_labels(session: AsyncSession, labels: Iterable[str]) -> int:
    return await _ensure_normalized_rows(
        session,
        model=CheckKind,
        column=CheckKind.label,
        values=labels,
        make_row=lambda label: CheckKind(label=label),
    )


async def ensure_effectiveness_labels(session: AsyncSession, labels: Iterable[str]) -> int:
    return await _ensure_normalized_rows(
        session,
        model=EffectivenessRating,
        column=EffectivenessRating.label,
        values=labels,
        make_row=lambda label: EffectivenessRating(label=label),
    )


async def ensure_auditor_names(session: AsyncSession, names: Iterable[str]) -> int:
    inserted = 0
    used_codes = {
        str(code).upper()
        for code in (await session.execute(select(Auditor.code))).scalars().all()
        if code
    }
    for raw in names:
        full_name = normalize_dictionary_label(str(raw or "").strip())
        if not full_name:
            continue
        existing = await find_dictionary_duplicate_by_label(
            session, Auditor, Auditor.full_name, full_name
        )
        if existing is not None:
            continue
        code = allocate_auditor_code(full_name, used_codes)
        used_codes.add(code)
        session.add(Auditor(full_name=full_name, code=code))
        inserted += 1
        await session.flush()
    return inserted
