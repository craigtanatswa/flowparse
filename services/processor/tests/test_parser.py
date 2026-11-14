from __future__ import annotations

from datetime import date

import fitz
import pytest

from app.extract.banks import detect_bank_name, detect_bank_profile
from app.extract.models import ExtractionError
from app.extract.parser import StatementParser
from app.extract.pdf_text import read_pdf
from app.extract.pipeline import extract_pdf
from tests.fixtures.generate import generate_all


@pytest.fixture(scope="session")
def fixtures():
    return generate_all()


def test_digital_statement(fixtures) -> None:
    result = extract_pdf(fixtures["digital"].read_bytes(), ocr_enabled=False)
    payload = result.to_json()

    assert payload["status"] == "completed", payload["report"]
    assert payload["summary"]["extraction_method"] == "digital"
    assert payload["summary"]["currency"] == "GBP"
    assert payload["summary"]["bank_name"] == "Barclays"
    assert payload["summary"]["account_number_last4"] == "5678"
    assert payload["summary"]["opening_balance"] == 10000.0
    assert payload["summary"]["closing_balance"] == 12270.0
    assert payload["summary"]["statement_start"] == "2025-01-01"
    assert payload["summary"]["statement_end"] == "2025-01-31"

    transactions = payload["transactions"]
    assert len(transactions) == 8
    assert transactions[0]["txn_date"] == "2025-01-02"
    assert transactions[0]["credit"] == 3500.0
    assert transactions[0]["debit"] is None
    assert transactions[0]["balance"] == 13500.0
    assert transactions[3]["debit"] == 1000.0
    assert transactions[7]["credit"] == 1.31
    assert "ENERGY ACCOUNT" in transactions[2]["description"]

    validation = payload["validation"]
    assert validation["status"] == "verified"
    assert validation["total_debits"] == 1256.30
    assert validation["total_credits"] == 3526.30
    assert validation["difference"] == 0.0


def test_us_date_order(fixtures) -> None:
    result = extract_pdf(fixtures["us"].read_bytes(), ocr_enabled=False)
    payload = result.to_json()

    assert payload["summary"]["currency"] == "USD"
    assert payload["summary"]["bank_profile"] == "chase_us"
    assert payload["summary"]["date_order"] == "MDY"
    assert payload["status"] == "completed"
    assert not any("date format" in warning.lower() for warning in payload["report"]["warnings"])
    assert payload["transactions"][0]["txn_date"] == "2025-01-02"
    assert payload["transactions"][-1]["txn_date"] == "2025-01-12"
    assert payload["validation"]["status"] == "verified"


def test_scanned_statement_uses_ocr(fixtures) -> None:
    result = extract_pdf(fixtures["scanned"].read_bytes(), ocr_enabled=True)
    payload = result.to_json()

    assert payload["summary"]["extraction_method"] == "ocr"
    assert payload["report"]["pages"][0]["method"] == "ocr"
    assert len(payload["transactions"]) >= 7
    assert payload["summary"]["closing_balance"] is not None
    assert payload["transactions"][0]["txn_date"] is not None
    assert any("OCR" in warning for warning in payload["report"]["warnings"])


def test_no_ocr_fails_for_scanned_pdf(fixtures) -> None:
    with pytest.raises(ExtractionError):
        extract_pdf(fixtures["scanned"].read_bytes(), ocr_enabled=False)


def test_value_date_and_reference_column(fixtures) -> None:
    payload = extract_pdf(fixtures["value_date"].read_bytes(), ocr_enabled=False).to_json()

    assert payload["status"] == "completed", payload["report"]
    assert payload["summary"]["bank_profile"] == "barclays"
    transactions = payload["transactions"]
    assert len(transactions) == 2
    assert transactions[0]["txn_date"] == "2025-01-02"
    assert transactions[0]["value_date"] == "2025-01-03"
    assert transactions[0]["reference"] == "PAY-001"
    assert transactions[0]["credit"] == 3500.0
    assert transactions[0]["currency"] == "GBP"
    assert transactions[1]["value_date"] == "2025-01-06"
    assert transactions[1]["reference"] == "DD-8891"
    assert transactions[1]["debit"] == 950.0
    assert payload["validation"]["status"] == "verified"


def test_inline_value_date_label(fixtures) -> None:
    payload = extract_pdf(
        fixtures["inline_value_date"].read_bytes(), ocr_enabled=False
    ).to_json()

    assert payload["status"] == "completed", payload["report"]
    transactions = payload["transactions"]
    assert len(transactions) == 2
    assert transactions[0]["txn_date"] == "2025-01-02"
    assert transactions[0]["value_date"] == "2025-01-03"
    assert transactions[0]["description"] == "ACME PAYROLL"
    assert transactions[0]["credit"] == 3500.0
    assert transactions[1]["txn_date"] == "2025-01-04"
    assert transactions[1]["value_date"] == "2025-01-06"
    assert transactions[1]["description"] == "RENT PAYMENT"
    assert transactions[1]["debit"] == 950.0
    assert payload["validation"]["status"] == "verified"


def test_yearless_dates_across_year_end(fixtures) -> None:
    payload = extract_pdf(fixtures["year_end"].read_bytes(), ocr_enabled=False).to_json()

    assert payload["status"] == "completed", payload["report"]
    assert payload["summary"]["statement_start"] == "2024-12-01"
    assert payload["summary"]["statement_end"] == "2025-01-31"
    transactions = payload["transactions"]
    assert len(transactions) == 2
    assert transactions[0]["txn_date"] == "2024-12-05"
    assert transactions[1]["txn_date"] == "2025-01-20"
    assert payload["validation"]["status"] == "verified"


def test_european_dates_and_decimal_formats(fixtures) -> None:
    payload = extract_pdf(fixtures["european"].read_bytes(), ocr_enabled=False).to_json()

    assert payload["status"] == "completed", payload["report"]
    assert payload["summary"]["currency"] == "EUR"
    transactions = payload["transactions"]
    assert len(transactions) == 4
    assert transactions[0]["txn_date"] == "2025-01-02"
    assert transactions[0]["credit"] == 1500.0
    assert transactions[0]["debit"] is None
    assert transactions[1]["txn_date"] == "2025-01-05"
    assert transactions[1]["debit"] == 800.0
    assert transactions[2]["debit"] == 234.56
    assert transactions[3]["credit"] == 12.34
    assert payload["validation"]["computed_closing_balance"] == 1477.78
    assert payload["validation"]["status"] == "verified"


def test_headerless_layout_infers_amount_and_balance(fixtures) -> None:
    payload = extract_pdf(fixtures["headerless"].read_bytes(), ocr_enabled=False).to_json()

    assert payload["status"] == "completed", payload["report"]
    transactions = payload["transactions"]
    assert len(transactions) == 2
    assert transactions[0]["credit"] == 500.0
    assert transactions[0]["balance"] == 1500.0
    assert transactions[1]["debit"] == 200.0
    assert transactions[1]["balance"] == 1300.0
    assert payload["validation"]["status"] == "verified"


def test_duplicate_rows_are_flagged_and_kept(fixtures) -> None:
    payload = extract_pdf(fixtures["duplicates"].read_bytes(), ocr_enabled=False).to_json()

    assert payload["status"] == "partial"
    assert len(payload["transactions"]) == 3
    assert payload["transactions"][0]["needs_review"] is False
    assert payload["transactions"][1]["needs_review"] is True
    assert any(
        "duplicate" in reason.lower()
        for reason in payload["transactions"][1]["review_reasons"]
    )
    assert payload["transactions"][2]["needs_review"] is False
    assert payload["validation"]["duplicate_transactions"] == 1
    assert payload["report"]["confidence"]["duplicate_transactions"] == 1
    assert any("duplicate" in warning.lower() for warning in payload["report"]["warnings"])


def test_unsupported_layout_returns_meaningful_error(fixtures) -> None:
    payload = extract_pdf(fixtures["unsupported"].read_bytes(), ocr_enabled=False).to_json()

    assert payload["status"] == "failed"
    assert payload["transactions"] == []
    assert "unsupported layout" in payload["error_message"].lower()
    assert payload["validation"]["status"] == "insufficient_data"


def test_password_protected_pdf_is_rejected(fixtures, tmp_path) -> None:
    document = fitz.open(fixtures["digital"])
    protected = tmp_path / "protected.pdf"
    document.save(
        str(protected),
        encryption=fitz.PDF_ENCRYPT_AES_256,
        owner_pw="owner-password",
        user_pw="user-password",
    )
    document.close()

    with pytest.raises(ExtractionError, match="password protected"):
        extract_pdf(protected.read_bytes(), ocr_enabled=False)


def test_corrupt_pdf_is_rejected() -> None:
    with pytest.raises(ExtractionError, match="not a valid PDF"):
        extract_pdf(b"this is not a pdf", ocr_enabled=False)
    with pytest.raises(ExtractionError):
        extract_pdf(b"%PDF-1.7\n1 0 obj\nnot a real document", ocr_enabled=False)


def test_low_ocr_confidence_flags_rows_and_partial_status(fixtures) -> None:
    pdf = read_pdf(
        fixtures["digital"].read_bytes(),
        ocr_enabled=False,
        ocr_dpi=300,
        ocr_language="eng",
        tesseract_cmd=None,
        max_pages=100,
    )
    pdf.used_ocr = True
    pdf.used_digital = False
    for page in pdf.pages:
        page.method = "ocr"
        page.ocr_confidence = 30.0

    result = StatementParser(pdf).parse()

    assert result.status == "partial"
    assert result.summary["extraction_confidence"] == "low"
    assert any("OCR confidence was low" in warning for warning in result.report["warnings"])
    assert result.report["confidence"]["level"] == "low"
    assert all(
        any("OCR confidence" in reason for reason in txn.review_reasons)
        for txn in result.transactions
    )


def test_bank_profile_detection() -> None:
    assert detect_bank_profile("BARCLAYS BANK PLC").key == "barclays"
    assert detect_bank_profile("CHASE BANK").key == "chase_us"
    assert detect_bank_profile("EUROPA BANK").key == "generic"
    assert detect_bank_name("Barclays Bank PLC") == "Barclays"
    assert detect_bank_profile("EUROPA BANK").currency is None


def test_progress_reports_real_monotonic_stages(fixtures) -> None:
    updates: list[tuple[str, int]] = []

    result = extract_pdf(
        fixtures["digital"].read_bytes(),
        ocr_enabled=False,
        progress=lambda stage, percent: updates.append((stage, percent)),
    )

    assert result.status == "completed"
    assert len(updates) >= 5
    assert updates[0][0] == "Opening the PDF"
    assert any("Parsing transactions" in stage for stage, _ in updates)
    assert updates[-1][0] == "Preparing the transaction preview"
    assert updates[-1][1] >= 90
    percentages = [percent for _, percent in updates]
    assert percentages == sorted(percentages)
    assert all(0 <= percent <= 100 for percent in percentages)


def test_progress_callback_failure_does_not_break_extraction(fixtures) -> None:
    def explode(_stage: str, _percent: int) -> None:
        raise RuntimeError("progress sink unavailable")

    result = extract_pdf(
        fixtures["digital"].read_bytes(),
        ocr_enabled=False,
        progress=explode,
    )

    assert result.status == "completed"
    assert len(result.transactions) > 0
