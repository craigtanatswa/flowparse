from __future__ import annotations

import threading
from typing import Any

import pytest

from app import worker
from app.config import Settings
from app.jobs import validate_job
from app.supabase_rest import ConversionConflict, DocumentNotFound


class FakeJobDb:
    def __init__(self, job: dict[str, Any], document: dict[str, Any]):
        self.job = job
        self.document = document

    def get_job(self, _job_id: str) -> dict[str, Any]:
        return self.job

    def get_document(self, _document_id: str) -> dict[str, Any]:
        return self.document


class FakeWorkerDb:
    def __init__(
        self,
        claimed: list[tuple[dict[str, Any], dict[str, Any]]] | None = None,
        shutdown: threading.Event | None = None,
    ):
        self.claimed = list(claimed or [])
        self.shutdown = shutdown
        self.recovered = 0

    def claim_stale_jobs(self, _minutes: int, **_kwargs: Any) -> int:
        self.recovered += 1
        return 0

    def claim_next_job(self) -> tuple[dict[str, Any], dict[str, Any]] | None:
        if self.shutdown is not None:
            self.shutdown.set()
        return self.claimed.pop(0) if self.claimed else None


def _settings(**overrides: Any) -> Settings:
    return Settings(_env_file=None, **overrides)


def test_validate_job_accepts_queued_job() -> None:
    job = {"id": "job-1", "document_id": "doc-1", "user_id": "user-1", "status": "queued"}
    document = {"id": "doc-1", "user_id": "user-1", "status": "queued"}
    db = FakeJobDb(job, document)

    returned_job, returned_document = validate_job(db, "doc-1", "job-1", "user-1")

    assert returned_job is job
    assert returned_document is document


def test_validate_job_rejects_completed_document() -> None:
    job = {"id": "job-1", "document_id": "doc-1", "user_id": "user-1", "status": "queued"}
    document = {"id": "doc-1", "user_id": "user-1", "status": "completed"}
    db = FakeJobDb(job, document)

    with pytest.raises(ConversionConflict):
        validate_job(db, "doc-1", "job-1", "user-1")


def test_validate_job_rejects_other_user() -> None:
    job = {"id": "job-1", "document_id": "doc-1", "user_id": "user-1", "status": "queued"}
    document = {"id": "doc-1", "user_id": "user-1", "status": "queued"}
    db = FakeJobDb(job, document)

    with pytest.raises(DocumentNotFound):
        validate_job(db, "doc-1", "job-1", "user-2")


def test_process_one_returns_false_for_empty_queue() -> None:
    db = FakeWorkerDb()

    assert worker.process_one(_settings(), db) is False


def test_process_one_processes_claimed_job(monkeypatch: pytest.MonkeyPatch) -> None:
    job = {"id": "job-1", "document_id": "doc-1", "user_id": "user-1", "status": "queued"}
    document = {"id": "doc-1", "user_id": "user-1", "status": "queued"}
    calls: list[tuple[Settings, dict[str, Any], dict[str, Any]]] = []
    monkeypatch.setattr(
        worker,
        "process_job",
        lambda settings, doc, claimed_job: calls.append((settings, doc, claimed_job)),
    )

    db = FakeWorkerDb([(job, document)])
    settings = _settings()

    assert worker.process_one(settings, db) is True
    assert calls == [(settings, document, job)]


def test_run_recovers_stale_jobs_and_stops(monkeypatch: pytest.MonkeyPatch) -> None:
    shutdown = threading.Event()
    db = FakeWorkerDb(shutdown=shutdown)
    monkeypatch.setattr(worker, "SupabaseRest", lambda _settings: db)
    settings = _settings(supabase_service_role_key="test", worker_poll_seconds=0.01)

    worker.run(settings, shutdown)

    assert db.recovered == 1


def test_processing_mode_defaults_to_queued_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.delenv("PROCESSING_MODE", raising=False)

    assert _settings().processing_mode == "queued"


def test_processing_mode_defaults_to_embedded_outside_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    monkeypatch.delenv("PROCESSING_MODE", raising=False)

    assert _settings().processing_mode == "embedded"
