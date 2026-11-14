from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str = "http://127.0.0.1:56321"
    supabase_service_role_key: str = ""
    supabase_statements_bucket: str = "statements"
    processor_api_key: str = ""
    processor_workers: int = 2
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
