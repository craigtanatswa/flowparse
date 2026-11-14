from __future__ import annotations

import re
from datetime import date, datetime
from typing import Iterable

MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}

MONTH_PATTERN = (
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?"
)

# Ordered deliberately: ISO and four-digit years before numeric short forms.
DATE_PREFIX_RE = re.compile(
    r"(?i)^\s*("
    r"\d{4}[/-]\d{1,2}[/-]\d{1,2}"
    r"|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}"
    r"|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2}"
    r"|\d{1,2}(?:st|nd|rd|th)?[\s-]+" + MONTH_PATTERN + r"[\s,-]+\d{2,4}"
    r"|" + MONTH_PATTERN + r"[\s-]+\d{1,2}(?:st|nd|rd|th)?,?[\s-]+\d{2,4}"
    r"|\d{1,2}[/\-.]\d{1,2}"
    r")"
)

NUMERIC_DATE_RE = re.compile(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b")
ISO_DATE_RE = re.compile(r"\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b")
YEARLESS_NUMERIC_RE = re.compile(r"\b(\d{1,2})[/\-.](\d{1,2})\b")
YEARLESS_DATE_RE = re.compile(
    r"(?i)^(?:"
    r"\d{1,2}[/\-.]\d{1,2}"
    r"|\d{1,2}(?:st|nd|rd|th)?[\s-]+" + MONTH_PATTERN +
    r"|" + MONTH_PATTERN + r"[\s-]+\d{1,2}(?:st|nd|rd|th)?,?"
    r")$"
)
MONTH_NAME_DATE_RE = re.compile(
    r"\b(\d{1,2})(?:st|nd|rd|th)?[\s-]+(" + MONTH_PATTERN + r")[\s,-]+(\d{2,4})?\b",
    re.I,
)
MONTH_FIRST_DATE_RE = re.compile(
    r"\b(" + MONTH_PATTERN + r")[\s-]+(\d{1,2})(?:st|nd|rd|th)?[\s,-]+(\d{2,4})?\b",
    re.I,
)

DATE_ORDER = ("DMY", "MDY")


def infer_date_order(texts: Iterable[str], currency: str | None = None) -> tuple[str, bool]:
    """Infer day-first vs month-first. Returns (order, ambiguous)."""
    day_evidence = False
    month_evidence = False
    for text in texts:
        for match in NUMERIC_DATE_RE.finditer(text):
            first = int(match.group(1))
            second = int(match.group(2))
            if first > 12:
                day_evidence = True
            if second > 12:
                month_evidence = True
        if day_evidence and month_evidence:
            break

    if day_evidence and not month_evidence:
        return "DMY", False
    if month_evidence and not day_evidence:
        return "MDY", False
    if currency:
        if currency in {"USD"}:
            return "MDY", True
        if currency in {"GBP", "EUR", "AUD", "NZD", "CHF", "SEK", "NOK", "DKK", "PLN"}:
            return "DMY", True
    return "DMY", True


def _expand_year(value: str) -> int:
    year = int(value)
    if len(value) == 2:
        return 2000 + year if year <= 69 else 1900 + year
    return year


def _safe_date(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def parse_date_value(
    raw: str,
    order: str = "DMY",
    default_year: int | None = None,
) -> tuple[date | None, str | None]:
    """Parse a single date string. Returns (date, error)."""
    value = raw.strip().rstrip(",.").replace("\u2013", "-").replace("\u2014", "-")

    iso = re.fullmatch(r"(\d{4})[/-](\d{1,2})[/-](\d{1,2})", value)
    if iso:
        parsed = _safe_date(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)))
        return (parsed, None) if parsed else (None, "invalid calendar date")

    numeric = re.fullmatch(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})", value)
    if numeric:
        first, second, year_text = numeric.groups()
        day, month = (int(first), int(second)) if order == "DMY" else (int(second), int(first))
        parsed = _safe_date(_expand_year(year_text), month, day)
        return (parsed, None) if parsed else (None, "invalid calendar date")

    yearless = re.fullmatch(r"(\d{1,2})[/\-.](\d{1,2})", value)
    if yearless:
        first, second = yearless.groups()
        day, month = (int(first), int(second)) if order == "DMY" else (int(second), int(first))
        year = default_year or date.today().year
        parsed = _safe_date(year, month, day)
        return (parsed, None) if parsed else (None, "invalid calendar date")

    month_first = re.fullmatch(
        r"(" + MONTH_PATTERN + r")[\s-]+(\d{1,2})(?:st|nd|rd|th)?(?:,?[\s-]+(\d{2,4}))?",
        value,
        re.I,
    )
    if month_first:
        month = MONTHS.get(month_first.group(1).rstrip(".").lower())
        day = int(month_first.group(2))
        year = (
            _expand_year(month_first.group(3))
            if month_first.group(3)
            else (default_year or date.today().year)
        )
        parsed = _safe_date(year, month or 0, day)
        return (parsed, None) if parsed else (None, "invalid calendar date")

    day_first = re.fullmatch(
        r"(\d{1,2})(?:st|nd|rd|th)?[\s-]+(" + MONTH_PATTERN + r")(?:,?[\s-]+(\d{2,4}))?",
        value,
        re.I,
    )
    if day_first:
        day = int(day_first.group(1))
        month = MONTHS.get(day_first.group(2).rstrip(".").lower())
        year = (
            _expand_year(day_first.group(3))
            if day_first.group(3)
            else (default_year or date.today().year)
        )
        parsed = _safe_date(year, month or 0, day)
        return (parsed, None) if parsed else (None, "invalid calendar date")

    return None, "unrecognised date format"


def match_leading_date(text: str) -> re.Match[str] | None:
    return DATE_PREFIX_RE.match(text)


def is_yearless_date(raw: str) -> bool:
    """Return True when a parsed date token had no year of its own."""
    value = raw.strip().rstrip(",.")
    return YEARLESS_DATE_RE.fullmatch(value) is not None


def fit_yearless_date(
    value: date | None,
    raw: str,
    period_start: date | None,
    period_end: date | None,
) -> date | None:
    """Place a yearless date in the statement's year, including year-end spans.

    A statement covering December to January may print rows as ``05/01``. The
    parser starts from the statement start year, so January would otherwise be
    assigned to the previous year. Only yearless tokens are adjusted.
    """
    if value is None or period_start is None or period_end is None:
        return value
    if not is_yearless_date(raw):
        return value

    for year in sorted({period_start.year, period_end.year}):
        try:
            candidate = value.replace(year=year)
        except ValueError:
            continue
        if period_start <= candidate <= period_end:
            return candidate
    return value


def find_all_dates(text: str, order: str, default_year: int | None = None) -> list[date]:
    found: list[date] = []
    for regex in (ISO_DATE_RE, NUMERIC_DATE_RE, MONTH_NAME_DATE_RE, MONTH_FIRST_DATE_RE):
        for match in regex.finditer(text):
            parsed, _ = parse_date_value(match.group(0), order=order, default_year=default_year)
            if parsed:
                found.append(parsed)
    return found


def find_statement_period(
    lines: Iterable[str], order: str, default_year: int | None = None
) -> tuple[date | None, date | None]:
    candidates: list[date] = []
    for line in lines:
        lowered = " ".join(line.lower().split())
        looks_like_period = (
            "statement period" in lowered
            or "period:" in lowered
            or "period " in lowered
            or ("from" in lowered and "to" in lowered)
            or "through" in lowered
            or "opening date" in lowered
            or "closing date" in lowered
        )
        if not looks_like_period:
            continue
        if not any(char.isdigit() for char in line):
            continue
        dates = find_all_dates(line, order=order, default_year=default_year)
        if len(dates) >= 2:
            candidates.extend(dates[:2])
    if len(candidates) >= 2:
        return min(candidates), max(candidates)
    return None, None


def format_date(value: str | date | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value.isoformat()
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").date().isoformat()
    except ValueError:
        return None
