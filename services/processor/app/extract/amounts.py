from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

from .models import AmountToken, Word

_CURRENCY_SYMBOLS = {
    "£": "GBP",
    "$": "USD",
    "€": "EUR",
    "¥": "JPY",
    "₹": "INR",
    "A$": "AUD",
    "AU$": "AUD",
    "C$": "CAD",
    "CA$": "CAD",
    "US$": "USD",
    "R$": "BRL",
}

_CURRENCY_CODES = {"GBP", "USD", "EUR", "CAD", "AUD", "NZD", "JPY", "INR", "CHF", "ZAR", "SGD", "HKD"}

# Supports 1,234.56 / 1.234,56 / 1234,56 / parentheses / leading or trailing minus /
# currency symbols or ISO codes / CR and DR markers. Two decimal places are
# required for a bare number so dates, account numbers and reference numbers
# are not mistaken for money.
_AMOUNT_RE = re.compile(
    r"^(?P<open>\()?(?P<sign>[-+−])?"
    r"(?P<currency>A\$|AU\$|C\$|CA\$|US\$|R\$|[$£€¥₹]|GBP|USD|EUR|CAD|AUD|NZD|JPY|INR|CHF|ZAR|SGD|HKD)?"
    r"(?P<number>\d[\d.,]*\d|\d)(?P<close>\))?(?P<trail>[-+−])?"
    r"(?P<marker>CR|DR)?(?P<suffix>GBP|USD|EUR|CAD|AUD|NZD|JPY|INR|CHF|ZAR|SGD|HKD)?$",
    re.IGNORECASE,
)


def _normalise_number(raw: str) -> Decimal | None:
    value = raw.strip().replace(" ", "")
    if not value:
        return None

    # 1.234,56 style (European)
    if re.fullmatch(r"\d{1,3}(?:\.\d{3})+,\d{2}", value):
        value = value.replace(".", "").replace(",", ".")
    # 1,234.56 style (Anglo)
    elif re.fullmatch(r"\d{1,3}(?:,\d{3})+\.\d{2}", value):
        value = value.replace(",", "")
    # 1,23,456.78 style (Indian grouping)
    elif re.fullmatch(r"\d{1,2}(?:,\d{2})+,\d{3}(?:\.\d{2})?", value):
        value = value.replace(",", "")
    # 1234,56 style
    elif re.fullmatch(r"\d+,\d{2}", value):
        value = value.replace(",", ".")
    elif re.fullmatch(r"\d+\.\d{2}", value):
        pass
    else:
        return None

    try:
        decimal_value = Decimal(value)
    except InvalidOperation:
        return None
    if decimal_value < 0:
        return None
    return decimal_value.quantize(Decimal("0.01"))


def _currency_for_token(prefix: str | None, suffix: str | None) -> str | None:
    """Resolve an explicit token currency. A bare '$' stays ambiguous."""
    for raw in (prefix, suffix):
        if not raw:
            continue
        upper = raw.upper()
        if upper == "$":
            continue
        if upper in _CURRENCY_SYMBOLS:
            return _CURRENCY_SYMBOLS[upper]
        if upper in _CURRENCY_CODES:
            return upper
    return None


def parse_amount_word(word: Word) -> AmountToken | None:
    text = word.text.strip().replace("\u00a0", "")
    if not text:
        return None

    # Footnotes and stray punctuation are common in bank PDFs.
    text = text.strip("*†‡").rstrip(",;:")
    if text.count("(") != text.count(")") or text.count("-") > 1:
        return None

    match = _AMOUNT_RE.fullmatch(text)
    if not match:
        return None

    prefix = match.group("currency")
    suffix = match.group("suffix")
    has_currency = bool(prefix or suffix)
    number = match.group("number")
    has_decimals = bool(re.search(r"[.,]\d{2}$", number))
    if not has_currency and not has_decimals:
        return None

    value = _normalise_number(number)
    if value is None:
        return None

    negative = bool(match.group("sign") and match.group("sign") in "-−",)
    negative = negative or bool(match.group("open") and match.group("close"))
    negative = negative or bool(match.group("trail") and match.group("trail") in "-−")

    marker = (match.group("marker") or "").upper()
    if marker == "DR":
        negative = True
    if marker == "CR":
        negative = False

    return AmountToken(
        value=value,
        negative=negative,
        credit_marker=marker == "CR",
        raw=text,
        word=word,
        currency=_currency_for_token(prefix, suffix),
    )


def detect_currency(text: str) -> tuple[str | None, bool]:
    """Return (ISO currency, was_ambiguous)."""
    found: list[str] = []
    upper = text.upper()
    explicit_codes = {code for code in _CURRENCY_CODES if re.search(rf"\b{code}\b", upper)}
    found.extend(sorted(explicit_codes))

    remaining = text
    bare_dollar = False
    for symbol in sorted(_CURRENCY_SYMBOLS, key=len, reverse=True):
        if symbol in remaining:
            if symbol == "$":
                bare_dollar = True
            found.append(_CURRENCY_SYMBOLS[symbol])
            remaining = remaining.replace(symbol, " ")

    unique = list(dict.fromkeys(found))
    if not unique:
        return None, True

    if len(unique) == 1:
        return unique[0], bare_dollar and not explicit_codes

    # A dollar sign is ambiguous; prefer explicit ISO codes when present.
    iso = [code for code in unique if code not in {"USD", "AUD", "CAD"}]
    if len(iso) == 1:
        return iso[0], True
    if "GBP" in unique and "USD" not in unique and "AUD" not in unique and "CAD" not in unique:
        return "GBP", False
    return unique[0], True


def is_balance_label(text: str) -> bool:
    lowered = " ".join(text.lower().split())
    patterns = (
        "opening balance",
        "closing balance",
        "balance brought forward",
        "balance brought fwd",
        "balance b/f",
        "balance bfwd",
        "balance b/fwd",
        "balance carried forward",
        "balance carried fwd",
        "balance c/f",
        "balance cfwd",
        "balance forward",
        "starting balance",
        "ending balance",
        "final balance",
        "previous balance",
    )
    return any(pattern in lowered for pattern in patterns)


def is_summary_label(text: str) -> bool:
    lowered = " ".join(text.lower().split())
    if is_balance_label(lowered):
        return True
    patterns = (
        "total debits",
        "total credits",
        "total payments",
        "total receipts",
        "total withdrawals",
        "total deposits",
        "total amount",
        "subtotal",
        "carried forward",
        "brought forward",
        "statement summary",
        "money in",
        "money out",
    )
    return any(lowered.startswith(pattern) or pattern in lowered for pattern in patterns)
