from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from app import worker
from app.config import Settings
from app.supabase_rest import SupabaseRest
from tests.fixtures.generate import generate_all

DOCUMENT_ID = "11111111-1111-1111-1111-111111111111"
JOB_ID = "22222222-2222-2222-2222-222222222222"
USER_ID = "33333333-3333-3333-3333-333333333333"


def test_worker_claims_and_processes_a_real_pdf(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pdf_bytes = generate_all()["digital"].read_bytes()
    saved_payloads: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if request.method == "GET" and path == "/rest/v1/conversion_jobs":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": JOB_ID,
                        "document_id": DOCUMENT_ID,
                        "user_id": USER_ID,
                        "attempt": 1,
                        "status": "queued",
                    }
                ],
            )
        if request.method == "GET" and path == "/rest/v1/uploaded_documents":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": DOCUMENT_ID,
                        "user_id": USER_ID,
                        "file_name": "statement.pdf",
                        "storage_path": f"{USER_ID}/{DOCUMENT_ID}/original.pdf",
                        "file_size": len(pdf_bytes),
                        "status": "queued",
                    }
                ],
            )
        if request.method == "PATCH" and path == "/rest/v1/conversion_jobs":
            return httpx.Response(200, json=[{"id": JOB_ID}])
        if request.method == "PATCH" and path == "/rest/v1/uploaded_documents":
            return httpx.Response(200, json=[{"id": DOCUMENT_ID}])
        if request.method == "GET" and path.startswith("/storage/v1/object/statements/"):
            return httpx.Response(200, content=pdf_bytes)
        if request.method == "POST" and path == "/rest/v1/rpc/update_conversion_progress":
            return httpx.Response(204)
        if request.method == "POST" and path == "/rest/v1/rpc/save_extraction_result":
            saved_payloads.append(json.loads(request.content))
            return httpx.Response(204)
        if request.method == "POST" and path == "/rest/v1/rpc/mark_conversion_failed":
            raise AssertionError("worker marked a readable statement as failed")
        return httpx.Response(404)

    def client(self: SupabaseRest) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(handler))

    monkeypatch.setattr(SupabaseRest, "_client", client)

    settings = Settings(
        _env_file=None,
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="test-service-role",
        ocr_enabled=False,
    )
    db = SupabaseRest(settings)

    assert worker.process_one(settings, db) is True
    assert len(saved_payloads) == 1
    assert saved_payloads[0]["p_document_id"] == DOCUMENT_ID
    assert saved_payloads[0]["p_job_id"] == JOB_ID
    payload = saved_payloads[0]["p_payload"]
    assert payload["status"] == "completed"
    assert len(payload["transactions"]) == 8
