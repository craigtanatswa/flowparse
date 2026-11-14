from __future__ import annotations

from datetime import date

from app.extract.dates import (
    find_statement_period,
    fit_yearless_date,
    infer_date_order,
    is_yearless_date,
    parse_date_value,
)


def test_dmy_and_mdy_parsing() -> None:
    assert parse_date_value("31/01/2025", order="DMY")[0] == date(2025, 1, 31)
    assert parse_date_value("01/31/2025", order="MDY")[0] == date(2025, 1, 31)
    assert parse_date_value("2025-01-31")[0] == date(2025, 1, 31)
    assert parse_date_value("31/01/25", order="DMY")[0] == date(2025, 1, 31)


def test_month_names() -> None:
    assert parse_date_value("02 Jan 2025")[0] == date(2025, 1, 2)
    assert parse_date_value("2 January 25")[0] == date(2025, 1, 2)
    assert parse_date_value("Jan 02, 2025")[0] == date(2025, 1, 2)
    assert parse_date_value("02-Jan-2025")[0] == date(2025, 1, 2)
    assert parse_date_value("Jan-02-2025")[0] == date(2025, 1, 2)


def test_invalid_date() -> None:
    parsed, error = parse_date_value("31/02/2025", order="DMY")
    assert parsed is None
    assert error


def test_yearless_uses_default_year() -> None:
    assert parse_date_value("05/03", order="DMY", default_year=2024)[0] == date(2024, 3, 5)


def test_yearless_dates_align_to_year_end_statement_period() -> None:
    start = date(2024, 12, 1)
    end = date(2025, 1, 31)

    assert is_yearless_date("05/01")
    assert is_yearless_date("5 Jan")
    assert not is_yearless_date("05/01/2025")

    assert fit_yearless_date(date(2024, 1, 5), "05/01", start, end) == date(2025, 1, 5)
    assert fit_yearless_date(date(2024, 12, 5), "05/12", start, end) == date(2024, 12, 5)
    assert fit_yearless_date(date(2024, 1, 5), "5 Jan", start, end) == date(2025, 1, 5)
    # Explicit years are never rewritten, even when outside the period.
    assert fit_yearless_date(
        date(2024, 1, 5), "05/01/2024", start, end
    ) == date(2024, 1, 5)


def test_date_order_evidence() -> None:
    order, ambiguous = infer_date_order(["paid on 31/01/2025"], "GBP")
    assert order == "DMY"
    assert not ambiguous

    order, ambiguous = infer_date_order(["paid on 01/31/2025"], "USD")
    assert order == "MDY"
    assert not ambiguous

    order, ambiguous = infer_date_order(["paid on 01/02/2025"], "USD")
    assert order == "MDY"
    assert ambiguous


def test_statement_period() -> None:
    start, end = find_statement_period(
        ["Statement period: 01/01/2025 to 31/01/2025"], order="DMY"
    )
    assert start == date(2025, 1, 1)
    assert end == date(2025, 1, 31)
