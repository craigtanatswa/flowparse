from __future__ import annotations

import re

from .models import AmountToken

_CURRENCY_CODE_RE = re.compile(r"^[A-Z]{3}$")


def normalise_currency(value: str | None) -> str | None:
    """Return a valid ISO-style currency code, or None."""
    if not value:
        return None
    cleaned = value.strip().upper()
    return cleaned if _CURRENCY_CODE_RE.fullmatch(cleaned) else None


def normalise_description(text: str, *, max_length: int = 1000) -> str:
    """Collapse PDF whitespace without rewriting the bank's wording."""
    cleaned = re.sub(r"\s+", " ", text).strip(" -:|")
    cleaned = re.sub(r"\s+([,.;])", r"\1", cleaned)
    return cleaned[:max_length]


def resolve_row_currency(
    tokens: list[AmountToken],
    statement_currency: str | None,
) -> tuple[str | None, list[str]]:
    """Resolve a row's currency without inventing symbols.

    A single explicit currency wins. If a row mixes currencies, keep the
    statement currency and flag the row for review rather than guessing.
    """
    explicit = {token.currency for token in tokens if token.currency}
    if not explicit:
        return statement_currency, []
    if len(explicit) == 1:
        currency = next(iter(explicit))
        if statement_currency and statement_currency != currency:
            return currency, [
                f"Transaction currency {currency} differs from the statement currency {statement_currency}."
            ]
        return currency, []
    return statement_currency, [
        "Multiple currencies were found on this row; the statement currency was used."
    ]
