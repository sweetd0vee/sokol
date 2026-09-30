"""In-process HTTP counters for /status and Prometheus text for /metrics."""

from __future__ import annotations

import threading
import time

_lock = threading.Lock()
_started_at = time.monotonic()
_requests_total = 0
_requests_4xx = 0
_requests_5xx = 0


def record_request(status_code: int) -> None:
    global _requests_total, _requests_4xx, _requests_5xx
    with _lock:
        _requests_total += 1
        if 400 <= status_code < 500:
            _requests_4xx += 1
        elif status_code >= 500:
            _requests_5xx += 1


def snapshot_metrics() -> dict[str, int]:
    with _lock:
        return {
            "uptime_seconds": int(time.monotonic() - _started_at),
            "requests_total": _requests_total,
            "requests_4xx": _requests_4xx,
            "requests_5xx": _requests_5xx,
        }


def prometheus_text(
    snapshot: dict[str, int],
    extra: dict[str, int] | None = None,
) -> str:
    """Prometheus text exposition format (no extra dependency)."""
    samples: list[tuple[str, str, str, int]] = [
        (
            "sokol_http_requests_total",
            "counter",
            "HTTP requests handled by this process",
            snapshot["requests_total"],
        ),
        (
            "sokol_http_requests_4xx_total",
            "counter",
            "HTTP 4xx responses",
            snapshot["requests_4xx"],
        ),
        (
            "sokol_http_requests_5xx_total",
            "counter",
            "HTTP 5xx responses",
            snapshot["requests_5xx"],
        ),
        (
            "sokol_process_uptime_seconds",
            "gauge",
            "Process uptime in seconds",
            snapshot["uptime_seconds"],
        ),
    ]
    for key, value in (extra or {}).items():
        samples.append((f"sokol_{key}", "gauge", key.replace("_", " "), int(value)))
    lines: list[str] = []
    for name, kind, help_text, value in samples:
        lines.append(f"# HELP {name} {help_text}")
        lines.append(f"# TYPE {name} {kind}")
        lines.append(f"{name} {int(value)}")
    return "\n".join(lines) + "\n"
