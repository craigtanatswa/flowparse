from __future__ import annotations

from decimal import Decimal

from app.extract.amounts import detect_currency, parse_amount_word
from app.extract.models import Word


def _word(text: str) -> Word:
    return Word(text=text, x0=300, y0=400, x1=360, y1=410)


def test_standard_amounts() -> None:
    assert parse_amount_word(_word("1,234.56")).value == Decimal("1234.56")
    assert parse_amount_word(_word("£1,234.56")).value == Decimal("1234.56")
    assert parse_amount_word(_word("0.00")).value == Decimal("0.00")


def test_negative_and_parentheses() -> None:
    leading = parse_amount_word(_word("-82.35"))
    assert leading is not None and leading.negative
    parentheses = parse_amount_word(_word("(82.35)"))
    assert parentheses is not None and parentheses.negative
    trailing = parse_amount_word(_word("82.35-"))
    assert trailing is not None and trailing.negative
    dr = parse_amount_word(_word("82.35DR"))
    assert dr is not None and dr.negative
    cr = parse_amount_word(_word("82.35CR"))
    assert cr is not None and not cr.negative and cr.credit_marker


def test_european_format() -> None:
    assert parse_amount_word(_word("1.234,56")).value == Decimal("1234.56")
    assert parse_amount_word(_word("1234,56")).value == Decimal("1234.56")


def test_rejects_non_money() -> None:
    assert parse_amount_word(_word("31/01/2025")) is None
    assert parse_amount_word(_word("12345678")) is None
    assert parse_amount_word(_word("REF-20250131")) is None


def test_currency_detection() -> None:
    assert detect_currency("Opening balance £1,000.00")[0] == "GBP"
    assert detect_currency("Statement currency: EUR")[0] == "EUR"
    assert detect_currency("Opening balance A$1,000.00")[0] == "AUD"
    assert detect_currency("Opening balance $1,000.00") == ("USD", True)
    assert detect_currency("Opening balance US$1,000.00") == ("USD", False)


def test_iso_codes_and_suffixes() -> None:
    prefixed = parse_amount_word(_word("USD1,234.56"))
    assert prefixed is not None and prefixed.currency == "USD"
    suffixed = parse_amount_word(_word("1.234,56EUR"))
    assert suffixed is not None and suffixed.currency == "EUR"
    ambiguous = parse_amount_word(_word("$1,000.00"))
    assert ambiguous is not None and ambiguous.currency is None


def test_indian_grouping() -> None:
    parsed = parse_amount_word(_word("₹1,23,456.78"))
    assert parsed is not None and parsed.value == Decimal("123456.78")
    assert parsed.currency == "INR"
