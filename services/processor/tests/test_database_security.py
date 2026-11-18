from __future__ import annotations

import os
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date, timedelta

import psycopg
import pytest
from psycopg.types.json import Jsonb

DATABASE_URL = os.getenv("FLOWPARSE_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="Set FLOWPARSE_TEST_DATABASE_URL to a disposable migrated database.",
)

ALICE = "11111111-1111-4111-8111-111111111111"
BOB = "22222222-2222-4222-8222-222222222222"


@pytest.fixture()
def db() -> Iterator[psycopg.Connection]:
    assert DATABASE_URL is not None
    connection = psycopg.connect(DATABASE_URL, autocommit=True)
    try:
        _reset(connection)
        yield connection
    finally:
        _reset(connection)
        connection.close()


def _reset(connection: psycopg.Connection) -> None:
    connection.execute("reset role")
    connection.execute(
        "select set_config('request.jwt.claim.sub', '', false)"
    )
    connection.execute(
        "delete from public.billing_webhook_events where id like 'audit-%'"
    )
    connection.execute(
        "delete from auth.users where id in (%s, %s)", (ALICE, BOB)
    )
    connection.execute(
        "delete from storage.objects where name like %s or name like %s",
        (f"{ALICE}/%", f"{BOB}/%"),
    )
    connection.execute(
        "insert into auth.users (id, email, raw_user_meta_data) values "
        "(%s, 'alice@example.test', '{}'), (%s, 'bob@example.test', '{}')",
        (ALICE, BOB),
    )


@contextmanager
def acting_as(connection: psycopg.Connection, user_id: str):
    connection.execute("set role authenticated")
    connection.execute(
        "select set_config('request.jwt.claim.sub', %s, false)", (user_id,)
    )
    try:
        yield
    finally:
        connection.execute("reset role")
        connection.execute("select set_config('request.jwt.claim.sub', '', false)")


@contextmanager
def acting_as_service(connection: psycopg.Connection):
    connection.execute("set role service_role")
    try:
        yield
    finally:
        connection.execute("reset role")


def _create_document(connection: psycopg.Connection, user_id: str) -> tuple[str, str]:
    with acting_as(connection, user_id):
        row = connection.execute(
            "select id, storage_path from public.create_statement('statement.pdf', 1000)"
        ).fetchone()
    assert row is not None
    return str(row[0]), str(row[1])


def _queue(connection: psycopg.Connection, user_id: str, document_id: str) -> str:
    with acting_as(connection, user_id):
        row = connection.execute(
            "select id from public.queue_conversion(%s)", (document_id,)
        ).fetchone()
    assert row is not None
    return str(row[0])


def _payload(
    *,
    page_count: int,
    transactions: int = 1,
    opening: float | None = 0,
    closing: float | None = 0,
    opening_source: str = "statement",
    debit: float | None = 1,
    credit: float | None = None,
) -> Jsonb:
    rows = [
        {
            "txn_date": "2025-01-02",
            "description": f"row {index}",
            "debit": debit,
            "credit": credit,
            "balance": None,
            "sort_index": index,
        }
        for index in range(transactions)
    ]
    return Jsonb(
        {
            "status": "completed",
            "summary": {
                "page_count": page_count,
                "currency": "GBP",
                "opening_balance": opening,
                "closing_balance": closing,
            },
            "validation": {"status": "verified"},
            "report": {"opening_balance_source": opening_source},
            "transactions": rows,
        }
    )


def _save(
    connection: psycopg.Connection,
    document_id: str,
    job_id: str,
    payload: Jsonb,
) -> None:
    with acting_as_service(connection):
        connection.execute(
            "select public.save_extraction_result(%s, %s, %s)",
            (document_id, job_id, payload),
        )


def _document(
    connection: psycopg.Connection, document_id: str
) -> tuple[str, str | None, int | None]:
    connection.execute("reset role")
    row = connection.execute(
        "select status, error_message, page_count from public.uploaded_documents where id = %s",
        (document_id,),
    ).fetchone()
    assert row is not None
    return str(row[0]), row[1], row[2]


def _current_pages(connection: psycopg.Connection, user_id: str) -> int:
    connection.execute("reset role")
    row = connection.execute(
        "select pages_processed from public.usage_records "
        "where user_id = %s "
        "and period_start = date_trunc('month', timezone('utc', now()))::date",
        (user_id,),
    ).fetchone()
    return int(row[0]) if row else 0


def test_statement_creation_is_owned_and_direct_writes_are_blocked(
    db: psycopg.Connection,
) -> None:
    document_id, storage_path = _create_document(db, ALICE)

    assert storage_path == f"{ALICE}/{document_id}/original.pdf"
    with acting_as(db, ALICE):
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            db.execute(
                "insert into public.uploaded_documents "
                "(user_id, file_name, storage_path, file_size, mime_type, status) "
                "values (%s, 'forged.pdf', %s, 1000, 'application/pdf', 'completed')",
                (ALICE, f"{ALICE}/{uuid.uuid4()}/original.pdf"),
            )
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            db.execute(
                "update public.uploaded_documents set status = 'completed', page_count = 1"
            )
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            db.execute("delete from public.uploaded_documents")


def test_statement_creation_validates_name_and_size(db: psycopg.Connection) -> None:
    with acting_as(db, ALICE):
        with pytest.raises(psycopg.errors.RaiseException):
            db.execute("select * from public.create_statement('not-a-pdf.txt', 1000)")
        with pytest.raises(psycopg.errors.RaiseException):
            db.execute("select * from public.create_statement('empty.pdf', 0)")
        with pytest.raises(psycopg.errors.RaiseException):
            db.execute(
                "select * from public.create_statement('huge.pdf', %s)",
                (26 * 1024 * 1024,),
            )


def test_cross_user_reads_deletes_and_profile_reads_are_blocked(
    db: psycopg.Connection,
) -> None:
    alice_document, _ = _create_document(db, ALICE)

    with acting_as(db, BOB):
        assert db.execute(
            "select count(*) from public.uploaded_documents where id = %s",
            (alice_document,),
        ).fetchone()[0] == 0
        assert db.execute(
            "select count(*) from public.profiles where id = %s", (ALICE,)
        ).fetchone()[0] == 0
        with pytest.raises(psycopg.errors.RaiseException):
            db.execute("select public.delete_statement(%s)", (alice_document,))

    with acting_as(db, ALICE):
        assert db.execute(
            "select count(*) from public.uploaded_documents where id = %s",
            (alice_document,),
        ).fetchone()[0] == 1


def test_clients_cannot_change_their_plan(db: psycopg.Connection) -> None:
    with acting_as(db, BOB):
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            db.execute(
                "update public.profiles set plan_id = 'business' where id = %s",
                (BOB,),
            )

    db.execute("reset role")
    row = db.execute(
        "select plan_id from public.profiles where id = %s", (BOB,)
    ).fetchone()
    assert row is not None and row[0] == "free"


def test_transactions_cannot_reference_another_users_job_or_document(
    db: psycopg.Connection,
) -> None:
    alice_document, _ = _create_document(db, ALICE)
    alice_job = _queue(db, ALICE, alice_document)
    bob_document, _ = _create_document(db, BOB)
    bob_job = _queue(db, BOB, bob_document)

    with acting_as(db, BOB):
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            db.execute(
                "insert into public.extracted_transactions "
                "(document_id, job_id, user_id, txn_date, description, debit) "
                "values (%s, %s, %s, '2025-01-02', 'foreign job', 1)",
                (bob_document, alice_job, BOB),
            )
        db.execute(
            "insert into public.extracted_transactions "
            "(document_id, job_id, user_id, txn_date, description, debit) "
            "values (%s, %s, %s, '2025-01-02', 'own job', 1)",
            (bob_document, bob_job, BOB),
        )
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            db.execute(
                "update public.extracted_transactions set document_id = %s",
                (alice_document,),
            )
        db.execute(
            "update public.extracted_transactions set description = 'edited'"
        )

    assert db.execute(
        "select count(*) from public.extracted_transactions where user_id = %s",
        (BOB,),
    ).fetchone()[0] == 1


def test_editor_rpc_is_owner_only_and_reconciles_derived_opening(
    db: psycopg.Connection,
) -> None:
    alice_document, _ = _create_document(db, ALICE)
    bob_document, _ = _create_document(db, BOB)
    bob_job = _queue(db, BOB, bob_document)
    _save(
        db,
        bob_document,
        bob_job,
        _payload(
            page_count=1,
            opening=1000,
            closing=1500,
            opening_source="derived",
            debit=None,
            credit=500,
        ),
    )

    with acting_as(db, BOB):
        with pytest.raises(psycopg.errors.RaiseException):
            db.execute(
                "select * from public.apply_transaction_changes(%s, '[]'::jsonb)",
                (alice_document,),
            )
        db.execute(
            "select * from public.apply_transaction_changes(%s, '[]'::jsonb)",
            (bob_document,),
        )

    db.execute("reset role")
    row = db.execute(
        "select validation_status, validation->'checks' from public.uploaded_documents "
        "where id = %s",
        (bob_document,),
    ).fetchone()
    assert row is not None
    assert row[0] == "insufficient_data"
    endpoint = next(
        check for check in row[1] if check["id"] == "endpoint_reconciliation"
    )
    assert endpoint["status"] == "not_available"


def test_editor_rpc_flags_mixed_currency_totals(
    db: psycopg.Connection,
) -> None:
    document_id, _ = _create_document(db, BOB)
    job_id = _queue(db, BOB, document_id)
    payload = Jsonb(
        {
            "status": "completed",
            "summary": {
                "page_count": 1,
                "currency": "GBP",
                "opening_balance": 1000,
                "closing_balance": 1000,
            },
            "validation": {"status": "verified"},
            "report": {},
            "transactions": [
                {
                    "txn_date": "2025-01-02",
                    "description": "foreign",
                    "debit": 100,
                    "credit": None,
                    "balance": None,
                    "currency": "USD",
                    "sort_index": 0,
                },
                {
                    "txn_date": "2025-01-03",
                    "description": "domestic",
                    "debit": None,
                    "credit": 100,
                    "balance": None,
                    "currency": "GBP",
                    "sort_index": 1,
                },
            ],
        }
    )
    _save(db, document_id, job_id, payload)

    with acting_as(db, BOB):
        db.execute(
            "select * from public.apply_transaction_changes(%s, '[]'::jsonb)",
            (document_id,),
        )

    db.execute("reset role")
    row = db.execute(
        "select validation_status, validation->'checks' from public.uploaded_documents "
        "where id = %s",
        (document_id,),
    ).fetchone()
    assert row is not None
    assert row[0] == "insufficient_data"
    currency_check = next(
        check for check in row[1] if check["id"] == "currency_consistency"
    )
    assert currency_check["status"] == "fail"


def test_page_allowance_is_enforced_before_rows_are_saved(
    db: psycopg.Connection,
) -> None:
    document_id, _ = _create_document(db, BOB)
    job_id = _queue(db, BOB, document_id)

    _save(db, document_id, job_id, _payload(page_count=100))

    status, error, _ = _document(db, document_id)
    assert status == "failed"
    assert error is not None and "pages" in error.lower()
    assert db.execute(
        "select count(*) from public.extracted_transactions where document_id = %s",
        (document_id,),
    ).fetchone()[0] == 0
    assert _current_pages(db, BOB) == 0


def test_remaining_allowance_is_cumulative(db: psycopg.Connection) -> None:
    first, _ = _create_document(db, BOB)
    _save(db, first, _queue(db, BOB, first), _payload(page_count=2))
    assert _current_pages(db, BOB) == 2

    second, _ = _create_document(db, BOB)
    _save(db, second, _queue(db, BOB, second), _payload(page_count=2))

    status, error, _ = _document(db, second)
    assert status == "failed"
    assert error is not None and "only 1 of 3 pages" in error
    assert _current_pages(db, BOB) == 2


def test_delete_does_not_refund_processed_pages(db: psycopg.Connection) -> None:
    document_id, _ = _create_document(db, BOB)
    _save(db, document_id, _queue(db, BOB, document_id), _payload(page_count=2))
    assert _current_pages(db, BOB) == 2

    with acting_as(db, BOB):
        path = db.execute(
            "select public.delete_statement(%s)", (document_id,)
        ).fetchone()[0]
    assert path == f"{BOB}/{document_id}/original.pdf"
    assert _current_pages(db, BOB) == 2


def test_late_failure_and_duplicate_save_cannot_overwrite_completed_work(
    db: psycopg.Connection,
) -> None:
    document_id, _ = _create_document(db, BOB)
    job_id = _queue(db, BOB, document_id)
    _save(db, document_id, job_id, _payload(page_count=1))

    with acting_as_service(db):
        db.execute(
            "select public.mark_conversion_failed(%s, 'late timeout')", (job_id,)
        )
        with pytest.raises(psycopg.errors.RaiseException):
            db.execute(
                "select public.save_extraction_result(%s, %s, %s)",
                (document_id, job_id, _payload(page_count=1, transactions=2)),
            )

    status, _, _ = _document(db, document_id)
    assert status == "completed"
    assert db.execute(
        "select count(*) from public.extracted_transactions where document_id = %s",
        (document_id,),
    ).fetchone()[0] == 1
    assert _current_pages(db, BOB) == 1


def test_processing_month_is_charged_not_upload_month(
    db: psycopg.Connection,
) -> None:
    document_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    old_created_at = date.today().replace(day=1) - timedelta(days=20)

    db.execute("reset role")
    db.execute(
        "insert into public.uploaded_documents "
        "(id, user_id, file_name, storage_path, file_size, mime_type, status, created_at) "
        "values (%s, %s, 'last-month.pdf', %s, 1000, 'application/pdf', 'processing', %s)",
        (document_id, BOB, f"{BOB}/{document_id}/original.pdf", old_created_at),
    )
    db.execute(
        "insert into public.conversion_jobs "
        "(id, user_id, document_id, attempt, status) "
        "values (%s, %s, %s, 1, 'processing')",
        (job_id, BOB, document_id),
    )

    _save(db, document_id, job_id, _payload(page_count=1))

    assert _current_pages(db, BOB) == 1
    old_month = db.execute(
        "select coalesce(sum(pages_processed), 0) from public.usage_records "
        "where user_id = %s and period_start = date_trunc('month', %s::date)::date",
        (BOB, old_created_at),
    ).fetchone()[0]
    assert old_month == 0


def test_cross_tenant_storage_path_is_rejected_even_for_a_privileged_writer(
    db: psycopg.Connection,
) -> None:
    document_id = str(uuid.uuid4())

    db.execute("reset role")
    with pytest.raises(psycopg.errors.CheckViolation):
        db.execute(
            "insert into public.uploaded_documents "
            "(id, user_id, file_name, storage_path, file_size, mime_type, status) "
            "values (%s, %s, 'alias.pdf', %s, 1000, 'application/pdf', 'uploaded')",
            (
                document_id,
                BOB,
                f"{ALICE}/{uuid.uuid4()}/original.pdf",
            ),
        )


def test_usage_and_jobs_are_owner_readable_only(db: psycopg.Connection) -> None:
    alice_document, _ = _create_document(db, ALICE)
    _queue(db, ALICE, alice_document)

    with acting_as(db, BOB):
        assert db.execute("select count(*) from public.conversion_jobs").fetchone()[0] == 0
        assert db.execute("select count(*) from public.usage_records").fetchone()[0] == 0
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            db.execute("delete from public.usage_records")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            db.execute("update public.conversion_jobs set status = 'completed'")


def test_storage_objects_are_isolated_by_owner_folder(db: psycopg.Connection) -> None:
    alice_path = f"{ALICE}/{uuid.uuid4()}/original.pdf"
    bob_path = f"{BOB}/{uuid.uuid4()}/original.pdf"

    db.execute("reset role")
    db.execute(
        "insert into storage.objects (bucket_id, name) values "
        "('statements', %s), ('statements', %s)",
        (alice_path, bob_path),
    )

    with acting_as(db, ALICE):
        visible = [
            row[0]
            for row in db.execute(
                "select name from storage.objects where bucket_id = 'statements'"
            ).fetchall()
        ]
        assert visible == [alice_path]
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            db.execute(
                "insert into storage.objects (bucket_id, name) values ('statements', %s)",
                (f"{BOB}/{uuid.uuid4()}/original.pdf",),
            )
        db.execute(
            "delete from storage.objects where name = %s", (bob_path,)
        )

    with acting_as(db, BOB):
        assert db.execute(
            "select count(*) from storage.objects where name = %s", (alice_path,)
        ).fetchone()[0] == 0
        assert db.execute(
            "select count(*) from storage.objects where name = %s", (bob_path,)
        ).fetchone()[0] == 1
