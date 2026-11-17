from __future__ import annotations

from collections.abc import Callable

import httpx
import pytest

from app.config import Settings
from app.supabase_rest import SupabaseRest

SUPABASE_URL = "https://example.supabase.co"
SERVICE_ROLE_KEY = "test-service-role"


def _settings() -> Settings:
    return Settings(
        _env_file=None,
        supabase_url=SUPABASE_URL,
        supabase_service_role_key=SERVICE_ROLE_KEY,
    )


def _db_with_transport(
    monkeypatch: pytest.MonkeyPatch,
    handler: Callable[[httpx.Request], httpx.Response],
) -> SupabaseRest:
    db = SupabaseRest(_settings())

    def client() -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(handler))

    monkeypatch.setattr(db, "_client", client)
    return db


def test_claim_next_job_claims_oldest_queued_job(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[tuple[str, str, dict[str, str]]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append((request.method, request.url.path, dict(request.url.params)))
        if request.method == "GET" and request.url.path.endswith("/conversion_jobs"):
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "job-1",
                        "document_id": "doc-1",
                        "user_id": "user-1",
                        "attempt": 1,
                        "status": "queued",
                    }
                ],
            )
        if request.method == "GET" and request.url.path.endswith("/uploaded_documents"):
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "doc-1",
                        "user_id": "user-1",
                        "file_name": "statement.pdf",
                        "storage_path": "user-1/doc-1/original.pdf",
                        "file_size": 123,
                        "status": "queued",
                    }
                ],
            )
        if request.method == "PATCH" and request.url.path.endswith("/conversion_jobs"):
            return httpx.Response(200, json=[{"id": "job-1"}])
        if request.method == "PATCH" and request.url.path.endswith("/uploaded_documents"):
            return httpx.Response(200, json=[{"id": "doc-1"}])
        return httpx.Response(404)

    db = _db_with_transport(monkeypatch, handler)

    claimed = db.claim_next_job()

    assert claimed is not None
    job, document = claimed
    assert job["id"] == "job-1"
    assert document["id"] == "doc-1"
    assert requests[0][0] == "GET"
    assert requests[0][2]["status"] == "eq.queued"
    assert requests[0][2]["order"] == "created_at.asc"
    assert requests[2][0] == "PATCH"
    assert requests[2][2]["status"] == "eq.queued"


def test_claim_stale_jobs_can_leave_queued_jobs_for_the_worker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[dict[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(dict(request.url.params))
        return httpx.Response(200, json=[])

    db = _db_with_transport(monkeypatch, handler)

    assert db.claim_stale_jobs(20, include_queued=False) == 0
    assert requests[0]["status"] == "eq.processing"


def test_claim_next_job_skips_job_claimed_by_another_worker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path.endswith("/conversion_jobs"):
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "job-1",
                        "document_id": "doc-1",
                        "user_id": "user-1",
                        "attempt": 1,
                        "status": "queued",
                    }
                ],
            )
        if request.method == "GET" and request.url.path.endswith("/uploaded_documents"):
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "doc-1",
                        "user_id": "user-1",
                        "file_name": "statement.pdf",
                        "storage_path": "user-1/doc-1/original.pdf",
                        "file_size": 123,
                        "status": "queued",
                    }
                ],
            )
        if request.method == "PATCH" and request.url.path.endswith("/conversion_jobs"):
            return httpx.Response(200, json=[])
        return httpx.Response(200, json=[])

    db = _db_with_transport(monkeypatch, handler)

    assert db.claim_next_job() is None
