"""Map domain exceptions to the same JSON shape FastAPI uses for HTTPException."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.exceptions import DomainError
from app.core.logging import exception_type_name
from app.core.request_context import get_request_id

logger = logging.getLogger(__name__)


def _request_id_headers() -> dict[str, str]:
    request_id = get_request_id()
    if not request_id:
        return {}
    return {"X-Request-ID": request_id}


async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    status_code = exc.http_status
    if status_code >= 500:
        if exc.__cause__ is not None:
            logger.exception(
                "domain_error [%s] status=%s %s %s",
                type(exc).__name__,
                status_code,
                request.method,
                request.url.path,
            )
        else:
            logger.error(
                "domain_error [%s] status=%s %s %s detail=%s",
                type(exc).__name__,
                status_code,
                request.method,
                request.url.path,
                str(exc),
            )
    else:
        logger.warning(
            "domain_error [%s] status=%s %s %s detail=%s",
            type(exc).__name__,
            status_code,
            request.method,
            request.url.path,
            str(exc),
        )
    return JSONResponse(
        status_code=status_code,
        content={"detail": str(exc)},
        headers={**_request_id_headers(), **(exc.headers or {})},
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    logger.warning(
        "request_validation_error [%s] %s %s",
        type(exc).__name__,
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(exc.errors())},
        headers=_request_id_headers(),
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "unhandled_error [%s] %s %s",
        exception_type_name(exc),
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Внутренняя ошибка сервера."},
        headers=_request_id_headers(),
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, domain_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
