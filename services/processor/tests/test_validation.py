from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.extract.models import ParsedTransaction
from app.extract.validation import detect_duplicate_transactions, validate_statement


def _txn(
    *,
    sort_index: int,
    reference: str | None = None,
    balance: Decimal | None = None,
) -> ParsedTransaction:
    return ParsedTransaction(
        date=date(2025, 1, 5),
        description="CARD PAYMENT",
        reference=reference,
        debit=Decimal("12.50"),
        credit=None,
        balance=balance,
        page_number=1,
        sort_index=sort_index,
    )


def test_identical_rows_are_flagged_but_distinct_references_are_not() -> None:
    duplicate = _txn(sort_index=1, reference="REF-1", balance=Decimal("87.50"))
    original = _txn(sort_index=0, reference="REF-1", balance=Decimal("87.50"))
    distinct = _txn(sort_index=2, reference="REF-2")

    transactions = [original, duplicate, distinct]
    assert detect_duplicate_transactions(transactions) == 1
    assert duplicate.needs_review
    assert "Potential duplicate of row 1" in duplicate.review_reasons[0]
    assert not distinct.needs_review


def test_validation_reports_duplicate_check_and_reconciliation() -> None:
    transactions = [_txn(sort_index=0, balance=Decimal("87.50"))]
    validation = validate_statement(
        opening_balance=Decimal("100.00"),
        closing_balance=Decimal("87.50"),
        transactions=transactions,
    )

    assert validation["status"] == "verified"
    assert validation["duplicate_transactions"] == 0
    duplicate_check = next(
        check for check in validation["checks"] if check["id"] == "duplicate_transactions"
    )
    assert duplicate_check["status"] == "pass"
