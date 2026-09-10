"""In-process HTTP counters for /status. Not Prometheus — no extra dependency."""

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
