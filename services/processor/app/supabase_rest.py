from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote

import httpx

from .config import Settings

logger = logging.getLogger(__name__)


class SupabaseError(RuntimeError):
    def __init__(self, message: str, *, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class StatementNotFound(SupabaseError):
    pass


class StatementConflict(SupabaseError):
    pass


def _headers(settings: Settings, *, representation: bool = False) -> dict[str, str]:
    if not settings.supabase_service_role_key:
        raise SupabaseError("SUPABASE_SERVICE_ROLE_KEY is not configured.")
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    if representation:
        headers["Prefer"] = "return=representation"
    return headers


def _base(settings: Settings) -> str:
    return settings.supabase_url.rstrip("/")


class SupabaseRest:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _client(self) -> httpx.Client:
        return httpx.Client(timeout=httpx.Timeout(60.0, connect=10.0))

    def get_statement(self, statement_id: str) -> dict[str, Any]:
        with self._client() as client:
            response = client.get(
                f"{_base(self.settings)}/rest/v1/statements",
                params={
                    "id": f"eq.{statement_id}",
                    "select": "id,user_id,file_name,storage_path,file_size,status,processed_at,updated_at",
                },
                headers=_headers(self.settings),
            )
        if response.status_code >= 400:
            raise SupabaseError(
                f"Could not read statement (status {response.status_code}).",
                status_code=response.status_code,
            )
        rows = response.json()
        if not rows:
            raise StatementNotFound("Statement not found.")
        return rows[0]

    def claim_statement(self, statement_id: str) -> None:
        """Move an uploaded/failed/queued statement into processing exactly once."""
        with self._client() as client:
            response = client.patch(
                f"{_base(self.settings)}/rest/v1/statements",
                params={
                    "id": f"eq.{statement_id}",
                    "status": "in.(uploaded,queued,failed)",
                },
                json={"status": "processing", "error_message": None},
                headers=_headers(self.settings, representation=True),
            )
        if response.status_code >= 400:
            raise SupabaseError(
                f"Could not claim statement (status {response.status_code}).",
                status_code=response.status_code,
            )
        if not response.json():
            raise StatementConflict("This statement is already being processed or has already been extracted.")

    def download_statement(self, statement: dict[str, Any]) -> bytes:
        path = quote(str(statement["storage_path"]), safe="/")
        url = f"{_base(self.settings)}/storage/v1/object/{self.settings.supabase_statements_bucket}/{path}"
        with self._client() as client:
            response = client.get(url, headers=_headers(self.settings))
        if response.status_code == 404:
            raise SupabaseError("The uploaded PDF could not be found in storage.")
        if response.status_code >= 400:
            raise SupabaseError(
                f"Could not download the PDF (status {response.status_code}).",
                status_code=response.status_code,
            )
        if len(response.content) > self.settings.max_file_bytes:
            raise SupabaseError(
                f"The PDF is larger than the {self.settings.max_file_mb} MB processing limit."
            )
        return response.content

    def save_result(self, statement_id: str, payload: dict[str, Any]) -> None:
        self._rpc(
            "save_extraction_result",
            {"p_statement_id": statement_id, "p_payload": payload},
        )

    def update_progress(self, statement_id: str, stage: str, percent: int) -> None:
        """Record a real pipeline stage. Safe to call after a statement is gone."""
        with self._client() as client:
            response = client.patch(
                f"{_base(self.settings)}/rest/v1/statements",
                params={
                    "id": f"eq.{statement_id}",
                    "status": "in.(queued,processing)",
                },
                json={
                    "processing_stage": stage[:160],
                    "progress_percent": max(0, min(100, int(percent))),
                },
                headers=_headers(self.settings),
            )
        if response.status_code >= 400:
            raise SupabaseError(
                f"Could not update processing progress (status {response.status_code}).",
                status_code=response.status_code,
            )

    def mark_failed(self, statement_id: str, message: str) -> None:
        self._rpc(
            "mark_statement_failed",
            {"p_statement_id": statement_id, "p_message": message[:2000]},
        )

    def _rpc(self, function: str, payload: dict[str, Any]) -> Any:
        with self._client() as client:
            response = client.post(
                f"{_base(self.settings)}/rest/v1/rpc/{function}",
                json=payload,
                headers=_headers(self.settings),
            )
        if response.status_code >= 400:
            # Never include the upstream response body: PostgREST errors can
            # echo row values back in constraint messages.
            raise SupabaseError(
                f"Database operation {function} failed with status {response.status_code}.",
                status_code=response.status_code,
            )
        if not response.content:
            return None
        try:
            return response.json()
        except ValueError:
            return None

    def claim_stale_jobs(self, older_than_minutes: int) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=older_than_minutes)
        cutoff_iso = cutoff.isoformat()
        with self._client() as client:
            response = client.get(
                f"{_base(self.settings)}/rest/v1/statements",
                params={
                    "status": "in.(processing,queued)",
                    "updated_at": f"lt.{cutoff_iso}",
                    "select": "id",
                },
                headers=_headers(self.settings),
            )
        if response.status_code >= 400:
            raise SupabaseError(f"Could not inspect stale jobs: {response.status_code}")

        recovered = 0
        for row in response.json():
            try:
                self.mark_failed(
                    row["id"],
                    "Processing was interrupted before it completed. Please retry this statement.",
                )
                recovered += 1
            except SupabaseError:
                logger.exception("Failed to recover stale statement %s", row.get("id"))
        return recovered
