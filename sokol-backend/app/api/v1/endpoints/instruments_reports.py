import asyncio
import os
import re
import tempfile
from datetime import date
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db_session
from app.services.dictionary_validation import DictionaryRefError, canonicalize_audit_objects
from app.services.reports.control_file.generator import (
    TEMPLATE_PATH as CONTROL_FILE_TEMPLATE_PATH,
    generate_control_file_template,
)
from app.services.reports.memorandum.models import MemorandumAuditObject, MemorandumSource
from app.services.reports.memorandum import docx_generator as memorandum_generator
from app.services.reports.memorandum.parser import parse_az_for_memorandum
from app.services.reports.section_ii import docx_generator


router = APIRouter(prefix="/tools", tags=["tools"])
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
DOCX_EXT = ".docx"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
XLSX_EXT = ".xlsx"
UPLOAD_CHUNK_SIZE = 256 * 1024


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


async def _save_upload_to_temp(file: UploadFile) -> Path:
    """Stream the upload to disk so large .docx files do not sit in worker RAM twice."""
    max_bytes = settings.max_upload_bytes
    tmp_path: Path | None = None
    written = 0
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=DOCX_EXT) as tmp:
            tmp_path = Path(tmp.name)
            while True:
                try:
                    chunk = await file.read(UPLOAD_CHUNK_SIZE)
                except Exception as exc:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Не удалось прочитать файл: {exc}",
                    ) from exc
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Файл слишком большой. Лимит {settings.sokol_max_upload_mb} MB.",
                    )
                tmp.write(chunk)
        return tmp_path
    except Exception:
        if tmp_path is not None:
            _cleanup_files(str(tmp_path))
        raise


def _stream_result_file(
    background_tasks: BackgroundTasks,
    input_path: Path,
    output_path: Path,
    *,
    media_type: str,
    download_name: str,
) -> FileResponse:
    background_tasks.add_task(_cleanup_files, str(input_path), str(output_path))
    return FileResponse(
        path=output_path,
        media_type=media_type,
        headers={"Content-Disposition": _attachment_header(download_name)},
    )


def _build_section_ii_output_path(input_path: Path) -> Path:
    return input_path.with_suffix("").with_name(f"{input_path.stem}_section_ii{DOCX_EXT}")


def _build_memorandum_output_path(input_path: Path) -> Path:
    return input_path.with_suffix("").with_name(f"{input_path.stem}_dz{DOCX_EXT}")


def _build_control_file_output_path(input_path: Path) -> Path:
    return input_path.with_suffix("").with_name(f"{input_path.stem}_control{XLSX_EXT}")


async def _canonicalize_memorandum_source(
    session: AsyncSession,
    source: MemorandumSource,
) -> MemorandumSource:
    groups: list[MemorandumAuditObject] = []
    group_index: dict[tuple[str, str], int] = {}

    for group in source.groups:
        canonical_names = await canonicalize_audit_objects(session, group.name)
        canonical_name = "; ".join(sorted(canonical_names, key=str.casefold))
        manager = group.manager.strip()
        key = (canonical_name.casefold(), manager.casefold())
        if key not in group_index:
            group_index[key] = len(groups)
            groups.append(
                MemorandumAuditObject(
                    name=canonical_name,
                    manager=manager,
                    recommendations=[],
                )
            )
        groups[group_index[key]].recommendations.extend(group.recommendations)

    return MemorandumSource(groups=groups)


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


def _normalize_control_file_check_leader(value: str) -> str:
    normalized = re.sub(r"\s+", " ", (value or "").strip())
    if not normalized:
        raise HTTPException(status_code=400, detail="Укажите руководителя проверки.")
    return normalized


def _normalize_control_file_check_date(value: str) -> str:
    normalized = re.sub(r"\s+", " ", (value or "").strip())
    if not normalized:
        raise HTTPException(status_code=400, detail="Укажите дату проверки.")
    if re.fullmatch(r"\d{1,2}\.\d{2}\.\d{4}", normalized):
        day, month, year = normalized.split(".")
        try:
            date(int(year), int(month), int(day))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Некорректная дата проверки.") from exc
        return f"{day.zfill(2)}.{month}.{year}"
    try:
        parsed = date.fromisoformat(normalized)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Некорректная дата проверки.") from exc
    return parsed.strftime("%d.%m.%Y")


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


async def _generate_section_ii_response(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    *,
    with_hyperlinks: bool,
) -> FileResponse:
    _validate_docx_upload(file)
    original_name = (file.filename or "").strip()
    original_stem = Path(original_name).stem if original_name else ""
    suffix = "_section_ii_links" if with_hyperlinks else "_section_ii"
    download_name = f"{original_stem}{suffix}{DOCX_EXT}" if original_stem else f"{suffix.lstrip('_')}{DOCX_EXT}"
    input_path = await _save_upload_to_temp(file)
    output_path = _build_section_ii_output_path(input_path)
    try:
        result_path, _observations, error = await asyncio.to_thread(
            docx_generator.process_document,
            str(input_path),
            str(output_path),
            with_hyperlinks,
        )
        if error:
            raise HTTPException(status_code=400, detail=error)
        if not result_path or not output_path.is_file():
            raise HTTPException(status_code=500, detail="Файл результата не создан.")
        return _stream_result_file(
            background_tasks,
            input_path,
            output_path,
            media_type=DOCX_MIME,
            download_name=download_name,
        )
    except Exception:
        _cleanup_files(str(input_path), str(output_path))
        raise


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


@router.get("/control-file-template")
async def download_control_file_template():
    if not CONTROL_FILE_TEMPLATE_PATH.is_file():
        raise HTTPException(status_code=404, detail="Шаблон файла контроля не найден.")
    result_bytes = await asyncio.to_thread(CONTROL_FILE_TEMPLATE_PATH.read_bytes)
    return Response(
        content=result_bytes,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": _attachment_header(CONTROL_FILE_TEMPLATE_PATH.name)},
    )


@router.post("/control-file")
async def generate_control_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    check_leader: str = Form(...),
    check_date: str = Form(...),
):
    _validate_docx_upload(file)
    normalized_check_leader = _normalize_control_file_check_leader(check_leader)
    normalized_check_date = _normalize_control_file_check_date(check_date)
    original_name = (file.filename or "").strip()
    original_stem = Path(original_name).stem if original_name else ""
    download_name = (
        f"{original_stem}_control{XLSX_EXT}" if original_stem else f"control{XLSX_EXT}"
    )
    input_path = await _save_upload_to_temp(file)
    output_path = _build_control_file_output_path(input_path)
    try:
        result_path, error = await asyncio.to_thread(
            generate_control_file_template,
            str(input_path),
            str(output_path),
            check_leader=normalized_check_leader,
            check_date=normalized_check_date,
        )
        if error:
            raise HTTPException(status_code=400, detail=error)
        if not result_path or not output_path.is_file():
            raise HTTPException(status_code=500, detail="Файл контроля не создан.")
        return _stream_result_file(
            background_tasks,
            input_path,
            output_path,
            media_type=XLSX_MIME,
            download_name=download_name,
        )
    except Exception:
        _cleanup_files(str(input_path), str(output_path))
        raise


@router.post("/memorandum")
async def generate_memorandum(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
):
    _validate_docx_upload(file)
    original_name = (file.filename or "").strip()
    original_stem = Path(original_name).stem if original_name else ""
    download_name = f"{original_stem}_dz{DOCX_EXT}" if original_stem else "dz.docx"
    input_path = await _save_upload_to_temp(file)
    output_path = _build_memorandum_output_path(input_path)
    try:
        source, error = await asyncio.to_thread(parse_az_for_memorandum, str(input_path))
        if error:
            raise HTTPException(status_code=400, detail=error)
        if source is None:
            raise HTTPException(
                status_code=400,
                detail="Не удалось разобрать рекомендации из аудиторского заключения.",
            )
        try:
            source = await _canonicalize_memorandum_source(session, source)
        except DictionaryRefError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        result_path, error = await asyncio.to_thread(
            memorandum_generator.generate_memorandum,
            source,
            str(output_path),
        )
        if error:
            raise HTTPException(status_code=400, detail=error)
        if not result_path or not output_path.is_file():
            raise HTTPException(status_code=500, detail="Файл докладной записки не создан.")
        return _stream_result_file(
            background_tasks,
            input_path,
            output_path,
            media_type=DOCX_MIME,
            download_name=download_name,
        )
    except Exception:
        _cleanup_files(str(input_path), str(output_path))
        raise


@router.post("/parse-recommendations", response_model=list[ParsedRecommendationItem])
async def parse_recommendations_from_docx(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
):
    _validate_docx_upload(file)
    input_path = await _save_upload_to_temp(file)
    try:
        items, error = await asyncio.to_thread(_parse_recommendations_from_docx, str(input_path))
        if error:
            raise HTTPException(status_code=400, detail=error)
        try:
            for item in items:
                item.audit_object = await canonicalize_audit_objects(session, item.audit_object)
        except DictionaryRefError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return items
    finally:
        _cleanup_files(str(input_path))
