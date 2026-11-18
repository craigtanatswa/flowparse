from __future__ import annotations

import logging
import uuid
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


class JobNotFound(SupabaseError):
    pass


class DocumentNotFound(SupabaseError):
    pass


class ConversionConflict(SupabaseError):
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

    def get_job(self, job_id: str) -> dict[str, Any]:
        with self._client() as client:
            response = client.get(
                f"{_base(self.settings)}/rest/v1/conversion_jobs",
                params={
                    "id": f"eq.{job_id}",
                    "select": "id,document_id,user_id,attempt,status",
                },
                headers=_headers(self.settings),
            )
        if response.status_code >= 400:
            raise SupabaseError(
                f"Could not read conversion job (status {response.status_code}).",
                status_code=response.status_code,
            )
        rows = response.json()
        if not rows:
            raise JobNotFound("Conversion not found.")
        return rows[0]

    def get_document(self, document_id: str) -> dict[str, Any]:
        with self._client() as client:
            response = client.get(
                f"{_base(self.settings)}/rest/v1/uploaded_documents",
                params={
                    "id": f"eq.{document_id}",
                    "select": "id,user_id,file_name,storage_path,file_size,status",
                },
                headers=_headers(self.settings),
            )
        if response.status_code >= 400:
            raise SupabaseError(
                f"Could not read document (status {response.status_code}).",
                status_code=response.status_code,
            )
        rows = response.json()
        if not rows:
            raise DocumentNotFound("Document not found.")
        return rows[0]

    def claim_job(self, job_id: str, document_id: str) -> None:
        """Move one queued job into processing exactly once."""
        with self._client() as client:
            response = client.patch(
                f"{_base(self.settings)}/rest/v1/conversion_jobs",
                params={
                    "id": f"eq.{job_id}",
                    "document_id": f"eq.{document_id}",
                    "status": "eq.queued",
                },
                json={"status": "processing", "error_message": None},
                headers=_headers(self.settings, representation=True),
            )
        if response.status_code >= 400:
            raise SupabaseError(
                f"Could not claim conversion (status {response.status_code}).",
                status_code=response.status_code,
            )
        if not response.json():
            raise ConversionConflict(
                "This conversion is already being processed or has already been extracted."
            )

        # Keep the denormalised document state in step with the job so the
        # existing dashboard/status UI continues to work.
        with self._client() as client:
            document_response = client.patch(
                f"{_base(self.settings)}/rest/v1/uploaded_documents",
                params={
                    "id": f"eq.{document_id}",
                    "status": "in.(uploaded,queued,failed)",
                },
                json={"status": "processing", "error_message": None},
                headers=_headers(self.settings),
            )
        if document_response.status_code >= 400:
            raise SupabaseError(
                "Could not mark the document as processing "
                f"(status {document_response.status_code}).",
                status_code=document_response.status_code,
            )

    def list_queued_jobs(self, limit: int = 10) -> list[dict[str, Any]]:
        """Return the oldest queued jobs for the worker to claim."""
        with self._client() as client:
            response = client.get(
                f"{_base(self.settings)}/rest/v1/conversion_jobs",
                params={
                    "status": "eq.queued",
                    "select": "id,document_id,user_id,attempt,status",
                    "order": "created_at.asc",
                    "limit": max(1, int(limit)),
                },
                headers=_headers(self.settings),
            )
        if response.status_code >= 400:
            raise SupabaseError(
                f"Could not list queued conversions (status {response.status_code}).",
                status_code=response.status_code,
            )
        return response.json()

    def claim_next_job(self) -> tuple[dict[str, Any], dict[str, Any]] | None:
        """Atomically claim the oldest queued job, skipping races.

        The HTTP service only validates jobs in queued mode. The worker uses
        this method to take ownership before running extraction.
        """
        for job in self.list_queued_jobs():
            document_id = str(job["document_id"])
            try:
                document = self.get_document(document_id)
            except DocumentNotFound:
                continue
            if document["user_id"] != job["user_id"]:
                continue
            if document["status"] in {"completed", "partial"}:
                continue
            try:
                self.claim_job(str(job["id"]), document_id)
            except ConversionConflict:
                continue
            return job, document
        return None

    def download_document(self, document: dict[str, Any]) -> bytes:
        storage_path = str(document.get("storage_path") or "")
        user_id = str(document.get("user_id") or "")
        # Defence in depth: a document row must never cause the service role to
        # read an object outside its owner's folder. The database constraint and
        # create_statement RPC enforce this too.
        if not user_id or not storage_path.startswith(f"{user_id}/"):
            raise SupabaseError(
                "The document storage path does not belong to its owner."
            )
        path = quote(storage_path, safe="/")
        url = f"{_base(self.settings)}/storage/v1/object/{self.settings.supabase_statements_bucket}/{path}"
        # Hosted Supabase Storage sits behind a CDN that ignores conditional
        # request headers (Cache-Control/Pragma) and keys its cache on the full
        # URL. A repaired/replaced source object can otherwise be served from
        # cache for up to an hour, so always download through a unique URL.
        params = {"v": uuid.uuid4().hex}
        with self._client() as client:
            response = client.get(url, params=params, headers=_headers(self.settings))
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

    def save_result(
        self, document_id: str, job_id: str, payload: dict[str, Any]
    ) -> None:
        self._rpc(
            "save_extraction_result",
            {
                "p_document_id": document_id,
                "p_job_id": job_id,
                "p_payload": payload,
            },
        )

    def update_progress(self, job_id: str, stage: str, percent: int) -> None:
        """Record a real pipeline stage. Safe to call after a job is gone."""
        self._rpc(
            "update_conversion_progress",
            {
                "p_job_id": job_id,
                "p_stage": stage[:160],
                "p_percent": max(0, min(100, int(percent))),
            },
        )

    def mark_failed(self, job_id: str, message: str) -> None:
        self._rpc(
            "mark_conversion_failed",
            {"p_job_id": job_id, "p_message": message[:2000]},
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

    def claim_stale_jobs(
        self, older_than_minutes: int, *, include_queued: bool = True
    ) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=older_than_minutes)
        cutoff_iso = cutoff.isoformat()
        with self._client() as client:
            response = client.get(
                f"{_base(self.settings)}/rest/v1/conversion_jobs",
                params={
                    "status": (
                        "in.(processing,queued)" if include_queued else "eq.processing"
                    ),
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
                logger.exception("Failed to recover stale job %s", row.get("id"))
        return recovered
