"""App logging: request-id filter, JSON in prod, grepable exception types."""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone

from app.core.config import settings
from app.core.request_context import get_request_id

_HANDLER_NAME = "sokol"
_APP_LOGGER_NAME = "app"


def exception_type_name(exc: BaseException | None = None) -> str:
    if exc is None:
        exc = sys.exc_info()[1]
    if exc is None:
        return "Exception"
    return type(exc).__name__


def format_caught_error(exc: BaseException | None = None) -> str:
    """Human-readable error that keeps the exception class, unlike ``str(exc)`` alone."""
    if exc is None:
        exc = sys.exc_info()[1]
    if exc is None:
        return "Exception"
    text = str(exc).strip()
    name = type(exc).__name__
    return f"{name}: {text}" if text else name


def log_caught_exception(logger: logging.Logger, message: str, *args: object) -> None:
    """Log the active exception with ``[TypeName]`` on the message line."""
    formatted = message % args if args else message
    logger.exception("%s [%s]", formatted, exception_type_name())


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id() or "-"
        if record.exc_info and record.exc_info[0] is not None:
            record.exc_type = record.exc_info[0].__name__
        else:
            record.exc_type = getattr(record, "exc_type", "") or ""
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        exc_type = getattr(record, "exc_type", "")
        if exc_type:
            payload["exc_type"] = exc_type
        if record.exc_info:
            payload["traceback"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def _build_handler() -> logging.Handler:
    handler = logging.StreamHandler(sys.stderr)
    handler.name = _HANDLER_NAME
    handler.addFilter(RequestIdFilter())
    if settings.log_json:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s"
            )
        )
    return handler


def configure_logging() -> None:
    """Idempotent setup for the ``app.*`` logger tree. Does not touch root/uvicorn."""
    logger = logging.getLogger(_APP_LOGGER_NAME)
    if any(getattr(handler, "name", "") == _HANDLER_NAME for handler in logger.handlers):
        return
    logger.addHandler(_build_handler())
    logger.setLevel(settings.log_level)
    logger.propagate = False
