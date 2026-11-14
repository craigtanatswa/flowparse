from __future__ import annotations

from pathlib import Path

import fitz
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

FIXTURE_DIR = Path(__file__).resolve().parent

OPENING = 10000.00
CLOSING = 12270.00


def _draw_header(c: canvas.Canvas, title: str, period: str, account: str, page: int) -> float:
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(48, height - 56, title)
    c.setFont("Helvetica", 9)
    c.drawString(48, height - 76, "Statement of Account")
    c.drawString(48, height - 90, "Account Holder: ALEX MORGAN")
    c.drawString(48, height - 104, f"Account Number: {account}")
    c.drawString(48, height - 118, f"Statement period: {period}")
    c.drawString(48, height - 130, "Currency: GBP")
    c.setFont("Helvetica", 8)
    c.drawRightString(width - 48, height - 56, f"Page {page}")
    c.setStrokeColorRGB(0.75, 0.75, 0.75)
    c.line(48, height - 142, width - 48, height - 142)

    y = height - 168
    c.setFont("Helvetica-Bold", 8)
    c.drawString(48, y, "Date")
    c.drawString(112, y, "Description")
    c.drawRightString(382, y, "Debit")
    c.drawRightString(462, y, "Credit")
    c.drawRightString(545, y, "Balance")
    c.setFont("Helvetica", 8)
    c.line(48, y - 5, width - 48, y - 5)
    return y - 24


def _row(
    c: canvas.Canvas,
    y: float,
    date_text: str,
    description: str,
    debit: float | None,
    credit: float | None,
    balance: float | None,
    continuation: str | None = None,
) -> float:
    c.setFont("Helvetica", 9)
    c.drawString(48, y, date_text)
    c.drawString(112, y, description)
    if debit is not None:
        c.drawRightString(382, y, f"{debit:,.2f}" if debit else "0.00")
    if credit is not None:
        c.drawRightString(462, y, f"{credit:,.2f}" if credit else "0.00")
    if balance is not None:
        c.drawRightString(545, y, f"{balance:,.2f}")
    y -= 16
    if continuation:
        c.setFillColorRGB(0.3, 0.3, 0.3)
        c.setFont("Helvetica", 8)
        c.drawString(112, y, continuation)
        c.setFillColorRGB(0, 0, 0)
        y -= 14
    return y


def _balance_row(c: canvas.Canvas, y: float, label: str, amount: float) -> float:
    c.setFont("Helvetica-Bold", 9)
    c.drawString(48, y, label)
    c.drawRightString(545, y, f"{amount:,.2f}")
    c.setFont("Helvetica", 9)
    return y - 22


def make_barclays_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4

    y = _draw_header(
        c,
        "BARCLAYS BANK PLC",
        "01/01/2025 to 31/01/2025",
        "12345678",
        1,
    )
    y = _balance_row(c, y, "Opening Balance", OPENING)

    y = _row(c, y, "02/01/2025", "ACME PAYROLL JANUARY", None, 3500.00, 13500.00)
    y = _row(c, y, "03/01/2025", "TESCO STORES 3245", 82.35, None, 13417.65)
    y = _row(
        c,
        y,
        "05/01/2025",
        "DIRECT DEBIT - BRITISH GAS",
        120.00,
        None,
        13297.65,
        continuation="ENERGY ACCOUNT 883726",
    )
    y = _row(c, y, "07/01/2025", "TRANSFER TO SAVINGS", 1000.00, None, 12297.65)

    c.showPage()
    y = _draw_header(
        c,
        "BARCLAYS BANK PLC",
        "01/01/2025 to 31/01/2025",
        "12345678",
        2,
    )
    y = _row(c, y, "12/01/2025", "REFUND FROM AMAZON", None, 24.99, 12322.64)
    y = _row(c, y, "18/01/2025", "WATER BILL", 45.20, None, 12277.44)
    y = _row(c, y, "25/01/2025", "COFFEE SHOP", 8.75, None, 12268.69)
    y = _row(c, y, "31/01/2025", "INTEREST PAID", None, 1.31, CLOSING)
    y = _balance_row(c, y, "Closing Balance", CLOSING)
    c.setFont("Helvetica", 7)
    c.drawString(48, 40, "This is a synthetic test document created for FlowParse parser testing.")
    c.save()
    return path


def make_us_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(48, height - 56, "CHASE BANK")
    c.setFont("Helvetica", 9)
    c.drawString(48, height - 76, "Account Holder: JAMIE LEE")
    c.drawString(48, height - 90, "Account Number: 99887766")
    c.drawString(48, height - 104, "Statement period: 01/01/2025 to 01/12/2025")
    c.drawString(48, height - 118, "Currency: USD")

    y = height - 140
    c.setFont("Helvetica-Bold", 8)
    c.drawString(48, y, "Date")
    c.drawString(112, y, "Description")
    c.drawRightString(382, y, "Debit")
    c.drawRightString(462, y, "Credit")
    c.drawRightString(545, y, "Balance")
    c.setFont("Helvetica", 9)
    y -= 24
    y = _balance_row(c, y, "Opening Balance", 5000.00)
    y = _row(c, y, "01/02/2025", "ONLINE DEPOSIT", None, 2000.00, 7000.00)
    y = _row(c, y, "01/05/2025", "UTILITY PAYMENT", 150.25, None, 6849.75)
    y = _row(c, y, "01/09/2025", "GROCERY STORE", 75.00, None, 6774.75)
    y = _row(c, y, "01/12/2025", "INTEREST CREDIT", None, 12.50, 6787.25)
    y = _balance_row(c, y, "Closing Balance", 6787.25)
    c.save()
    return path


def make_value_date_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(48, height - 56, "BARCLAYS BANK PLC")
    c.setFont("Helvetica", 9)
    c.drawString(48, height - 76, "Account Holder: ALEX MORGAN")
    c.drawString(48, height - 90, "Account Number: 12345678")
    c.drawString(48, height - 104, "Statement period: 01/01/2025 to 31/01/2025")
    c.drawString(48, height - 118, "Currency: GBP")

    y = height - 148
    c.setFont("Helvetica-Bold", 8)
    c.drawString(48, y, "Date")
    c.drawString(104, y, "Value date")
    c.drawString(190, y, "Description")
    c.drawString(380, y, "Reference")
    c.drawRightString(455, y, "Debit")
    c.drawRightString(505, y, "Credit")
    c.drawRightString(548, y, "Balance")
    c.setFont("Helvetica", 9)
    y -= 24

    y = _balance_row(c, y, "Opening Balance", 10000.00)

    def row(
        date_text: str,
        value_text: str,
        description: str,
        reference: str,
        debit: float | None,
        credit: float | None,
        balance: float,
    ) -> None:
        nonlocal y
        c.setFont("Helvetica", 9)
        c.drawString(48, y, date_text)
        c.drawString(104, y, value_text)
        c.drawString(190, y, description)
        c.drawString(380, y, reference)
        if debit is not None:
            c.drawRightString(455, y, f"{debit:,.2f}")
        if credit is not None:
            c.drawRightString(505, y, f"{credit:,.2f}")
        c.drawRightString(548, y, f"{balance:,.2f}")
        y -= 18

    row("02/01/2025", "03/01/2025", "ACME PAYROLL", "PAY-001", None, 3500.00, 13500.00)
    row("04/01/2025", "06/01/2025", "RENT PAYMENT", "DD-8891", 950.00, None, 12550.00)
    y = _balance_row(c, y, "Closing Balance", 12550.00)
    c.setFont("Helvetica", 7)
    c.drawString(48, 40, "Synthetic test document created for FlowParse parser testing.")
    c.save()
    return path


def make_inline_value_date_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(48, height - 56, "METRO BANK")
    c.setFont("Helvetica", 9)
    c.drawString(48, height - 76, "Account Holder: CASEY WU")
    c.drawString(48, height - 90, "Statement period: 01/01/2025 to 31/01/2025")
    c.drawString(48, height - 104, "Currency: GBP")

    y = height - 136
    c.setFont("Helvetica-Bold", 8)
    c.drawString(48, y, "Date")
    c.drawString(220, y, "Description")
    c.drawRightString(382, y, "Debit")
    c.drawRightString(462, y, "Credit")
    c.drawRightString(545, y, "Balance")
    c.setFont("Helvetica", 9)
    y -= 24
    y = _balance_row(c, y, "Opening Balance", 10000.00)

    def row(
        date_text: str,
        value_text: str,
        description: str,
        debit: float | None,
        credit: float | None,
        balance: float,
    ) -> None:
        nonlocal y
        c.setFont("Helvetica", 9)
        c.drawString(48, y, date_text)
        c.drawString(80, y, f"Value date: {value_text}")
        c.drawString(220, y, description)
        if debit is not None:
            c.drawRightString(382, y, f"{debit:,.2f}")
        if credit is not None:
            c.drawRightString(462, y, f"{credit:,.2f}")
        c.drawRightString(545, y, f"{balance:,.2f}")
        y -= 18

    row("02/01/2025", "03/01/2025", "ACME PAYROLL", None, 3500.00, 13500.00)
    row("04/01/2025", "06/01/2025", "RENT PAYMENT", 950.00, None, 12550.00)
    _balance_row(c, y, "Closing Balance", 12550.00)
    c.setFont("Helvetica", 7)
    c.drawString(48, 40, "Synthetic inline value-date document created for FlowParse parser testing.")
    c.save()
    return path


def make_year_end_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(48, height - 56, "YORKSHIRE BANK")
    c.setFont("Helvetica", 9)
    c.drawString(48, height - 76, "Account Holder: MORGAN REID")
    c.drawString(48, height - 90, "Statement period: 01/12/2024 to 31/01/2025")
    c.drawString(48, height - 104, "Currency: GBP")

    y = height - 136
    c.setFont("Helvetica-Bold", 8)
    c.drawString(48, y, "Date")
    c.drawString(112, y, "Description")
    c.drawRightString(382, y, "Debit")
    c.drawRightString(462, y, "Credit")
    c.drawRightString(545, y, "Balance")
    c.setFont("Helvetica", 9)
    y -= 24
    y = _balance_row(c, y, "Opening Balance", 1000.00)
    y = _row(c, y, "05/12", "SALARY PAYMENT", None, 500.00, 1500.00)
    y = _row(c, y, "20/01", "RENT PAYMENT", 200.00, None, 1300.00)
    _balance_row(c, y, "Closing Balance", 1300.00)
    c.setFont("Helvetica", 7)
    c.drawString(48, 40, "Synthetic year-end test document created for FlowParse parser testing.")
    c.save()
    return path


def make_european_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(48, height - 56, "EUROPA BANK")
    c.setFont("Helvetica", 9)
    c.drawString(48, height - 76, "Account Holder: JANA NOVAK")
    c.drawString(48, height - 90, "Statement period: 01.01.2025 to 31.01.2025")
    c.drawString(48, height - 104, "Currency: EUR")

    y = height - 136
    c.setFont("Helvetica-Bold", 8)
    c.drawString(48, y, "Date")
    c.drawString(112, y, "Details")
    c.drawRightString(430, y, "Amount")
    c.drawRightString(548, y, "Balance")
    c.setFont("Helvetica", 9)
    y -= 24

    y = _balance_row(c, y, "Opening Balance", 1000.00)

    def row(date_text: str, description: str, amount: str, balance: str) -> None:
        nonlocal y
        c.setFont("Helvetica", 9)
        c.drawString(48, y, date_text)
        c.drawString(112, y, description)
        c.drawRightString(430, y, amount)
        c.drawRightString(548, y, balance)
        y -= 18

    row("02.01.2025", "GEHALT", "1.500,00", "2.500,00")
    row("05.01.2025", "MIETE", "-800,00", "1.700,00")
    row("09.01.2025", "SUPERMARKT", "-234,56", "1.465,44")
    row("31.01.2025", "ZINSEN", "12,34", "1.477,78")
    _balance_row(c, y, "Closing Balance", 1477.78)
    c.setFont("Helvetica", 7)
    c.drawString(48, 40, "Synthetic EUR test document created for FlowParse parser testing.")
    c.save()
    return path


def make_headerless_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(48, height - 56, "COMMUNITY CREDIT UNION")
    c.setFont("Helvetica", 9)
    c.drawString(48, height - 80, "Account Holder: SAM TAYLOR")
    c.drawString(48, height - 96, "Currency: GBP")
    y = height - 130
    y = _balance_row(c, y, "Opening Balance", 1000.00)
    y = _row(c, y, "23/02/2025", "TRANSFER IN", None, 500.00, 1500.00)
    y = _row(c, y, "27/02/2025", "UTILITY BILL", 200.00, None, 1300.00)
    _balance_row(c, y, "Closing Balance", 1300.00)
    c.setFont("Helvetica", 7)
    c.drawString(48, 40, "Synthetic headerless test document created for FlowParse parser testing.")
    c.save()
    return path


def make_duplicate_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(48, height - 56, "PIONEER BANK")
    c.setFont("Helvetica", 9)
    c.drawString(48, height - 76, "Account Holder: ROBIN HILL")
    c.drawString(48, height - 90, "Statement period: 01/01/2025 to 31/01/2025")
    c.drawString(48, height - 104, "Currency: GBP")

    y = height - 136
    c.setFont("Helvetica-Bold", 8)
    c.drawString(48, y, "Date")
    c.drawString(112, y, "Description")
    c.drawRightString(382, y, "Debit")
    c.drawRightString(462, y, "Credit")
    c.setFont("Helvetica", 9)
    y -= 24

    y = _row(c, y, "05/01/2025", "CARD PAYMENT", 12.50, None, None)
    y = _row(c, y, "05/01/2025", "CARD PAYMENT", 12.50, None, None)
    _row(c, y, "06/01/2025", "CARD PAYMENT", 12.50, None, None)
    c.save()
    return path


def make_unsupported_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(48, height - 56, "NORTHWIND MUTUAL")
    c.setFont("Helvetica", 10)
    c.drawString(48, height - 90, "Statement of Account")
    c.drawString(48, height - 112, "This document contains a letter but no transaction table.")
    c.drawString(48, height - 130, "Please contact customer support if you need a copy of your statement.")
    c.save()
    return path


def make_scanned_copy(source: Path, destination: Path, dpi: int = 220) -> Path:
    original = fitz.open(source)
    scanned = fitz.open()
    for page in original:
        pixmap = page.get_pixmap(dpi=dpi, colorspace=fitz.csRGB, alpha=False)
        target_page = scanned.new_page(width=page.rect.width, height=page.rect.height)
        target_page.insert_image(target_page.rect, pixmap=pixmap)
    scanned.save(destination)
    scanned.close()
    original.close()
    return destination


def generate_all() -> dict[str, Path]:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    barclays = make_barclays_statement(FIXTURE_DIR / "barclays-digital.pdf")
    us = make_us_statement(FIXTURE_DIR / "us-digital.pdf")
    value_date = make_value_date_statement(FIXTURE_DIR / "barclays-value-date.pdf")
    inline_value_date = make_inline_value_date_statement(
        FIXTURE_DIR / "inline-value-date.pdf"
    )
    year_end = make_year_end_statement(FIXTURE_DIR / "year-end-digital.pdf")
    european = make_european_statement(FIXTURE_DIR / "european-digital.pdf")
    headerless = make_headerless_statement(FIXTURE_DIR / "headerless-digital.pdf")
    duplicates = make_duplicate_statement(FIXTURE_DIR / "duplicates-digital.pdf")
    unsupported = make_unsupported_statement(FIXTURE_DIR / "unsupported-digital.pdf")
    scanned = make_scanned_copy(barclays, FIXTURE_DIR / "barclays-scanned.pdf")
    return {
        "digital": barclays,
        "us": us,
        "value_date": value_date,
        "inline_value_date": inline_value_date,
        "year_end": year_end,
        "european": european,
        "headerless": headerless,
        "duplicates": duplicates,
        "unsupported": unsupported,
        "scanned": scanned,
    }


if __name__ == "__main__":
    for name, path in generate_all().items():
        print(f"{name}: {path}")
