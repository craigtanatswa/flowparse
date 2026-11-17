from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_processing_mode() -> str:
    """Use the queue/worker model in production; process in-process elsewhere.

    Vercel runs daemons only in production deployments. Preview deployments and
    local development therefore keep using the embedded thread pool, while the
    production HTTP service leaves work for the processor worker daemon.
    """
    return "queued" if os.getenv("VERCEL_ENV") == "production" else "embedded"


class Settings(BaseSettings):
    supabase_url: str = "http://127.0.0.1:56321"
    supabase_service_role_key: str = ""
    supabase_statements_bucket: str = "statements"
    processor_api_key: str = ""
    processor_workers: int = 2
    processing_mode: Literal["embedded", "queued"] = Field(
        default_factory=_default_processing_mode
    )
    worker_poll_seconds: float = Field(default=2.0, gt=0)
    max_pages: int = 100
    max_file_mb: int = 25
    ocr_enabled: bool = True
    tesseract_cmd: str | None = None
    ocr_dpi: int = 300
    tesseract_lang: str = "eng"
    stale_job_minutes: int = 20

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def max_file_bytes(self) -> int:
        return self.max_file_mb * 1024 * 1024
