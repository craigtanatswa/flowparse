from __future__ import annotations

from decimal import Decimal

from .models import PageData, ParsedTransaction
from .normalisation import normalise_description

# Mean Tesseract confidence below this is treated as low confidence. The row is
# still returned, but flagged for review and the extraction becomes "partial".
OCR_CONFIDENCE_THRESHOLD = 65.0


def _approx_equal(left: Decimal, right: Decimal, tolerance: Decimal = Decimal("0.01")) -> bool:
    return abs(left - right) <= tolerance


def _money_detail(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.01')):,.2f}"


def detect_duplicate_transactions(transactions: list[ParsedTransaction]) -> int:
    """Flag potential duplicate rows in place. Rows are never removed.

    Matching uses date, normalised description, and amount. If both rows carry
    an explicit, different reference, they are treated as distinct. A matching
    running balance is recorded as stronger evidence in the review reason.
    """
    seen: dict[
        tuple[object, str, Decimal | None, Decimal | None, str | None],
        list[ParsedTransaction],
    ] = {}
    flagged = 0

    for transaction in transactions:
        if transaction.date is None:
            continue
        if transaction.debit is None and transaction.credit is None:
            continue
        key = (
            transaction.date,
            normalise_description(transaction.description).casefold(),
            transaction.debit,
            transaction.credit,
            transaction.currency,
        )
        candidates = seen.setdefault(key, [])
        match = next(
            (
                previous
                for previous in candidates
                if not (
                    previous.reference
                    and transaction.reference
                    and previous.reference != transaction.reference
                )
            ),
            None,
        )
        if match is not None:
            reason = (
                f"Potential duplicate of row {match.sort_index + 1}: "
                "same date, description and amount."
            )
            if (
                transaction.balance is not None
                and match.balance is not None
                and transaction.balance == match.balance
            ):
                reason = (
                    f"Potential duplicate of row {match.sort_index + 1}: "
                    "same date, description, amount and running balance."
                )
            if reason not in transaction.review_reasons:
                transaction.review_reasons.append(reason)
            transaction.needs_review = True
            flagged += 1
        candidates.append(transaction)

    return flagged


def assess_extraction_confidence(
    *,
    pages: list[PageData],
    transactions: list[ParsedTransaction],
    unparsed_total: int,
    date_ambiguous: bool,
    currency_ambiguous: bool,
) -> tuple[str, list[str], list[int]]:
    """Return (level, warnings, low_confidence_pages) and flag affected rows."""
    low_pages = sorted(
        page.number
        for page in pages
        if page.method == "ocr"
        and (page.ocr_confidence is not None)
        and page.ocr_confidence < OCR_CONFIDENCE_THRESHOLD
    )
    warnings: list[str] = []

    if low_pages:
        page_list = ", ".join(str(number) for number in low_pages)
        warnings.append(
            f"OCR confidence was low on page(s) {page_list}. "
            "Verify every date and amount on those pages before exporting."
        )
        for transaction in transactions:
            if transaction.page_number in low_pages:
                reason = f"OCR confidence was low on page {transaction.page_number}; verify this row."
                if reason not in transaction.review_reasons:
                    transaction.review_reasons.append(reason)
                transaction.needs_review = True

    if unparsed_total:
        warnings.append(
            f"{unparsed_total} source line(s) could not be interpreted and are listed in the extraction report."
        )

    if low_pages:
        level = "low"
    elif (
        any(page.method == "ocr" for page in pages)
        or unparsed_total
        or date_ambiguous
        or currency_ambiguous
        or any(transaction.needs_review for transaction in transactions)
    ):
        level = "medium"
    else:
        level = "high"

    return level, warnings, low_pages


def validate_statement(
    *,
    opening_balance: Decimal | None,
    closing_balance: Decimal | None,
    transactions: list[ParsedTransaction],
    opening_source: str | None = None,
    closing_source: str | None = None,
    statement_currency: str | None = None,
) -> dict[str, object]:
    """Reconcile extracted rows against the statement's stated balances."""
    total_debits = sum((txn.debit or Decimal("0.00") for txn in transactions), Decimal("0.00"))
    total_credits = sum((txn.credit or Decimal("0.00") for txn in transactions), Decimal("0.00"))
    net = total_credits - total_debits

    opening_derived = opening_source == "derived"
    closing_derived = closing_source == "derived"
    mixed_currency_rows = sum(
        1
        for txn in transactions
        if txn.currency is not None
        and statement_currency is not None
        and txn.currency != statement_currency
    )

    running_failures = sum(
        1
        for txn in transactions
        if any("running balance" in reason.lower() for reason in txn.review_reasons)
    )
    incomplete_rows = sum(
        1
        for txn in transactions
        if txn.date is None or (txn.debit is None and txn.credit is None)
    )
    duplicate_rows = sum(
        1
        for txn in transactions
        if any("potential duplicate" in reason.lower() for reason in txn.review_reasons)
    )

    computed_closing = None
    difference = None
    if opening_balance is not None:
        computed_closing = opening_balance + net
    if computed_closing is not None and closing_balance is not None:
        difference = closing_balance - computed_closing

    checks: list[dict[str, str]] = []
    if opening_balance is not None:
        checks.append(
            {
                "id": "opening_balance",
                "label": "Opening balance identified",
                "status": "pass",
                "detail": (
                    f"{_money_detail(opening_balance)} (derived from the first running balance)"
                    if opening_derived
                    else _money_detail(opening_balance)
                ),
            }
        )
    else:
        checks.append(
            {
                "id": "opening_balance",
                "label": "Opening balance identified",
                "status": "not_available",
                "detail": "No opening balance was found on the statement.",
            }
        )
    if closing_balance is not None:
        checks.append(
            {
                "id": "closing_balance",
                "label": "Closing balance identified",
                "status": "pass",
                "detail": (
                    f"{_money_detail(closing_balance)} (taken from the last running balance)"
                    if closing_derived
                    else _money_detail(closing_balance)
                ),
            }
        )
    else:
        checks.append(
            {
                "id": "closing_balance",
                "label": "Closing balance identified",
                "status": "not_available",
                "detail": "No closing balance was found on the statement.",
            }
        )

    if difference is not None and not opening_derived:
        checks.append(
            {
                "id": "endpoint_reconciliation",
                "label": "Opening balance + credits − debits equals closing balance",
                "status": "pass" if _approx_equal(difference, Decimal("0.00")) else "fail",
                "detail": (
                    "The statement balances reconcile."
                    if _approx_equal(difference, Decimal("0.00"))
                    else f"Difference of {_money_detail(difference)}."
                ),
            }
        )
    elif opening_derived:
        checks.append(
            {
                "id": "endpoint_reconciliation",
                "label": "Opening balance + credits − debits equals closing balance",
                "status": "not_available",
                "detail": (
                    "The opening balance was derived from the first running balance, "
                    "so this is not an independent check."
                ),
            }
        )
    else:
        checks.append(
            {
                "id": "endpoint_reconciliation",
                "label": "Opening balance + credits − debits equals closing balance",
                "status": "not_available",
                "detail": "Both an opening and closing balance are needed for this check.",
            }
        )

    checks.append(
        {
            "id": "running_balance",
            "label": "Running balances reconcile",
            "status": ("pass" if not running_failures else "fail")
            if any(txn.balance is not None for txn in transactions)
            else "not_available",
            "detail": (
                "Every running balance matches the preceding row."
                if not running_failures
                else f"{running_failures} row(s) do not match the preceding balance."
            )
            if any(txn.balance is not None for txn in transactions)
            else "No running balance column was identified.",
        }
    )
    checks.append(
        {
            "id": "row_completeness",
            "label": "Every row has a date and an amount",
            "status": "pass" if incomplete_rows == 0 else "fail",
            "detail": (
                "All extracted rows are complete."
                if incomplete_rows == 0
                else f"{incomplete_rows} row(s) need review."
            ),
        }
    )
    checks.append(
        {
            "id": "duplicate_transactions",
            "label": "No potential duplicate transactions",
            "status": "fail" if duplicate_rows else "pass",
            "detail": (
                f"{duplicate_rows} row(s) look like potential duplicates and were kept for review."
                if duplicate_rows
                else "No duplicate rows were detected."
            ),
        }
    )
    checks.append(
        {
            "id": "currency_consistency",
            "label": "All rows use the statement currency",
            "status": "fail" if mixed_currency_rows else "pass",
            "detail": (
                f"{mixed_currency_rows} row(s) use a different currency; the summary totals mix currencies and were not treated as verified."
                if mixed_currency_rows
                else "Every row uses the statement currency."
            ),
        }
    )

    if difference is None:
        status = "insufficient_data"
    elif not _approx_equal(difference, Decimal("0.00")) or running_failures:
        status = "mismatch"
    elif opening_derived or mixed_currency_rows:
        status = "insufficient_data"
    else:
        status = "verified"

    return {
        "status": status,
        "checks": checks,
        "opening_balance": _decimal_to_float(opening_balance),
        "closing_balance": _decimal_to_float(closing_balance),
        "computed_closing_balance": _decimal_to_float(computed_closing),
        "difference": _decimal_to_float(difference),
        "total_debits": _decimal_to_float(total_debits),
        "total_credits": _decimal_to_float(total_credits),
        "net_change": _decimal_to_float(net),
        "transaction_count": len(transactions),
        "needs_review_count": sum(1 for txn in transactions if txn.needs_review),
        "running_balance_failures": running_failures,
        "incomplete_rows": incomplete_rows,
        "duplicate_transactions": duplicate_rows,
        "mixed_currency_rows": mixed_currency_rows,
    }


def _decimal_to_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value.quantize(Decimal("0.01")))
