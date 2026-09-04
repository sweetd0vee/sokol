import asyncio
import re
from datetime import date
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.http import content_disposition_attachment
from app.api.uploads import (
    DOCX_EXT,
    DOCX_MIME,
    XLSX_EXT,
    XLSX_MIME,
    cleanup_files,
    result_path_with_suffix,
    save_upload_to_temp,
    stream_result_file,
    validate_docx_upload,
)
from app.db.session import get_db_session
from app.schemas.tools import ParsedRecommendationItem
from app.services.dictionary_validation import canonicalize_audit_objects
from app.services.reports.az_import import (
    canonicalize_memorandum_source,
    parse_recommendations_from_docx,
)
from app.services.reports.control_file.generator import (
    TEMPLATE_PATH as CONTROL_FILE_TEMPLATE_PATH,
    generate_control_file_template,
)
from app.services.reports.memorandum import docx_generator as memorandum_generator
from app.services.reports.memorandum.parser import parse_az_for_memorandum
from app.services.reports.section_ii import docx_generator

router = APIRouter(prefix="/tools", tags=["tools"])

# Kept for tests that import or patch these names on the endpoint module.
_save_upload_to_temp = save_upload_to_temp
_canonicalize_memorandum_source = canonicalize_memorandum_source


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


def _download_name(original_name: str, suffix: str, ext: str) -> str:
    stem = Path((original_name or "").strip()).stem
    return f"{stem}{suffix}{ext}" if stem else f"{suffix.lstrip('_')}{ext}"


async def _generate_section_ii_response(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    *,
    with_hyperlinks: bool,
) -> FileResponse:
    validate_docx_upload(file)
    suffix = "_section_ii_links" if with_hyperlinks else "_section_ii"
    download_name = _download_name(file.filename or "", suffix, DOCX_EXT)
    input_path = await save_upload_to_temp(file)
    output_path = result_path_with_suffix(input_path, "_section_ii", DOCX_EXT)
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
        return stream_result_file(
            background_tasks,
            input_path,
            output_path,
            media_type=DOCX_MIME,
            download_name=download_name,
        )
    except Exception:
        cleanup_files(str(input_path), str(output_path))
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
        headers={"Content-Disposition": content_disposition_attachment(CONTROL_FILE_TEMPLATE_PATH.name)},
    )


@router.post("/control-file")
async def generate_control_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    check_leader: str = Form(...),
    check_date: str = Form(...),
):
    validate_docx_upload(file)
    normalized_check_leader = _normalize_control_file_check_leader(check_leader)
    normalized_check_date = _normalize_control_file_check_date(check_date)
    download_name = _download_name(file.filename or "", "_control", XLSX_EXT)
    input_path = await save_upload_to_temp(file)
    output_path = result_path_with_suffix(input_path, "_control", XLSX_EXT)
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
        return stream_result_file(
            background_tasks,
            input_path,
            output_path,
            media_type=XLSX_MIME,
            download_name=download_name,
        )
    except Exception:
        cleanup_files(str(input_path), str(output_path))
        raise


@router.post("/memorandum")
async def generate_memorandum(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
):
    validate_docx_upload(file)
    download_name = _download_name(file.filename or "", "_dz", DOCX_EXT)
    input_path = await save_upload_to_temp(file)
    output_path = result_path_with_suffix(input_path, "_dz", DOCX_EXT)
    try:
        source, error = await asyncio.to_thread(parse_az_for_memorandum, str(input_path))
        if error:
            raise HTTPException(status_code=400, detail=error)
        if source is None:
            raise HTTPException(
                status_code=400,
                detail="Не удалось разобрать рекомендации из аудиторского заключения.",
            )
        source = await canonicalize_memorandum_source(session, source)

        result_path, error = await asyncio.to_thread(
            memorandum_generator.generate_memorandum,
            source,
            str(output_path),
        )
        if error:
            raise HTTPException(status_code=400, detail=error)
        if not result_path or not output_path.is_file():
            raise HTTPException(status_code=500, detail="Файл докладной записки не создан.")
        return stream_result_file(
            background_tasks,
            input_path,
            output_path,
            media_type=DOCX_MIME,
            download_name=download_name,
        )
    except Exception:
        cleanup_files(str(input_path), str(output_path))
        raise


@router.post("/parse-recommendations", response_model=list[ParsedRecommendationItem])
async def parse_recommendations_from_docx_endpoint(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
):
    validate_docx_upload(file)
    input_path = await save_upload_to_temp(file)
    try:
        items, error = await asyncio.to_thread(parse_recommendations_from_docx, str(input_path))
        if error:
            raise HTTPException(status_code=400, detail=error)
        for item in items:
            item.audit_object = await canonicalize_audit_objects(session, item.audit_object)
        return items
    finally:
        cleanup_files(str(input_path))
