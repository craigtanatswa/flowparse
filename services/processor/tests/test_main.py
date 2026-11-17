from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app import main
from app.config import Settings

DOCUMENT_ID = "a" * 36
JOB_ID = "b" * 36
USER_ID = "c" * 36


def _settings(**overrides: Any) -> Settings:
    return Settings(
        _env_file=None,
        processor_api_key="test-key",
        supabase_service_role_key="test-service-role",
        ocr_enabled=False,
        **overrides,
    )


def test_create_job_queued_mode_validates_without_submitting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    validated: list[tuple[str, str, str]] = []
    monkeypatch.setattr(
        main,
        "settings",
        _settings(processing_mode="queued"),
    )
    monkeypatch.setattr(
        main,
        "validate_job",
        lambda _db, document_id, job_id, user_id: validated.append(
            (document_id, job_id, user_id)
        ),
    )
    monkeypatch.setattr(
        main.manager,
        "submit",
        lambda *_args: (_ for _ in ()).throw(
            AssertionError("queued mode must not submit an in-process job")
        ),
    )

    result = asyncio.run(
        main.create_job(
            main.JobRequest(
                document_id=DOCUMENT_ID,
                job_id=JOB_ID,
                user_id=USER_ID,
            )
        )
    )

    assert result == {
        "status": "accepted",
        "document_id": DOCUMENT_ID,
        "job_id": JOB_ID,
    }
    assert validated == [(DOCUMENT_ID, JOB_ID, USER_ID)]


def test_create_job_embedded_mode_submits_in_process(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    submitted: list[tuple[str, str, str]] = []
    monkeypatch.setattr(
        main,
        "settings",
        _settings(processing_mode="embedded"),
    )
    monkeypatch.setattr(
        main.manager,
        "submit",
        lambda document_id, job_id, user_id: submitted.append(
            (document_id, job_id, user_id)
        ),
    )
    monkeypatch.setattr(
        main,
        "validate_job",
        lambda *_args: (_ for _ in ()).throw(
            AssertionError("embedded mode should use JobManager.submit")
        ),
    )

    result = asyncio.run(
        main.create_job(
            main.JobRequest(
                document_id=DOCUMENT_ID,
                job_id=JOB_ID,
                user_id=USER_ID,
            )
        )
    )

    assert result["status"] == "accepted"
    assert submitted == [(DOCUMENT_ID, JOB_ID, USER_ID)]
