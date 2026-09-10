"""Streaming uploads to temp files for DOCX/XLSX tool endpoints."""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path

from fastapi import BackgroundTasks, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.api.http import content_disposition_attachment
from app.core.config import settings
from app.core.logging import exception_type_name, log_caught_exception

logger = logging.getLogger(__name__)

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
DOCX_EXT = ".docx"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
XLSX_EXT = ".xlsx"
UPLOAD_CHUNK_SIZE = 256 * 1024


def cleanup_files(*paths: str) -> None:
    for path in paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
        except OSError:
            pass


def validate_docx_upload(file: UploadFile) -> None:
    filename = file.filename or ""
    if not filename.lower().endswith(DOCX_EXT):
        raise HTTPException(status_code=400, detail="Файл должен быть в формате .docx.")


async def save_upload_to_temp(file: UploadFile) -> Path:
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
                        detail=f"Не удалось прочитать файл: {exception_type_name(exc)}: {exc}",
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
    except HTTPException:
        if tmp_path is not None:
            cleanup_files(str(tmp_path))
        raise
    except Exception:
        log_caught_exception(logger, "Failed to stream upload to temp file")
        if tmp_path is not None:
            cleanup_files(str(tmp_path))
        raise


def stream_result_file(
    background_tasks: BackgroundTasks,
    input_path: Path,
    output_path: Path,
    *,
    media_type: str,
    download_name: str,
) -> FileResponse:
    background_tasks.add_task(cleanup_files, str(input_path), str(output_path))
    return FileResponse(
        path=output_path,
        media_type=media_type,
        headers={"Content-Disposition": content_disposition_attachment(download_name)},
    )


def result_path_with_suffix(input_path: Path, suffix: str, ext: str) -> Path:
    return input_path.with_suffix("").with_name(f"{input_path.stem}{suffix}{ext}")
