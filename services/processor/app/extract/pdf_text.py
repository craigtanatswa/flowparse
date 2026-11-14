from __future__ import annotations

import re
from dataclasses import dataclass

import fitz

from .models import ExtractionError, Line, PageData, Word
from .ocr import ocr_page
from .progress import ProgressCallback, notify_progress


@dataclass
class PdfText:
    pages: list[PageData]
    page_count: int
    title: str | None
    used_ocr: bool
    used_digital: bool


def _alnum_count(text: str) -> int:
    return len(re.sub(r"[^A-Za-z0-9]", "", text))


def _words_from_pdf(page: fitz.Page, page_number: int) -> list[Word]:
    words: list[Word] = []
    for x0, y0, x1, y1, text, *_ in page.get_text("words"):
        if text.strip():
            words.append(Word(text=text.strip(), x0=x0, y0=y0, x1=x1, y1=y1))
    return words


def build_lines(words: list[Word], page_number: int) -> list[Line]:
    """Group words into visual lines, tolerating slight baseline differences."""
    if not words:
        return []

    ordered = sorted(words, key=lambda word: ((word.y0 + word.y1) / 2, word.x0))
    lines: list[list[Word]] = []
    line_centres: list[float] = []

    for word in ordered:
        centre = (word.y0 + word.y1) / 2
        height = max(word.y1 - word.y0, 4.0)
        tolerance = max(2.2, height * 0.45)
        placed = False
        for index in range(len(lines) - 1, max(len(lines) - 5, -1), -1):
            if abs(centre - line_centres[index]) <= tolerance:
                lines[index].append(word)
                line_centres[index] = sum((w.y0 + w.y1) / 2 for w in lines[index]) / len(lines[index])
                placed = True
                break
        if not placed:
            lines.append([word])
            line_centres.append(centre)

    built: list[Line] = []
    for group in lines:
        group.sort(key=lambda word: word.x0)
        built.append(
            Line(
                page=page_number,
                words=group,
                top=min(word.y0 for word in group),
                bottom=max(word.y1 for word in group),
            )
        )
    built.sort(key=lambda line: (line.top, line.x0))
    return built


def read_pdf(
    data: bytes,
    *,
    ocr_enabled: bool,
    ocr_dpi: int,
    ocr_language: str,
    tesseract_cmd: str | None,
    max_pages: int,
    progress: ProgressCallback | None = None,
) -> PdfText:
    if not data.lstrip().startswith(b"%PDF-"):
        raise ExtractionError("The uploaded file is not a valid PDF document.")

    try:
        document = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise ExtractionError("The PDF could not be opened. It may be damaged or password protected.") from exc

    if document.needs_pass:
        raise ExtractionError("This PDF is password protected. Remove the password and upload it again.")

    page_count = document.page_count
    if page_count == 0:
        raise ExtractionError("The PDF contains no pages.")
    if page_count > max_pages:
        raise ExtractionError(f"This PDF has {page_count} pages. The current limit is {max_pages} pages.")

    notify_progress(progress, "Reading the document", 12)

    pages: list[PageData] = []
    used_ocr = False
    used_digital = False

    for index in range(page_count):
        page = document.load_page(index)
        page_number = index + 1
        page_percent = 12 + round(48 * page_number / page_count)
        digital_text = page.get_text("text")
        words = _words_from_pdf(page, page_number)

        # A real text layer normally has plenty of characters. Pages with only a
        # scanned image (or a tiny page number) are routed through OCR.
        if _alnum_count(digital_text) >= 60 and words:
            pages.append(
                PageData(
                    number=page_number,
                    width=page.rect.width,
                    height=page.rect.height,
                    words=words,
                    method="digital",
                    text=digital_text,
                )
            )
            used_digital = True
            notify_progress(
                progress,
                f"Reading page {page_number} of {page_count}",
                page_percent,
            )
            continue

        if not ocr_enabled:
            raise ExtractionError(
                "This PDF appears to be scanned, but OCR is disabled on the processing server."
            )

        notify_progress(
            progress,
            f"Running OCR on page {page_number} of {page_count}",
            page_percent,
        )
        ocr_words, ocr_text, confidence = ocr_page(
            page,
            page_number,
            dpi=ocr_dpi,
            language=ocr_language,
            tesseract_cmd=tesseract_cmd,
        )
        if not ocr_words:
            camera_ready = page.get_pixmap(dpi=110, alpha=False)
            png = camera_ready.tobytes("png")
            if len(png) < 200:
                raise ExtractionError(
                    f"Page {page_number} appears to be blank and could not be read."
                )
        pages.append(
            PageData(
                number=page_number,
                width=page.rect.width,
                height=page.rect.height,
                words=ocr_words,
                method="ocr",
                text=ocr_text,
                ocr_confidence=confidence,
            )
        )
        used_ocr = True
        notify_progress(
            progress,
            f"Finished OCR for page {page_number} of {page_count}",
            page_percent,
        )

    title = document.metadata.get("title") if document.metadata else None
    document.close()
    return PdfText(
        pages=pages,
        page_count=page_count,
        title=title.strip() if title else None,
        used_ocr=used_ocr,
        used_digital=used_digital,
    )
