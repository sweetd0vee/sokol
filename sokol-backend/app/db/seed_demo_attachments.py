# -*- coding: utf-8 -*-
"""Демо-вложения: одна проверка + одна её рекомендация, все слоты, через тот же upload, что UI."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.current_user import CurrentUser
from app.core.config import settings
from app.core.roles import Role
from app.db.catalogs.users import ADMIN_USERNAME
from app.db.runtime import run_async_main
from app.db.session import AsyncSessionLocal
from app.models.checks import Check
from app.models.recommendations import Recommendation
from app.schemas.attachments import CHECK_ATTACHMENT_SLOTS, RECOMMENDATION_ATTACHMENT_SLOTS
from app.services import attachments_service
from app.services.storage.minio_storage import get_storage

# python -m app.db.seed_demo_attachments
# python -m app.db.seed_demo_attachments --check-id 1 --replace

_PNG_1X1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)


def _minimal_pdf(label: str) -> bytes:
    safe = "".join(ch if ch.isascii() and ch not in "()\\" else "_" for ch in label)
    stream = f"BT /F1 12 Tf 72 720 Td ({safe}) Tj ET".encode("ascii")
    objects = [
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
        (
            b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n"
        ),
        b"4 0 obj << /Length " + str(len(stream)).encode("ascii") + b" >> stream\n" + stream + b"\nendstream endobj\n",
        b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    ]
    xref_offset = 9 + sum(len(obj) for obj in objects)
    xref = b"xref\n0 6\n0000000000 65535 f \n"
    offset = 9
    for obj in objects:
        xref += f"{offset:010d} 00000 n \n".encode("ascii")
        offset += len(obj)
    return (
        b"%PDF-1.4\n"
        + b"".join(objects)
        + xref
        + b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n"
        + str(xref_offset).encode("ascii")
        + b"\n%%EOF\n"
    )


@dataclass(frozen=True)
class DemoFileSpec:
    slot: str
    original_name: str
    content_type: str
    payload: bytes


DEMO_CHECK_FILES: tuple[DemoFileSpec, ...] = (
    DemoFileSpec("order", "Приказ_о_проведении_проверки.pdf", "application/pdf", _minimal_pdf("Prikaz")),
    DemoFileSpec("program", "Программа_проверки.pdf", "application/pdf", _minimal_pdf("Programma")),
    DemoFileSpec("az", "Акт_завершения.pdf", "application/pdf", _minimal_pdf("AZ")),
    DemoFileSpec("dz", "Докладная_записка.pdf", "application/pdf", _minimal_pdf("DZ")),
    DemoFileSpec("dz_appendix", "Приложение_к_докладной.pdf", "application/pdf", _minimal_pdf("DZ appendix")),
)

DEMO_RECOMMENDATION_FILES: tuple[DemoFileSpec, ...] = (
    DemoFileSpec(
        "recommendation_files",
        "Скриншоты_доработок.png",
        "image/png",
        _PNG_1X1,
    ),
    DemoFileSpec(
        "recommendation_files",
        "Протокол_приемки.pdf",
        "application/pdf",
        _minimal_pdf("Protokol priemki"),
    ),
    DemoFileSpec(
        "control_removal_files",
        "Подтверждение_снятия_с_контроля.pdf",
        "application/pdf",
        _minimal_pdf("Snyatie s kontrolya"),
    ),
)


def demo_check_slots() -> frozenset[str]:
    return frozenset(spec.slot for spec in DEMO_CHECK_FILES)


def demo_recommendation_slots() -> frozenset[str]:
    return frozenset(spec.slot for spec in DEMO_RECOMMENDATION_FILES)


def _admin_user() -> CurrentUser:
    return CurrentUser(username=ADMIN_USERNAME, display_name="Администратор", role=Role.ADMIN)


def _require_minio() -> None:
    if not settings.minio_enabled:
        raise RuntimeError(
            "MinIO выключен: задайте SOKOL_MINIO_ENDPOINT, SOKOL_MINIO_ACCESS_KEY и "
            "SOKOL_MINIO_SECRET_KEY (для uvicorn на хосте endpoint=127.0.0.1:9000)."
        )


async def _pick_check(session, check_id: int | None) -> Check:
    query = select(Check).options(selectinload(Check.recommendations)).order_by(Check.id.asc())
    if check_id is not None:
        query = query.where(Check.id == check_id)
    result = await session.execute(query)
    checks = list(result.scalars().unique())
    if check_id is not None:
        if not checks:
            raise RuntimeError(f"Проверка id={check_id} не найдена.")
        check = checks[0]
        if not check.recommendations:
            raise RuntimeError(
                f"У проверки id={check.id} нет рекомендаций — некуда класть слоты контрольной зоны."
            )
        return check
    for check in checks:
        if check.recommendations:
            return check
    raise RuntimeError("В базе нет проверки с рекомендацией. Сначала загрузите demo checks/recommendations.")


def _fill_check_documents(check: Check) -> bool:
    changed = False
    defaults = {
        "order_document_number": "ПР-0001",
        "order_document_date": date(2026, 7, 10),
        "program_document_number": "ПГ-0025",
        "program_document_date": date(2026, 7, 27),
        "az_document_number": "АЗ-0001",
        "az_document_date": date(2026, 8, 15),
        "dz_document_number": "ДЗ-0001",
        "dz_document_date": date(2026, 8, 20),
    }
    for field, value in defaults.items():
        if getattr(check, field) in (None, ""):
            setattr(check, field, value)
            changed = True
    return changed


def _fill_recommendation_closure(recommendation: Recommendation) -> bool:
    changed = False
    if recommendation.actual_completion_date is None:
        recommendation.actual_completion_date = date(2026, 1, 2)
        changed = True
    if not (recommendation.closure_information or "").strip():
        recommendation.closure_information = (
            "Представлены скриншоты доработок ИТ-системы и протокол приёмки. "
            "Рекомендация исполнена, качество внедрения подтверждено владельцем процесса."
        )
        changed = True
    if not recommendation.control_removals:
        recommendation.control_removals = [
            {
                "date": "2026-01-09",
                "comment": (
                    "Контроль прекращён после подтверждения исполнения "
                    "и включения мероприятия в регулярную отчётность подразделения."
                ),
            }
        ]
        changed = True
    if not recommendation.deadline_extensions:
        recommendation.deadline_extensions = [
            {
                "date": "2026-02-15",
                "comment": "Срок перенесён: требуется дополнительная проверка внедрения.",
            }
        ]
        changed = True
    return changed


async def _upload_specs(
    session,
    *,
    entity_type: str,
    entity_id: int,
    specs: tuple[DemoFileSpec, ...],
    user: CurrentUser,
    replace: bool,
) -> tuple[int, int]:
    uploaded = 0
    skipped = 0
    existing = await attachments_service.list_attachments(
        session,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    existing_names = {item.original_name for item in existing.items}

    if replace and existing.items:
        await attachments_service.delete_attachments_for_entity(
            session,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        await session.commit()
        existing_names = set()

    for spec in specs:
        if spec.original_name in existing_names:
            skipped += 1
            continue
        await attachments_service.upload_attachment(
            session,
            entity_type=entity_type,
            entity_id=entity_id,
            slot=spec.slot,
            original_name=spec.original_name,
            content_type=spec.content_type,
            payload=spec.payload,
            user=user,
        )
        existing_names.add(spec.original_name)
        uploaded += 1
    return uploaded, skipped


async def seed_demo_attachments(*, check_id: int | None = None, replace: bool = False) -> dict[str, object]:
    _require_minio()
    storage = get_storage()
    if storage is None or not await storage.ping():
        raise RuntimeError("MinIO недоступен. Проверьте контейнер minio и SOKOL_MINIO_ENDPOINT.")

    user = _admin_user()
    async with AsyncSessionLocal() as session:
        check = await _pick_check(session, check_id)
        recommendation = sorted(check.recommendations, key=lambda row: row.id)[0]

        if _fill_check_documents(check) or _fill_recommendation_closure(recommendation):
            session.add(check)
            session.add(recommendation)
            await session.commit()
            await session.refresh(check)
            await session.refresh(recommendation)

        check_uploaded, check_skipped = await _upload_specs(
            session,
            entity_type="check",
            entity_id=check.id,
            specs=DEMO_CHECK_FILES,
            user=user,
            replace=replace,
        )
        rec_uploaded, rec_skipped = await _upload_specs(
            session,
            entity_type="recommendation",
            entity_id=recommendation.id,
            specs=DEMO_RECOMMENDATION_FILES,
            user=user,
            replace=replace,
        )

        check_listed = await attachments_service.list_attachments(
            session,
            entity_type="check",
            entity_id=check.id,
        )
        rec_listed = await attachments_service.list_attachments(
            session,
            entity_type="recommendation",
            entity_id=recommendation.id,
        )

    check_slots = {item.slot for item in check_listed.items}
    rec_slots = {item.slot for item in rec_listed.items}
    missing_check = sorted(CHECK_ATTACHMENT_SLOTS - check_slots)
    missing_rec = sorted(RECOMMENDATION_ATTACHMENT_SLOTS - rec_slots)
    if missing_check or missing_rec:
        raise RuntimeError(f"После seed не хватает слотов: check={missing_check} recommendation={missing_rec}")

    return {
        "check_id": check.id,
        "check_serial": check.serial_number,
        "recommendation_id": recommendation.id,
        "check_files": check_listed.total,
        "recommendation_files": rec_listed.total,
        "uploaded": check_uploaded + rec_uploaded,
        "skipped": check_skipped + rec_skipped,
        "check_slots": sorted(check_slots),
        "recommendation_slots": sorted(rec_slots),
    }


async def main() -> None:
    parser = argparse.ArgumentParser(description="Залить демо-вложения во все слоты одной проверки.")
    parser.add_argument("--check-id", type=int, default=None)
    parser.add_argument("--replace", action="store_true", help="Перезалить файлы, если слоты уже заняты.")
    args = parser.parse_args()
    summary = await seed_demo_attachments(check_id=args.check_id, replace=args.replace)
    print(
        "Seeded attachments for check {check_id} ({check_serial}), "
        "recommendation {recommendation_id}: "
        "uploaded={uploaded}, skipped={skipped}, "
        "check_files={check_files}, recommendation_files={recommendation_files}".format(**summary)
    )
    print(f"UI check: http://localhost:5180/checks/{summary['check_id']}/edit")
    print(f"UI recommendation: http://localhost:5180/recommendations/{summary['recommendation_id']}/edit")


if __name__ == "__main__":
    run_async_main(main)
