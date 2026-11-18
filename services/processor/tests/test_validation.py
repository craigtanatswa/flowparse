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
    currency: str | None = None,
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
        currency=currency,
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


def test_identical_amounts_in_different_currencies_are_not_duplicates() -> None:
    original = _txn(sort_index=0, currency="GBP")
    foreign = _txn(sort_index=1, currency="USD")

    transactions = [original, foreign]
    assert detect_duplicate_transactions(transactions) == 0
    assert not foreign.needs_review


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


def test_derived_opening_balance_is_not_reported_as_verified() -> None:
    transactions = [_txn(sort_index=0, balance=Decimal("87.50"))]
    validation = validate_statement(
        opening_balance=Decimal("100.00"),
        closing_balance=Decimal("87.50"),
        transactions=transactions,
        opening_source="derived",
        closing_source="statement",
    )

    assert validation["status"] == "insufficient_data"
    endpoint = next(
        check
        for check in validation["checks"]
        if check["id"] == "endpoint_reconciliation"
    )
    assert endpoint["status"] == "not_available"


def test_mixed_currency_totals_are_not_reported_as_verified() -> None:
    transactions = [
        _txn(sort_index=0, currency="USD"),
        _txn(sort_index=1, currency="GBP"),
    ]
    validation = validate_statement(
        opening_balance=Decimal("100.00"),
        closing_balance=Decimal("75.00"),
        transactions=transactions,
        opening_source="statement",
        closing_source="statement",
        statement_currency="GBP",
    )

    assert validation["status"] == "insufficient_data"
    assert validation["mixed_currency_rows"] == 1
    currency_check = next(
        check
        for check in validation["checks"]
        if check["id"] == "currency_consistency"
    )
    assert currency_check["status"] == "fail"
