from __future__ import annotations

from decimal import Decimal

import pytest

from app.extract.amounts import parse_amount_word, signed_value, standalone_currency
from app.extract.models import Word
from app.extract.pipeline import extract_pdf
from tests.fixtures.financial_cases import generate_financial_cases


@pytest.fixture(scope="session")
def cases():
    return generate_financial_cases()


def _payload(cases, name: str) -> dict:
    return extract_pdf(cases[name].read_bytes(), ocr_enabled=False).to_json()


def _word(text: str) -> Word:
    return Word(text=text, x0=300, y0=400, x1=360, y1=410)


def test_overdraft_balances_keep_their_negative_sign(cases) -> None:
    payload = _payload(cases, "overdraft")

    assert payload["status"] == "completed"
    assert payload["summary"]["opening_balance"] == -250.0
    assert payload["summary"]["closing_balance"] == -325.0
    assert [txn["balance"] for txn in payload["transactions"]] == [-350.0, -325.0]
    assert payload["validation"]["total_debits"] == 100.0
    assert payload["validation"]["total_credits"] == 25.0
    assert payload["validation"]["computed_closing_balance"] == -325.0
    assert payload["validation"]["difference"] == 0.0
    assert payload["validation"]["status"] == "verified"
    assert not any(txn["needs_review"] for txn in payload["transactions"])


def test_parenthesis_negative_balances_keep_their_sign(cases) -> None:
    payload = _payload(cases, "parenthesis_negative")

    assert payload["summary"]["opening_balance"] == -250.0
    assert payload["summary"]["closing_balance"] == -350.0
    assert payload["transactions"][0]["balance"] == -350.0
    assert payload["validation"]["difference"] == 0.0
    assert payload["validation"]["status"] == "verified"


def test_reversed_debit_credit_columns_follow_the_header_labels(cases) -> None:
    payload = _payload(cases, "reversed_columns")

    assert payload["status"] == "completed"
    assert payload["transactions"][0]["credit"] == 500.0
    assert payload["transactions"][0]["debit"] is None
    assert payload["transactions"][1]["debit"] == 200.0
    assert payload["transactions"][1]["credit"] is None
    assert payload["validation"]["total_credits"] == 500.0
    assert payload["validation"]["total_debits"] == 200.0
    assert payload["validation"]["status"] == "verified"


def test_missing_transaction_causes_a_reconciliation_mismatch(cases) -> None:
    payload = _payload(cases, "missing_transaction")

    assert payload["status"] == "partial"
    assert payload["validation"]["status"] == "mismatch"
    # Only the two printed rows are counted, so the statement is 200.00 out.
    assert payload["validation"]["total_credits"] == 1400.0
    assert payload["validation"]["computed_closing_balance"] == 2400.0
    assert payload["validation"]["difference"] == -200.0
    assert any(
        "running balance" in reason.lower()
        for reason in payload["transactions"][1]["review_reasons"]
    )


def test_no_balances_does_not_claim_verified_reconciliation(cases) -> None:
    payload = _payload(cases, "no_balances")

    assert payload["summary"]["opening_balance"] is None
    assert payload["summary"]["opening_balance_source"] is None
    assert payload["validation"]["status"] == "insufficient_data"
    # The first headerless row has no evidence for its direction, so it is kept
    # and flagged instead of being used to derive a circular opening balance.
    assert payload["transactions"][0]["needs_review"] is True
    assert any(
        "direction" in reason.lower()
        for reason in payload["transactions"][0]["review_reasons"]
    )
    endpoint = next(
        check
        for check in payload["validation"]["checks"]
        if check["id"] == "endpoint_reconciliation"
    )
    assert endpoint["status"] == "not_available"


def test_multipage_statement_without_repeated_header(cases) -> None:
    payload = _payload(cases, "multipage_no_header")

    assert payload["status"] == "completed"
    assert len(payload["transactions"]) == 4
    assert [txn["page_number"] for txn in payload["transactions"]] == [1, 1, 2, 2]
    assert payload["validation"]["status"] == "verified"
    assert payload["validation"]["difference"] == 0.0


def test_whole_amount_grouped_integers(cases) -> None:
    payload = _payload(cases, "grouped_integers")

    assert payload["status"] == "completed"
    assert payload["summary"]["opening_balance"] == 10000.0
    assert payload["summary"]["closing_balance"] == 11500.0
    assert payload["transactions"][0]["credit"] == 2500.0
    assert payload["transactions"][1]["debit"] == 1000.0
    assert payload["validation"]["status"] == "verified"


def test_space_grouped_european_amounts(cases) -> None:
    payload = _payload(cases, "space_grouping")

    assert payload["status"] == "completed"
    assert payload["summary"]["opening_balance"] == 10000.0
    assert payload["transactions"][0]["credit"] == 2500.0
    assert payload["transactions"][0]["balance"] == 12500.0
    assert payload["transactions"][0]["description"] == "SALARY"
    assert payload["validation"]["status"] == "verified"


def test_swiss_apostrophe_grouping(cases) -> None:
    payload = _payload(cases, "swiss_grouping")

    assert payload["summary"]["currency"] == "CHF"
    assert payload["transactions"][0]["credit"] == 2500.0
    assert payload["transactions"][1]["debit"] == 1000.0
    assert payload["validation"]["status"] == "verified"


def test_indian_grouping(cases) -> None:
    payload = _payload(cases, "indian_grouping")

    assert payload["summary"]["currency"] == "INR"
    assert payload["transactions"][0]["credit"] == 123456.78
    assert payload["validation"]["total_credits"] == 123456.78
    assert payload["validation"]["status"] == "verified"


def test_row_level_currency_is_taken_from_a_separate_iso_code(cases) -> None:
    payload = _payload(cases, "mixed_currency")

    first = payload["transactions"][0]
    assert first["description"] == "US SUPPLIER"
    assert first["currency"] == "USD"
    assert first["debit"] == 100.0
    assert any(
        "currency" in reason.lower() for reason in first["review_reasons"]
    )
    # The arithmetic happens to reconcile, but the summary mixes currencies, so
    # it must not be presented as verified.
    assert payload["validation"]["status"] == "insufficient_data"
    assert payload["validation"]["difference"] == 0.0
    assert payload["validation"]["mixed_currency_rows"] == 1
    currency_check = next(
        check
        for check in payload["validation"]["checks"]
        if check["id"] == "currency_consistency"
    )
    assert currency_check["status"] == "fail"
    assert any(
        "currency" in warning.lower() for warning in payload["report"]["warnings"]
    )


def test_separate_dr_words_keep_overdrawn_balances_negative(cases) -> None:
    payload = _payload(cases, "dr_cr_balance")

    assert payload["summary"]["opening_balance"] == -250.0
    assert payload["summary"]["closing_balance"] == -325.0
    assert [txn["balance"] for txn in payload["transactions"]] == [-350.0, -325.0]
    assert payload["validation"]["total_debits"] == 100.0
    assert payload["validation"]["total_credits"] == 25.0
    assert payload["validation"]["status"] == "verified"
    assert payload["validation"]["difference"] == 0.0


def test_noise_words_in_a_dated_description_do_not_drop_or_steal_rows(cases) -> None:
    payload = _payload(cases, "noise_description")

    assert payload["status"] == "completed"
    assert len(payload["transactions"]) == 3
    assert payload["transactions"][0]["description"] == "PAYMENT TO WWW.AMAZON.COM"
    assert (
        payload["transactions"][1]["description"]
        == "TRANSFER TO CLOSING BALANCE ACCOUNT"
    )
    assert payload["summary"]["closing_balance"] == 805.0
    assert payload["validation"]["status"] == "verified"


def test_summary_words_are_not_mistaken_for_a_table_header(cases) -> None:
    payload = _payload(cases, "headerless_summary")

    assert payload["status"] == "completed"
    assert len(payload["transactions"]) == 2
    assert payload["validation"]["status"] == "verified"


def test_bare_dollar_is_flagged_on_a_non_usd_statement(cases) -> None:
    payload = _payload(cases, "bare_dollar")

    first = payload["transactions"][0]
    assert first["currency"] == "GBP"
    assert first["needs_review"] is True
    assert any(
        "bare $" in reason.lower() for reason in first["review_reasons"]
    )
    assert payload["status"] == "partial"


def test_money_parser_accepts_grouped_integers_and_apostrophes() -> None:
    assert parse_amount_word(_word("2,500")).value == Decimal("2500.00")
    assert parse_amount_word(_word("10,000")).value == Decimal("10000.00")
    assert parse_amount_word(_word("1.234")).value == Decimal("1234.00")
    assert parse_amount_word(_word("1'234.56")).value == Decimal("1234.56")
    assert parse_amount_word(_word("€1'234.56")).currency == "EUR"
    # A bare ungrouped integer is still not money.
    assert parse_amount_word(_word("12345678")) is None


def test_money_parser_normalises_thin_and_non_breaking_spaces() -> None:
    assert parse_amount_word(_word("1\u00a0234.56")).value == Decimal("1234.56")
    assert parse_amount_word(_word("1\u202f234,56")).value == Decimal("1234.56")
    assert parse_amount_word(_word("1\u2009234,56")).value == Decimal("1234.56")


def test_signed_balance_values() -> None:
    negative = parse_amount_word(_word("(350.00)"))
    assert negative is not None
    assert signed_value(negative) == Decimal("-350.00")
    positive = parse_amount_word(_word("350.00"))
    assert positive is not None
    assert signed_value(positive) == Decimal("350.00")


def test_standalone_currency_resolution() -> None:
    assert standalone_currency("USD") == "USD"
    assert standalone_currency("£") == "GBP"
    assert standalone_currency("$") is None
    assert standalone_currency("TESCO") is None
