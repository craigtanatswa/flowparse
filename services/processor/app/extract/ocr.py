from __future__ import annotations

import sys
from pathlib import Path

import fitz
import pytesseract
from PIL import Image, ImageOps
from pytesseract import Output

from .models import OcrUnavailableError, Word


def check_tesseract_available(tesseract_cmd: str | None = None) -> None:
    """Configure Tesseract and raise a user-safe error if it is unavailable."""
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
    elif sys.platform == "win32":
        candidates = (
            Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
            Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
        )
        for candidate in candidates:
            if candidate.exists():
                pytesseract.pytesseract.tesseract_cmd = str(candidate)
                break
    try:
        pytesseract.get_tesseract_version()
    except Exception as exc:  # pragma: no cover - environment specific
        raise OcrUnavailableError(
            "This PDF contains scanned pages, but OCR is not available on the processing server. "
            "Install Tesseract OCR and set TESSERACT_CMD, then try again."
        ) from exc


def ocr_page(
    page: fitz.Page,
    page_number: int,
    *,
    dpi: int,
    language: str,
    tesseract_cmd: str | None,
) -> tuple[list[Word], str, float]:
    """Render a PDF page and return OCR words, text, and mean confidence.

    The returned coordinates are converted back into PDF points so OCR and
    digital pages share the same geometric line/column parser.
    """
    check_tesseract_available(tesseract_cmd)
    pixmap = page.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY, alpha=False)
    image = Image.frombytes("L", (pixmap.width, pixmap.height), pixmap.samples)
    image = ImageOps.autocontrast(image)
    scale = 72.0 / dpi

    data = pytesseract.image_to_data(
        image,
        lang=language,
        config="--oem 1 --psm 6",
        output_type=Output.DICT,
    )
    words: list[Word] = []
    confidences: list[float] = []
    for index, raw_text in enumerate(data.get("text", [])):
        text = (raw_text or "").strip()
        if not text:
            continue
        try:
            confidence = float(data["conf"][index])
        except (KeyError, ValueError, TypeError):
            confidence = 0.0
        if confidence < 20:
            continue
        left = float(data["left"][index]) * scale
        top = float(data["top"][index]) * scale
        width = float(data["width"][index]) * scale
        height = float(data["height"][index]) * scale
        words.append(
            Word(
                text=text,
                x0=left,
                y0=top,
                x1=left + width,
                y1=top + height,
                confidence=confidence,
            )
        )
        confidences.append(confidence)

    text = " ".join(word.text for word in words)
    mean_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    return words, text, mean_confidence
