from __future__ import annotations

from .models import ExtractionResult
from .parser import StatementParser
from .pdf_text import read_pdf


def extract_pdf(
    data: bytes,
    *,
    ocr_enabled: bool = True,
    ocr_dpi: int = 300,
    ocr_language: str = "eng",
    tesseract_cmd: str | None = None,
    max_pages: int = 100,
) -> ExtractionResult:
    """Extract a bank statement from raw PDF bytes.

    This function never invents data. A row is returned only when text/amounts
    were actually found in the document; ambiguous rows are retained with review
    flags, and unresolved lines are returned in the extraction report.
    """
    pdf = read_pdf(
        data,
        ocr_enabled=ocr_enabled,
        ocr_dpi=ocr_dpi,
        ocr_language=ocr_language,
        tesseract_cmd=tesseract_cmd,
        max_pages=max_pages,
    )
    parser = StatementParser(pdf)
    return parser.parse()
