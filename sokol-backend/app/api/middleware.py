"""ASGI middleware: request-id header, access log, in-process metrics."""

from __future__ import annotations

import json
import logging
import time
import uuid

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging import log_caught_exception
from app.core.metrics import record_request
from app.core.request_context import bind_request_id, reset_request_id

logger = logging.getLogger(__name__)

_QUIET_PATHS = frozenset(
    {
        "/",
        "/api/v1/status",
        "/api/v1/ready",
        "/api/v1/metrics",
        "/docs",
        "/redoc",
        "/openapi.json",
    }
)
_INTERNAL_ERROR_BODY = json.dumps({"detail": "Внутренняя ошибка сервера."}).encode("utf-8")


def _is_quiet_path(path: str) -> bool:
    return path in _QUIET_PATHS


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        request_id = (headers.get("x-request-id") or "").strip() or uuid.uuid4().hex
        token = bind_request_id(request_id)
        started = time.perf_counter()
        status_code = 500
        response_started = False

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code, response_started
            if message["type"] == "http.response.start":
                response_started = True
                status_code = int(message["status"])
                mutable = MutableHeaders(raw=list(message.get("headers", [])))
                mutable["x-request-id"] = request_id
                message["headers"] = mutable.raw
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            log_caught_exception(
                logger,
                "unhandled_error %s %s",
                scope.get("method"),
                scope.get("path"),
            )
            if response_started:
                raise
            error_headers = MutableHeaders()
            error_headers["content-type"] = "application/json"
            error_headers["content-length"] = str(len(_INTERNAL_ERROR_BODY))
            error_headers["x-request-id"] = request_id
            await send(
                {
                    "type": "http.response.start",
                    "status": 500,
                    "headers": error_headers.raw,
                }
            )
            await send({"type": "http.response.body", "body": _INTERNAL_ERROR_BODY})
            status_code = 500
            response_started = True
        finally:
            duration_ms = (time.perf_counter() - started) * 1000
            record_request(status_code)
            path = str(scope.get("path") or "")
            if not (_is_quiet_path(path) and status_code < 400):
                logger.info(
                    "http_request %s %s %s %.1fms",
                    scope.get("method"),
                    path,
                    status_code,
                    duration_ms,
                )
            reset_request_id(token)
