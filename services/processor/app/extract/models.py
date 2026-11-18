from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any, Literal

ExtractionStatus = Literal["completed", "partial", "failed"]
ExtractionMethod = Literal["digital", "ocr", "mixed"]
ValidationStatus = Literal["verified", "mismatch", "insufficient_data"]


class ExtractionError(Exception):
    """A user-safe extraction failure."""


class OcrUnavailableError(ExtractionError):
    """Raised when a scanned PDF needs OCR but Tesseract is unavailable."""


@dataclass
class Word:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    confidence: float = 100.0


@dataclass
class Line:
    page: int
    words: list[Word]
    top: float
    bottom: float

    @property
    def text(self) -> str:
        return " ".join(word.text for word in self.words).strip()

    @property
    def x0(self) -> float:
        return self.words[0].x0 if self.words else 0.0

    @property
    def x1(self) -> float:
        return self.words[-1].x1 if self.words else 0.0

    @property
    def confidence(self) -> float:
        if not self.words:
            return 0.0
        return sum(word.confidence for word in self.words) / len(self.words)


@dataclass
class PageData:
    number: int
    width: float
    height: float
    words: list[Word]
    method: Literal["digital", "ocr"]
    text: str = ""
    ocr_confidence: float | None = None


@dataclass
class AmountToken:
    value: Decimal
    negative: bool
    credit_marker: bool
    raw: str
    word: Word
    currency: str | None = None


@dataclass
class ParsedTransaction:
    date: date | None
    description: str
    reference: str | None
    debit: Decimal | None
    credit: Decimal | None
    balance: Decimal | None
    page_number: int
    sort_index: int
    value_date: date | None = None
    currency: str | None = None
    needs_review: bool = False
    review_reasons: list[str] = field(default_factory=list)
    raw_text: str = ""
    # True only when the debit/credit direction came from an explicit column,
    # a sign/CR-DR marker, or a running-balance change. Heuristics and positional
    # guesses stay False so they are never used to derive an opening balance.
    direction_confirmed: bool = False

    def to_json(self) -> dict[str, Any]:
        return {
            "txn_date": self.date.isoformat() if self.date else None,
            "value_date": self.value_date.isoformat() if self.value_date else None,
            "description": self.description,
            "reference": self.reference,
            "debit": _decimal_to_float(self.debit),
            "credit": _decimal_to_float(self.credit),
            "balance": _decimal_to_float(self.balance),
            "currency": self.currency,
            "page_number": self.page_number,
            "sort_index": self.sort_index,
            "needs_review": self.needs_review,
            "review_reasons": self.review_reasons,
            "raw_text": self.raw_text,
        }


@dataclass
class ColumnAnchors:
    date: float | None = None
    value_date: float | None = None
    debit: float | None = None
    credit: float | None = None
    balance: float | None = None
    amount: float | None = None
    description_x: float | None = None
    reference_x: float | None = None


@dataclass
class ExtractionResult:
    status: ExtractionStatus
    summary: dict[str, Any]
    transactions: list[ParsedTransaction]
    validation: dict[str, Any]
    report: dict[str, Any]
    error_message: str | None = None

    def to_json(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "summary": self.summary,
            "transactions": [txn.to_json() for txn in self.transactions],
            "validation": self.validation,
            "report": self.report,
            "error_message": self.error_message,
        }


def _decimal_to_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value.quantize(Decimal("0.01")))
