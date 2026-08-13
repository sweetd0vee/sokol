import asyncio
import os
import re
import tempfile
from datetime import date
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db_session
from app.services.dictionary_validation import DictionaryRefError, canonicalize_audit_objects
from app.services.reports.memorandum import docx_generator as memorandum_generator
from app.services.reports.memorandum.parser import parse_az_for_memorandum
from app.services.reports.section_ii import docx_generator


router = APIRouter(prefix="/tools", tags=["tools"])
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
DOCX_EXT = ".docx"
ALLOWED_MIME = {DOCX_MIME, "application/octet-stream"}
MAX_UPLOAD_MB = float(settings.sokol_max_upload_mb)


def _cleanup_files(*paths: str) -> None:
    for path in paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
        except OSError:
            pass


def _attachment_header(filename: str) -> str:
    ascii_fallback = "".join(char if ord(char) < 128 else "_" for char in filename)
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename)}"


def _validate_docx_upload(file: UploadFile) -> None:
    filename = file.filename or ""
    if not filename.lower().endswith(DOCX_EXT):
        raise HTTPException(status_code=400, detail="Файл должен быть в формате .docx.")
    if file.content_type and file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Неверный MIME-тип файла.")


async def _read_upload(file: UploadFile) -> bytes:
    try:
        content = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Не удалось прочитать файл: {exc}") from exc
    max_bytes = int(MAX_UPLOAD_MB * 1024 * 1024)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Файл слишком большой. Лимит {MAX_UPLOAD_MB} MB.",
        )
    return content


def _write_temp_docx(content: bytes) -> Path:
    with tempfile.NamedTemporaryFile(delete=False, suffix=DOCX_EXT) as tmp_input:
        tmp_input.write(content)
        return Path(tmp_input.name)


def _build_section_ii_output_path(input_path: Path) -> Path:
    return input_path.with_suffix("").with_name(f"{input_path.stem}_section_ii{DOCX_EXT}")


def _build_memorandum_output_path(input_path: Path) -> Path:
    return input_path.with_suffix("").with_name(f"{input_path.stem}_dz{DOCX_EXT}")


def _generate_memorandum_file(input_path: str, output_path: str) -> tuple[str | None, str | None]:
    source, parse_error = parse_az_for_memorandum(input_path)
    if parse_error:
        return None, parse_error
    result_path, error = memorandum_generator.generate_memorandum(source, output_path)
    if error:
        return None, error
    return result_path, None


class ParsedRecommendationItem(BaseModel):
    name: str
    observation_name: str = ""
    audit_object: list[str]
    manager: str
    deadline: str


def _deadline_to_iso(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", (value or "").strip())
    match = re.match(r"^(\d{1,2})\.(\d{2})\.(\d{4})$", cleaned)
    if not match:
        return ""
    day, month, year = match.groups()
    try:
        date(int(year), int(month), int(day))
    except ValueError:
        return ""
    return f"{year}-{month}-{day.zfill(2)}"


def _parse_recommendations_from_docx(input_path: str) -> tuple[list[ParsedRecommendationItem], str | None]:
    source, error = parse_az_for_memorandum(input_path)
    if error:
        return [], error
    if source is None:
        return [], "Не удалось разобрать рекомендации из аудиторского заключения."

    items: list[ParsedRecommendationItem] = []
    for group in source.groups:
        for recommendation in group.recommendations:
            name = " ".join(recommendation.paragraphs).strip()
            if not name and recommendation.deadline:
                name = "Рекомендация"
            if not name:
                continue
            items.append(
                ParsedRecommendationItem(
                    name=name,
                    observation_name=(recommendation.observation_name or "").strip(),
                    audit_object=[((group.name or "").strip() or "Не указан")[:255]],
                    manager=((group.manager or "").strip() or "Не указан")[:255],
                    deadline=_deadline_to_iso(recommendation.deadline),
                )
            )

    if not items:
        return [], "В аудиторском заключении не найдены рекомендации для импорта."
    return items, None


async def _read_result_docx(
    background_tasks: BackgroundTasks,
    input_path: Path,
    output_path: Path,
) -> bytes:
    try:
        return await asyncio.to_thread(output_path.read_bytes)
    finally:
        background_tasks.add_task(_cleanup_files, str(input_path), str(output_path))


async def _generate_section_ii_response(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    *,
    with_hyperlinks: bool,
) -> Response:
    _validate_docx_upload(file)
    original_name = (file.filename or "").strip()
    original_stem = Path(original_name).stem if original_name else ""
    suffix = "_section_ii_links" if with_hyperlinks else "_section_ii"
    download_name = f"{original_stem}{suffix}{DOCX_EXT}" if original_stem else f"{suffix.lstrip('_')}{DOCX_EXT}"
    content = await _read_upload(file)
    input_path = _write_temp_docx(content)
    output_path = _build_section_ii_output_path(input_path)

    result_path, _observations, error = await asyncio.to_thread(
        docx_generator.process_document,
        str(input_path),
        str(output_path),
        with_hyperlinks,
    )
    if error:
        background_tasks.add_task(_cleanup_files, str(input_path), str(output_path))
        raise HTTPException(status_code=400, detail=error)
    if not result_path or not output_path.is_file():
        background_tasks.add_task(_cleanup_files, str(input_path), str(output_path))
        raise HTTPException(status_code=500, detail="Файл результата не создан.")

    result_bytes = await _read_result_docx(background_tasks, input_path, output_path)
    return Response(
        content=result_bytes,
        media_type=DOCX_MIME,
        headers={"Content-Disposition": _attachment_header(download_name)},
    )


@router.post("/section-ii")
async def generate_section_ii(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    return await _generate_section_ii_response(
        background_tasks,
        file,
        with_hyperlinks=False,
    )


@router.post("/section-ii-links")
async def generate_section_ii_with_links(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    return await _generate_section_ii_response(
        background_tasks,
        file,
        with_hyperlinks=True,
    )


@router.post("/memorandum")
async def generate_memorandum(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    _validate_docx_upload(file)
    original_name = (file.filename or "").strip()
    original_stem = Path(original_name).stem if original_name else ""
    download_name = f"{original_stem}_dz{DOCX_EXT}" if original_stem else "dz.docx"
    content = await _read_upload(file)
    input_path = _write_temp_docx(content)
    output_path = _build_memorandum_output_path(input_path)

    result_path, error = await asyncio.to_thread(
        _generate_memorandum_file,
        str(input_path),
        str(output_path),
    )
    if error:
        background_tasks.add_task(_cleanup_files, str(input_path), str(output_path))
        raise HTTPException(status_code=400, detail=error)
    if not result_path or not output_path.is_file():
        background_tasks.add_task(_cleanup_files, str(input_path), str(output_path))
        raise HTTPException(status_code=500, detail="Файл докладной записки не создан.")

    result_bytes = await _read_result_docx(background_tasks, input_path, output_path)
    return Response(
        content=result_bytes,
        media_type=DOCX_MIME,
        headers={"Content-Disposition": _attachment_header(download_name)},
    )


@router.post("/parse-recommendations", response_model=list[ParsedRecommendationItem])
async def parse_recommendations_from_docx(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
):
    _validate_docx_upload(file)
    content = await _read_upload(file)
    input_path = _write_temp_docx(content)
    background_tasks.add_task(_cleanup_files, str(input_path))

    items, error = await asyncio.to_thread(_parse_recommendations_from_docx, str(input_path))
    if error:
        raise HTTPException(status_code=400, detail=error)
    try:
        for item in items:
            item.audit_object = await canonicalize_audit_objects(session, item.audit_object)
    except DictionaryRefError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return items
