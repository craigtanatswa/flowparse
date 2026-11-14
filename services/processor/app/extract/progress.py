from __future__ import annotations

from typing import Callable

ProgressCallback = Callable[[str, int], None]


def notify_progress(
    callback: ProgressCallback | None, stage: str, percent: int
) -> None:
    """Report pipeline progress without ever letting reporting break extraction."""
    if callback is None:
        return
    try:
        callback(stage, max(0, min(100, int(percent))))
    except Exception:
        # Progress is best-effort telemetry. A database hiccup must not turn a
        # readable statement into a failed conversion.
        pass
