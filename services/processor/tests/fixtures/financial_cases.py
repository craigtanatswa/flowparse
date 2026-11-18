"""Financial edge-case PDF fixtures generated at test time.

These layouts deliberately exercise the cases that matter most for financial
accuracy: overdrawn balances, parenthesis negatives, whole (space-grouped)
amounts, reversed debit/credit columns, missing transactions, statements with
no stated balances, multi-page statements without repeated headers, and rows
with an explicit foreign currency.
"""
from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

FIXTURE_DIR = Path(__file__).resolve().parent


def _header(
    c: canvas.Canvas,
    title: str,
    *,
    period: str = "01/01/2025 to 31/01/2025",
    currency: str | None = "GBP",
    top: float = 148,
) -> float:
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(48, height - 56, title)
    c.setFont("Helvetica", 9)
    c.drawString(48, height - 76, "Account Holder: AUDIT USER")
    c.drawString(48, height - 90, "Account Number: 12345678")
    c.drawString(48, height - 104, f"Statement period: {period}")
    if currency:
        c.drawString(48, height - 118, f"Currency: {currency}")
    return height - top


def _columns(
    c: canvas.Canvas,
    y: float,
    labels: tuple[str, str, str] = ("Debit", "Credit", "Balance"),
) -> float:
    c.setFont("Helvetica-Bold", 8)
    c.drawString(48, y, "Date")
    c.drawString(112, y, "Description")
    c.drawRightString(382, y, labels[0])
    c.drawRightString(462, y, labels[1])
    c.drawRightString(545, y, labels[2])
    c.setFont("Helvetica", 9)
    return y - 24


def _row(
    c: canvas.Canvas,
    y: float,
    date_text: str,
    description: str,
    debit: str | None = None,
    credit: str | None = None,
    balance: str | None = None,
    *,
    debit_x: float = 382,
    credit_x: float = 462,
    balance_x: float = 545,
) -> float:
    c.setFont("Helvetica", 9)
    c.drawString(48, y, date_text)
    c.drawString(112, y, description)
    if debit is not None:
        c.drawRightString(debit_x, y, debit)
    if credit is not None:
        c.drawRightString(credit_x, y, credit)
    if balance is not None:
        c.drawRightString(balance_x, y, balance)
    return y - 16


def _balance_row(c: canvas.Canvas, y: float, label: str, amount: str) -> float:
    c.setFont("Helvetica-Bold", 9)
    c.drawString(48, y, label)
    c.drawRightString(545, y, amount)
    c.setFont("Helvetica", 9)
    return y - 22


def make_overdraft_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    y = _columns(c, _header(c, "OVERDRAFT BANK"))
    y = _balance_row(c, y, "Opening Balance", "-250.00")
    y = _row(c, y, "02/01/2025", "CARD PAYMENT", debit="100.00", balance="-350.00")
    y = _row(c, y, "03/01/2025", "REFUND", credit="25.00", balance="-325.00")
    _balance_row(c, y, "Closing Balance", "-325.00")
    c.save()
    return path


def make_parenthesis_negative_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    y = _columns(c, _header(c, "PARENTHESIS BANK"))
    y = _balance_row(c, y, "Opening Balance", "(250.00)")
    y = _row(c, y, "02/01/2025", "CARD PAYMENT", debit="100.00", balance="(350.00)")
    _balance_row(c, y, "Closing Balance", "(350.00)")
    c.save()
    return path


def make_reversed_columns_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    # The credit column is printed on the left and the debit column on the right.
    y = _columns(c, _header(c, "REVERSED BANK"), labels=("Credit", "Debit", "Balance"))
    y = _balance_row(c, y, "Opening Balance", "1,000.00")
    y = _row(c, y, "02/01/2025", "SALARY", credit="500.00", balance="1,500.00", credit_x=382)
    y = _row(c, y, "03/01/2025", "RENT", debit="200.00", balance="1,300.00", debit_x=462)
    _balance_row(c, y, "Closing Balance", "1,300.00")
    c.save()
    return path


def make_missing_transaction_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    y = _columns(c, _header(c, "GAP BANK"))
    y = _balance_row(c, y, "Opening Balance", "1,000.00")
    y = _row(c, y, "02/01/2025", "SALARY", credit="500.00", balance="1,500.00")
    # The printed running balance jumps by 700 even though only 900 is credited:
    # a 200.00 debit row is missing from the document.
    y = _row(c, y, "04/01/2025", "REFUND", credit="900.00", balance="2,200.00")
    _balance_row(c, y, "Closing Balance", "2,200.00")
    c.save()
    return path


def make_no_balances_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(48, height - 56, "NO BALANCE BANK")
    c.setFont("Helvetica", 9)
    c.drawString(48, height - 76, "Account Holder: AUDIT USER")
    c.drawString(48, height - 90, "Statement period: 01/01/2025 to 31/01/2025")
    c.drawString(48, height - 104, "Currency: GBP")
    y = height - 160
    c.setFont("Helvetica", 9)
    c.drawString(48, y, "02/01/2025")
    c.drawString(112, y, "SALARY")
    c.drawRightString(462, y, "500.00")
    c.drawRightString(545, y, "1,500.00")
    y -= 18
    c.drawString(48, y, "03/01/2025")
    c.drawString(112, y, "RENT")
    c.drawRightString(382, y, "200.00")
    c.drawRightString(545, y, "1,300.00")
    c.save()
    return path


def make_multipage_no_repeated_header(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    y = _columns(c, _header(c, "PAGED BANK"))
    y = _balance_row(c, y, "Opening Balance", "1,000.00")
    y = _row(c, y, "02/01/2025", "SALARY", credit="500.00", balance="1,500.00")
    y = _row(c, y, "03/01/2025", "RENT", debit="200.00", balance="1,300.00")
    c.showPage()
    c.setFont("Helvetica", 9)
    c.drawString(48, A4[1] - 40, "PAGED BANK - continued")
    y = A4[1] - 70
    y = _row(c, y, "04/01/2025", "GROCERY", debit="100.00", balance="1,200.00")
    y = _row(c, y, "05/01/2025", "INTEREST", credit="5.00", balance="1,205.00")
    _balance_row(c, y, "Closing Balance", "1,205.00")
    c.save()
    return path


def make_grouped_integers_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    y = _columns(c, _header(c, "WHOLE POUND BANK"))
    y = _balance_row(c, y, "Opening Balance", "10,000")
    y = _row(c, y, "02/01/2025", "SALARY", credit="2,500", balance="12,500")
    y = _row(c, y, "03/01/2025", "RENT", debit="1,000", balance="11,500")
    _balance_row(c, y, "Closing Balance", "11,500")
    c.save()
    return path


def make_space_grouping_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    y = _columns(c, _header(c, "SPACE BANK", currency="EUR"))
    y = _balance_row(c, y, "Opening Balance", "10 000,00")
    c.setFont("Helvetica", 9)
    c.drawString(48, y, "02/01/2025")
    c.drawString(112, y, "SALARY")
    c.drawRightString(462, y, "2 500,00")
    c.drawRightString(545, y, "12 500,00")
    y -= 16
    c.drawString(48, y, "03/01/2025")
    c.drawString(112, y, "RENT")
    c.drawRightString(382, y, "1 000,00")
    c.drawRightString(545, y, "11 500,00")
    y -= 22
    _balance_row(c, y, "Closing Balance", "11 500,00")
    c.save()
    return path


def make_swiss_grouping_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    y = _columns(c, _header(c, "SWISS BANK", currency="CHF"))
    y = _balance_row(c, y, "Opening Balance", "1'000.00")
    y = _row(c, y, "02/01/2025", "SALARY", credit="2'500.00", balance="3'500.00")
    y = _row(c, y, "03/01/2025", "RENT", debit="1'000.00", balance="2'500.00")
    _balance_row(c, y, "Closing Balance", "2'500.00")
    c.save()
    return path


def make_indian_grouping_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    y = _columns(c, _header(c, "INDIA BANK", currency="INR"))
    y = _balance_row(c, y, "Opening Balance", "1,00,000.00")
    y = _row(c, y, "02/01/2025", "SALARY", credit="1,23,456.78", balance="2,23,456.78")
    y = _row(c, y, "03/01/2025", "RENT", debit="10,000.00", balance="2,13,456.78")
    _balance_row(c, y, "Closing Balance", "2,13,456.78")
    c.save()
    return path


def make_mixed_currency_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    y = _columns(c, _header(c, "MIXED BANK", currency="GBP"))
    y = _balance_row(c, y, "Opening Balance", "1,000.00")
    # The statement converts the USD payment itself, so the printed balance
    # moves by exactly 100.00 while the row carries a different currency.
    y = _row(c, y, "02/01/2025", "US SUPPLIER", debit="USD 100.00", balance="900.00")
    y = _row(c, y, "03/01/2025", "SALARY", credit="500.00", balance="1,400.00")
    _balance_row(c, y, "Closing Balance", "1,400.00")
    c.save()
    return path


def make_dr_cr_balance_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    y = _columns(c, _header(c, "DR CR BANK"))
    y = _balance_row(c, y, "Opening Balance", "250.00 DR")
    c.setFont("Helvetica", 9)
    c.drawString(48, y, "02/01/2025")
    c.drawString(112, y, "CARD PAYMENT")
    c.drawRightString(382, y, "100.00")
    c.drawRightString(545, y, "350.00")
    c.setFont("Helvetica-Bold", 8)
    c.drawString(558, y, "DR")
    y -= 16
    c.setFont("Helvetica", 9)
    c.drawString(48, y, "03/01/2025")
    c.drawString(112, y, "REFUND")
    c.drawRightString(462, y, "25.00")
    c.drawRightString(545, y, "325.00")
    c.setFont("Helvetica-Bold", 8)
    c.drawString(558, y, "DR")
    y -= 22
    c.setFont("Helvetica-Bold", 9)
    c.drawString(48, y, "Closing Balance")
    c.drawRightString(545, y, "325.00")
    c.drawString(558, y, "DR")
    c.save()
    return path


def make_noise_description_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    y = _columns(c, _header(c, "NOISE BANK"))
    y = _balance_row(c, y, "Opening Balance", "1,000.00")
    y = _row(
        c,
        y,
        "02/01/2025",
        "PAYMENT TO WWW.AMAZON.COM",
        debit="100.00",
        balance="900.00",
    )
    y = _row(
        c,
        y,
        "03/01/2025",
        "TRANSFER TO CLOSING BALANCE ACCOUNT",
        debit="100.00",
        balance="800.00",
    )
    y = _row(c, y, "04/01/2025", "INTEREST", credit="5.00", balance="805.00")
    _balance_row(c, y, "Closing Balance", "805.00")
    c.save()
    return path


def make_headerless_with_summary_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(48, height - 56, "SUMMARY BANK")
    c.setFont("Helvetica", 9)
    c.drawString(48, height - 76, "Account Holder: AUDIT USER")
    c.drawString(48, height - 90, "Statement period: 01/01/2025 to 31/01/2025")
    c.drawString(48, height - 104, "Currency: GBP")
    y = height - 150
    y = _balance_row(c, y, "Opening Balance", "1,000.00")
    y = _row(c, y, "02/01/2025", "SALARY", credit="500.00", balance="1,500.00")
    y = _row(c, y, "03/01/2025", "RENT", debit="200.00", balance="1,300.00")
    y = _balance_row(c, y, "Closing Balance", "1,300.00")
    c.setFont("Helvetica-Bold", 9)
    c.drawString(48, y, "Total Debits 200.00")
    c.drawRightString(545, y, "Total Credits 500.00")
    c.save()
    return path


def make_bare_dollar_statement(path: Path) -> Path:
    c = canvas.Canvas(str(path), pagesize=A4)
    y = _columns(c, _header(c, "DOLLAR BANK", currency="GBP"))
    y = _balance_row(c, y, "Opening Balance", "1,000.00")
    y = _row(c, y, "02/01/2025", "US SUPPLIER", debit="$100.00", balance="900.00")
    _balance_row(c, y, "Closing Balance", "900.00")
    c.save()
    return path


def generate_financial_cases() -> dict[str, Path]:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    return {
        "overdraft": make_overdraft_statement(FIXTURE_DIR / "overdraft-digital.pdf"),
        "parenthesis_negative": make_parenthesis_negative_statement(
            FIXTURE_DIR / "parenthesis-negative-digital.pdf"
        ),
        "reversed_columns": make_reversed_columns_statement(
            FIXTURE_DIR / "reversed-columns-digital.pdf"
        ),
        "missing_transaction": make_missing_transaction_statement(
            FIXTURE_DIR / "missing-transaction-digital.pdf"
        ),
        "no_balances": make_no_balances_statement(
            FIXTURE_DIR / "no-balances-digital.pdf"
        ),
        "multipage_no_header": make_multipage_no_repeated_header(
            FIXTURE_DIR / "multipage-no-header-digital.pdf"
        ),
        "grouped_integers": make_grouped_integers_statement(
            FIXTURE_DIR / "grouped-integers-digital.pdf"
        ),
        "space_grouping": make_space_grouping_statement(
            FIXTURE_DIR / "space-grouping-digital.pdf"
        ),
        "swiss_grouping": make_swiss_grouping_statement(
            FIXTURE_DIR / "swiss-grouping-digital.pdf"
        ),
        "indian_grouping": make_indian_grouping_statement(
            FIXTURE_DIR / "indian-grouping-digital.pdf"
        ),
        "mixed_currency": make_mixed_currency_statement(
            FIXTURE_DIR / "mixed-currency-digital.pdf"
        ),
        "dr_cr_balance": make_dr_cr_balance_statement(
            FIXTURE_DIR / "dr-cr-balance-digital.pdf"
        ),
        "noise_description": make_noise_description_statement(
            FIXTURE_DIR / "noise-description-digital.pdf"
        ),
        "headerless_summary": make_headerless_with_summary_statement(
            FIXTURE_DIR / "headerless-summary-digital.pdf"
        ),
        "bare_dollar": make_bare_dollar_statement(
            FIXTURE_DIR / "bare-dollar-digital.pdf"
        ),
    }
