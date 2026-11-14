from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from .amounts import (
    detect_currency,
    is_balance_label,
    is_summary_label,
    parse_amount_word,
)
from .banks import BankProfile, detect_bank_name, detect_bank_profile
from .dates import (
    DATE_PREFIX_RE,
    find_statement_period,
    fit_yearless_date,
    infer_date_order,
    match_leading_date,
    parse_date_value,
)
from .models import (
    AmountToken,
    ColumnAnchors,
    ExtractionResult,
    Line,
    ParsedTransaction,
    PageData,
    Word,
)
from .normalisation import normalise_description, resolve_row_currency
from .pdf_text import PdfText, build_lines
from .validation import (
    OCR_CONFIDENCE_THRESHOLD,
    assess_extraction_confidence,
    detect_duplicate_transactions,
    validate_statement,
)

NOISE_PATTERNS = (
    "page ",
    "continued",
    "statement generated",
    "computer generated",
    "this is a computer",
    "registered office",
    "customer service",
    "www.",
    "http",
    "sort code",
    "account number",
    "account no",
)

CATEGORY_WORDS = {
    "date": {"date", "dated", "posted"},
    "value_date": {"value"},
    "description": {"description", "details", "narrative", "transaction", "memo", "payee"},
    "reference": {"reference", "ref"},
    "debit": {"debit", "debits", "withdrawal", "withdrawals", "paidout"},
    "credit": {"credit", "credits", "deposit", "deposits", "paidin"},
    "balance": {"balance"},
    "amount": {"amount"},
}

# Multi-word header labels are resolved before single words so "Value Date"
# does not register the "Date" as a second transaction-date column.
PHRASE_CATEGORIES = (
    ("value date", "value_date"),
    ("value dt", "value_date"),
    ("val date", "value_date"),
    ("transaction date", "date"),
    ("posting date", "date"),
    ("transaction id", "reference"),
    ("transaction ref", "reference"),
    ("reference number", "reference"),
    ("cheque number", "reference"),
    ("check number", "reference"),
    ("card number", "reference"),
)

CREDIT_HINTS = (
    "deposit",
    "salary",
    "interest",
    "refund",
    "cashback",
    "transfer in",
    "received",
    "credit",
    "dividend",
    "rebate",
)

REFERENCE_RE = re.compile(
    r"\b(?:ref(?:erence)?|card(?:\s*no)?)[:\s#-]*([A-Z0-9][A-Z0-9/._-]{3,})",
    re.IGNORECASE,
)


@dataclass
class HeaderInfo:
    anchors: ColumnAnchors
    line_indices: set[int] = field(default_factory=set)
    bottom: float = 0.0


@dataclass
class AmountAssignment:
    debit: Decimal | None
    credit: Decimal | None
    balance: Decimal | None
    reasons: list[str]
    side_source: str


def _centre(word: Word) -> float:
    return (word.x0 + word.x1) / 2


def _strip_punctuation(value: str) -> str:
    return value.strip().strip(".,:;()[]").lower()


def _category_for_word(value: str) -> str | None:
    clean = _strip_punctuation(value)
    compact = clean.replace(" ", "")
    for category, words in CATEGORY_WORDS.items():
        if clean in words or compact in words:
            return category
    return None


def _word_spans(words: list[Word]) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    cursor = 0
    for word in words:
        spans.append((cursor, cursor + len(word.text)))
        cursor += len(word.text) + 1
    return spans


def _word_indices_before(words: list[Word], text_end: int) -> set[int]:
    spans = _word_spans(words)
    return {index for index, (start, _) in enumerate(spans) if start < text_end}


def _categories_for_line(line: Line) -> dict[str, list[Word]]:
    categories: dict[str, list[Word]] = {}
    assigned: set[int] = set()
    normalised = [word.text.strip(".,:;()[]").lower() for word in line.words]

    for phrase, category in PHRASE_CATEGORIES:
        parts = phrase.split()
        size = len(parts)
        for start in range(max(0, len(normalised) - size + 1)):
            if any(index in assigned for index in range(start, start + size)):
                continue
            if normalised[start : start + size] == parts:
                for index in range(start, start + size):
                    categories.setdefault(category, []).append(line.words[index])
                    assigned.add(index)

    for index, word in enumerate(line.words):
        if index in assigned:
            continue
        category = _category_for_word(word.text)
        if category:
            categories.setdefault(category, []).append(word)
    return categories


def detect_header(lines: list[Line]) -> HeaderInfo | None:
    candidates: list[tuple[int, dict[str, list[Word]]]] = []
    for index, line in enumerate(lines):
        if len(line.words) < 2:
            continue
        if match_leading_date(line.text):
            continue
        categories = _categories_for_line(line)
        amount_categories = {"debit", "credit", "balance", "amount"} & categories.keys()
        identity = {"date", "description"} & categories.keys()
        if amount_categories and (identity or len(amount_categories) >= 2):
            candidates.append((index, categories))

    if not candidates:
        return None

    # Prefer the strongest header line and merge labels that wrap onto adjacent lines.
    base_index, base_categories = max(
        candidates,
        key=lambda item: (
            len(item[1]),
            len(" ".join(word.text for word in lines[item[0]].words)),
        ),
    )
    base_line = lines[base_index]
    merged: dict[str, list[Word]] = {key: list(value) for key, value in base_categories.items()}
    line_indices = {base_index}
    for index, categories in candidates:
        if index == base_index:
            continue
        if abs(lines[index].top - base_line.top) <= 32:
            line_indices.add(index)
            for category, words in categories.items():
                merged.setdefault(category, []).extend(words)

    def anchor(category: str) -> float | None:
        words = merged.get(category)
        if not words:
            return None
        return sum(_centre(word) for word in words) / len(words)

    anchors = ColumnAnchors(
        date=anchor("date"),
        value_date=anchor("value_date"),
        debit=anchor("debit"),
        credit=anchor("credit"),
        balance=anchor("balance"),
        amount=anchor("amount"),
        description_x=anchor("description"),
        reference_x=anchor("reference"),
    )
    bottom = max(lines[index].bottom for index in line_indices)
    return HeaderInfo(anchors=anchors, line_indices=line_indices, bottom=bottom)


def _approx_equal(left: Decimal, right: Decimal, tolerance: Decimal = Decimal("0.01")) -> bool:
    return abs(left - right) <= tolerance


def _value_token(token: AmountToken) -> Decimal:
    return -token.value if token.negative else token.value


def assign_amounts(
    tokens: list[AmountToken],
    columns: ColumnAnchors | None,
    previous_balance: Decimal | None,
    context_text: str = "",
    credit_hints: tuple[str, ...] = CREDIT_HINTS,
) -> AmountAssignment:
    reasons: list[str] = []

    if not tokens:
        return AmountAssignment(None, None, None, ["No amount found on this row"], "none")

    # If a column header is available, assign tokens to the nearest money column.
    if columns and any(
        anchor is not None
        for anchor in (columns.debit, columns.credit, columns.balance, columns.amount)
    ):
        anchors = {
            name: value
            for name, value in (
                ("debit", columns.debit),
                ("credit", columns.credit),
                ("balance", columns.balance),
                ("amount", columns.amount),
            )
            if value is not None
        }
        groups: dict[str, list[AmountToken]] = {name: [] for name in anchors}
        for token in tokens:
            nearest = min(anchors, key=lambda name: abs(_centre(token.word) - anchors[name]))
            groups[nearest].append(token)

        balance = groups["balance"][-1].value if groups.get("balance") else None
        debit = None
        credit = None
        side_source = "none"

        if groups.get("debit"):
            debit = groups["debit"][-1].value
            side_source = "column"
        if groups.get("credit"):
            credit = groups["credit"][-1].value
            side_source = "column"

        amount_tokens = groups.get("amount") or []
        if amount_tokens:
            token = amount_tokens[-1]
            signed = _value_token(token)
            if token.negative or token.credit_marker:
                side_source = "sign"
            if signed < 0:
                debit = abs(signed)
            elif token.credit_marker or any(
                hint in context_text.lower() for hint in credit_hints
            ):
                credit = signed
            elif previous_balance is not None and balance is not None:
                diff = balance - previous_balance
                if _approx_equal(diff, signed):
                    credit = signed
                    side_source = "balance"
                elif _approx_equal(diff, -signed):
                    debit = signed
                    side_source = "balance"
                else:
                    debit = signed
                    reasons.append("Debit or credit direction could not be confirmed from the statement layout.")
            else:
                debit = signed
                reasons.append("Debit or credit direction could not be confirmed from the statement layout.")

        # Tokens that were not assigned to a known label still need a home. Handle
        # the common case where only debit/credit headers exist but one token is a balance.
        assigned_ids = {id(token) for group in groups.values() for token in group}
        leftovers = [token for token in tokens if id(token) not in assigned_ids]
        if leftovers and balance is None and len(leftovers) == 1:
            token = leftovers[-1]
            if previous_balance is not None:
                diff = token.value - previous_balance
                if abs(diff) <= Decimal("0.01") and len(tokens) > 1:
                    balance = token.value
                elif abs(diff) <= Decimal("0.01"):
                    pass
                else:
                    balance = token.value
            else:
                balance = token.value

        if debit == Decimal("0.00"):
            debit = None
        if credit == Decimal("0.00"):
            credit = None
        if balance is None and previous_balance is not None and len(tokens) >= 2:
            # With only debit/credit columns the last amount is not a balance.
            pass

        if debit is None and credit is None:
            # Use the rightmost token as an amount if no debit/credit column exists.
            token = tokens[-1]
            signed = _value_token(token)
            if signed < 0:
                debit = abs(signed)
                side_source = "sign"
            elif token.credit_marker:
                credit = signed
                side_source = "sign"
            else:
                debit = signed
                reasons.append("Debit or credit direction could not be confirmed.")
        return AmountAssignment(debit, credit, balance, reasons, side_source)

    values = [(token, _value_token(token)) for token in tokens]
    rightmost_token, rightmost = values[-1]

    if len(tokens) == 1:
        token = tokens[0]
        if token.negative:
            return AmountAssignment(token.value, None, None, reasons, "sign")
        if token.credit_marker:
            return AmountAssignment(None, token.value, None, reasons, "sign")
        if any(hint in context_text.lower() for hint in credit_hints):
            return AmountAssignment(None, token.value, None, "description")
        reasons.append("Debit or credit direction could not be confirmed from the statement layout.")
        return AmountAssignment(token.value, None, None, reasons, "ambiguous")

    if len(tokens) >= 3:
        balance = rightmost
        first, second = tokens[0], tokens[1]
        debit = first.value
        credit = second.value
        side_source = "position"

        if previous_balance is not None:
            diff = balance - previous_balance
            option_a = second.value - first.value
            option_b = first.value - second.value
            if _approx_equal(diff, option_a):
                debit, credit = first.value, second.value
            elif _approx_equal(diff, option_b):
                debit, credit = second.value, first.value
            else:
                reasons.append("Running balance does not match the previous row.")
        elif first.negative:
            debit = first.value
            credit = second.value
        return AmountAssignment(
            debit if debit != Decimal("0.00") else None,
            credit if credit != Decimal("0.00") else None,
            balance,
            reasons,
            side_source,
        )

    # Two amounts. The rightmost is normally the running balance.
    if previous_balance is not None:
        balance = rightmost
        diff = balance - previous_balance
        first = tokens[0]
        signed = _value_token(first)
        if _approx_equal(diff, signed):
            return AmountAssignment(None, abs(signed), balance, reasons, "balance")
        if _approx_equal(diff, -signed):
            return AmountAssignment(abs(signed), None, balance, reasons, "balance")
        if _approx_equal(diff, Decimal("0.00")) and first.value == Decimal("0.00") and tokens[1].value == Decimal("0.00"):
            reasons.append("Row contains no money movement.")
            return AmountAssignment(None, None, balance, reasons, "ambiguous")

        # Likely two money columns without a running balance, or an unreadable
        # balance. Keep the row and flag it for review rather than dropping it.
        debit = tokens[0].value
        credit = tokens[1].value
        reasons.append("Amount and balance columns could not be confirmed.")
        return AmountAssignment(
            debit if debit != Decimal("0.00") else None,
            credit if credit != Decimal("0.00") else None,
            None,
            reasons,
            "ambiguous",
        )

    # First row of a headerless table: treat amount + balance as the most common layout.
    first = tokens[0]
    reasons.append("Statement columns could not be identified from a header; amount and balance were inferred.")
    if first.negative:
        return AmountAssignment(first.value, None, rightmost, reasons, "ambiguous")
    if first.credit_marker:
        return AmountAssignment(None, first.value, rightmost, reasons, "ambiguous")
    return AmountAssignment(first.value, None, rightmost, reasons, "ambiguous")


class StatementParser:
    def __init__(self, pdf: PdfText):
        self.pdf = pdf
        self.lines_by_page = {
            page.number: build_lines(page.words, page.number) for page in pdf.pages
        }
        self.pages_by_number = {page.number: page for page in pdf.pages}
        self.all_text = "\n".join(page.text for page in pdf.pages)
        self.all_lines = [
            line for page in pdf.pages for line in self.lines_by_page.get(page.number, [])
        ]

        self.profile: BankProfile = detect_bank_profile(self.all_text)
        detected_currency, currency_ambiguous = detect_currency(self.all_text)
        if detected_currency is None or (currency_ambiguous and self.profile.currency):
            self.currency = self.profile.currency or detected_currency
            self.currency_ambiguous = not bool(self.currency)
        else:
            self.currency = detected_currency
            self.currency_ambiguous = currency_ambiguous

        evidence_order, date_ambiguous = infer_date_order(
            [page.text for page in pdf.pages], self.currency
        )
        if date_ambiguous and self.profile.date_order:
            self.date_order = self.profile.date_order
            self.date_ambiguous = False
        else:
            self.date_order = evidence_order
            self.date_ambiguous = date_ambiguous

        self.credit_hints = CREDIT_HINTS + self.profile.credit_hints
        self.period_start, self.period_end = find_statement_period(
            [line.text for line in self.all_lines[:400]],
            order=self.date_order,
        )
        self.default_year = self.period_start.year if self.period_start else date.today().year

        self.transactions: list[ParsedTransaction] = []
        self.unparsed_lines: list[dict[str, object]] = []
        self.unparsed_total = 0
        self.duplicate_count = 0
        self.extraction_confidence = "high"
        self.low_confidence_pages: list[int] = []
        self.warnings: list[str] = []
        self.opening_balance: Decimal | None = None
        self.closing_balance: Decimal | None = None
        self.opening_source: str | None = None
        self.closing_source: str | None = None
        self.previous_balance: Decimal | None = None
        self.first_balance_row: ParsedTransaction | None = None
        self.page_stats: dict[int, dict[str, object]] = {
            page.number: {
                "method": page.method,
                "transactions": 0,
                "ocr_confidence": page.ocr_confidence,
            }
            for page in pdf.pages
        }

    # ------------------------------------------------------------------ setup

    def _scan_balances(self) -> None:
        for page in self.pdf.pages:
            lines = self.lines_by_page.get(page.number, [])
            for index, line in enumerate(lines):
                lowered = " ".join(line.text.lower().split())
                is_opening = ("opening" in lowered and "balance" in lowered) or any(
                    label in lowered for label in self.profile.opening_labels
                )
                if is_opening:
                    amount = self._label_amount(line, lines, index)
                    if amount is not None:
                        self.opening_balance = amount
                        self.opening_source = "statement"
                closing_phrases = (
                    "closing balance",
                    "balance carried forward",
                    "balance c/f",
                    "balance c/fwd",
                    "ending balance",
                    "final balance",
                    *self.profile.closing_labels,
                )
                if any(phrase in lowered for phrase in closing_phrases):
                    amount = self._label_amount(line, lines, index)
                    if amount is not None:
                        self.closing_balance = amount
                        self.closing_source = "statement"
                if "balance brought forward" in lowered and self.opening_balance is None:
                    amount = self._label_amount(line, lines, index)
                    if amount is not None:
                        self.opening_balance = amount
                        self.opening_source = "statement"

    def _label_amount(self, line: Line, lines: list[Line], index: int) -> Decimal | None:
        tokens: list[AmountToken] = []
        for word in line.words:
            parsed = parse_amount_word(word)
            if parsed:
                tokens.append(parsed)
        if not tokens and index + 1 < len(lines):
            next_line = lines[index + 1]
            if not match_leading_date(next_line.text):
                for word in next_line.words:
                    parsed = parse_amount_word(word)
                    if parsed:
                        tokens.append(parsed)
        if not tokens:
            return None
        # The balance appears in the rightmost money column.
        return sorted(tokens, key=lambda token: token.word.x0)[-1].value

    # ------------------------------------------------------------------ rows

    def _date_near_anchor(
        self,
        line: Line,
        anchor: float,
        exclude: set[int],
    ) -> tuple[date | None, set[int]]:
        """Find a date token whose x-position belongs to a named column."""
        best: tuple[date, set[int]] | None = None
        best_distance = 80.0
        for start in range(len(line.words)):
            if start in exclude:
                continue
            for length in (3, 2, 1):
                end = start + length
                if end > len(line.words):
                    continue
                if any(index in exclude for index in range(start, end)):
                    continue
                chunk = " ".join(word.text for word in line.words[start:end])
                parsed, _ = parse_date_value(
                    chunk, order=self.date_order, default_year=self.default_year
                )
                parsed = fit_yearless_date(
                    parsed, chunk, self.period_start, self.period_end
                )
                if parsed is None:
                    continue
                centre = (line.words[start].x0 + line.words[end - 1].x1) / 2
                distance = abs(centre - anchor)
                if distance <= best_distance:
                    best = (parsed, set(range(start, end)))
                    best_distance = distance
                break
        return best or (None, set())

    def _row_dates(
        self, line: Line, columns: ColumnAnchors | None
    ) -> tuple[date | None, date | None, str | None, set[int], str]:
        text = line.text
        match = match_leading_date(text)
        if not match:
            return None, None, None, set(), text

        raw = match.group(1)
        parsed, error = parse_date_value(
            raw, order=self.date_order, default_year=self.default_year
        )
        parsed = fit_yearless_date(
            parsed, raw, self.period_start, self.period_end
        )
        text_end = match.end()
        value_date: date | None = None
        low_remainder = text[text_end:].lstrip()
        second_match = DATE_PREFIX_RE.match(low_remainder)
        if second_match:
            second_parsed, _ = parse_date_value(
                second_match.group(1),
                order=self.date_order,
                default_year=self.default_year,
            )
            second_parsed = fit_yearless_date(
                second_parsed,
                second_match.group(1),
                self.period_start,
                self.period_end,
            )
            consumed = len(text[text_end:]) - len(low_remainder) + second_match.end()
            text_end += consumed
            if second_parsed is not None and second_parsed != parsed:
                value_date = second_parsed
        else:
            label = re.match(
                r"(?i)^\s*(?:value|posting|transaction)\s*date\s*[:\-]?\s*",
                low_remainder,
            )
            if label:
                after_label = low_remainder[label.end():]
                date_match = DATE_PREFIX_RE.match(after_label)
                if date_match:
                    parsed_value, _ = parse_date_value(
                        date_match.group(1),
                        order=self.date_order,
                        default_year=self.default_year,
                    )
                    parsed_value = fit_yearless_date(
                        parsed_value,
                        date_match.group(1),
                        self.period_start,
                        self.period_end,
                    )
                    if parsed_value is not None:
                        if parsed_value != parsed:
                            value_date = parsed_value
                        text_end += (
                            len(text[text_end:])
                            - len(low_remainder)
                            + label.end()
                            + date_match.end()
                        )

        removed = _word_indices_before(line.words, text_end)
        if value_date is None and columns is not None and columns.value_date is not None:
            anchor_date, anchor_indices = self._date_near_anchor(
                line, columns.value_date, removed
            )
            if anchor_date is not None and anchor_date != parsed:
                value_date = anchor_date
                removed |= anchor_indices

        remaining = text[text_end:].strip()
        return parsed, value_date, error, removed, remaining

    def _amounts_for_line(
        self,
        line: Line,
        page: PageData,
        skipped_indices: set[int],
        columns: ColumnAnchors | None,
    ) -> list[AmountToken]:
        anchors = [
            anchor
            for anchor in (
                columns.debit if columns else None,
                columns.credit if columns else None,
                columns.balance if columns else None,
                columns.amount if columns else None,
            )
            if anchor is not None
        ]
        minimum_x = page.width * 0.35
        tokens: list[AmountToken] = []
        for index, word in enumerate(line.words):
            if index in skipped_indices:
                continue
            parsed = parse_amount_word(word)
            if not parsed:
                continue
            centre = _centre(word)
            near_column = any(abs(centre - anchor) <= 55 for anchor in anchors)
            if centre >= minimum_x or near_column:
                tokens.append(parsed)
        tokens.sort(key=lambda token: token.word.x0)
        return tokens[-4:]

    def _line_description(
        self,
        line: Line,
        skipped_indices: set[int],
        tokens: list[AmountToken],
    ) -> str:
        amount_word_ids = {id(token.word) for token in tokens}
        words = [
            word.text
            for index, word in enumerate(line.words)
            if index not in skipped_indices and id(word) not in amount_word_ids
        ]
        return " ".join(words).strip()

    def _reference_from_column(
        self, line: Line, columns: ColumnAnchors | None
    ) -> tuple[str | None, set[int]]:
        """Read a reference printed in its own column, if one was detected."""
        if columns is None or columns.reference_x is None:
            return None, set()
        chosen: list[tuple[int, str]] = []
        for index, word in enumerate(line.words):
            if abs(_centre(word) - columns.reference_x) > 55:
                continue
            if parse_amount_word(word) is not None:
                continue
            if is_summary_label(word.text) or is_balance_label(word.text):
                continue
            text = word.text.strip(".,:;()[]")
            if text:
                chosen.append((index, text))
        if not chosen:
            return None, set()
        return " ".join(text for _, text in chosen)[:200], {index for index, _ in chosen}

    def _parse_transaction(
        self,
        *,
        line: Line,
        page: PageData,
        txn_date: date | None,
        value_date: date | None,
        date_error: str | None,
        removed_indices: set[int],
        columns: ColumnAnchors | None,
        no_date_reason: str | None = None,
        prefix_description: str = "",
    ) -> ParsedTransaction | None:
        tokens = self._amounts_for_line(line, page, removed_indices, columns)
        if not tokens:
            return None

        reference_match = REFERENCE_RE.search(line.text)
        if reference_match:
            reference = reference_match.group(1)
            reference_indices: set[int] = set()
        else:
            reference, reference_indices = self._reference_from_column(line, columns)

        description_indices = removed_indices | reference_indices
        description_text = self._line_description(line, description_indices, tokens)
        if prefix_description:
            description_text = f"{prefix_description} {description_text}".strip()

        assignment = assign_amounts(
            tokens,
            columns,
            self.previous_balance,
            description_text,
            credit_hints=self.credit_hints,
        )
        debit = assignment.debit
        credit = assignment.credit
        balance = assignment.balance
        reasons = list(assignment.reasons)

        row_currency, currency_reasons = resolve_row_currency(tokens, self.currency)
        reasons.extend(currency_reasons)

        if assignment.side_source == "ambiguous" and balance is not None and self.previous_balance is not None:
            amount = debit or credit
            if amount:
                diff = balance - self.previous_balance
                if _approx_equal(diff, amount):
                    debit, credit = None, amount
                    reasons = [reason for reason in reasons if "direction" not in reason.lower()]
                elif _approx_equal(diff, -amount):
                    debit, credit = amount, None
                    reasons = [reason for reason in reasons if "direction" not in reason.lower()]

        if txn_date is None:
            reasons.append(date_error or no_date_reason or "No transaction date was found for this row.")
        if description_text.strip() == "":
            reasons.append("No description was found for this row.")

        if debit is not None and debit < 0:
            debit = abs(debit)
        if credit is not None and credit < 0:
            credit = abs(credit)
        if debit == Decimal("0.00"):
            debit = None
        if credit == Decimal("0.00"):
            credit = None

        if debit is None and credit is None:
            self._add_unparsed(line, "Row contained amounts but no usable debit or credit value.")
            return None

        if debit is not None and credit is not None:
            reasons.append("Both a debit and a credit amount were identified.")

        # Validate against the running balance. Keep both values; never correct
        # statement figures silently.
        if balance is not None and self.previous_balance is not None and (
            debit is not None or credit is not None
        ):
            expected = self.previous_balance + (credit or Decimal("0.00")) - (debit or Decimal("0.00"))
            if not _approx_equal(balance, expected):
                reasons.append("Running balance does not match the previous transaction.")

        description = normalise_description(description_text)
        if not description:
            description = "Transaction"

        transaction = ParsedTransaction(
            date=txn_date,
            description=description,
            reference=reference,
            debit=debit,
            credit=credit,
            balance=balance,
            page_number=page.number,
            sort_index=len(self.transactions),
            value_date=value_date,
            currency=row_currency,
            needs_review=bool(reasons),
            review_reasons=list(dict.fromkeys(reasons)),
            raw_text=line.text,
        )
        self.transactions.append(transaction)
        self.page_stats[page.number]["transactions"] = int(
            self.page_stats[page.number].get("transactions", 0)
        ) + 1

        if balance is not None:
            if self.first_balance_row is None:
                self.first_balance_row = transaction
            self.previous_balance = balance
        return transaction

    def _add_unparsed(self, line: Line, reason: str) -> None:
        self.unparsed_total += 1
        if len(self.unparsed_lines) >= 200:
            return
        text = line.text.strip()
        if not text:
            return
        self.unparsed_lines.append(
            {
                "page": line.page,
                "text": text[:500],
                "reason": reason,
            }
        )

    def _is_noise(self, text: str) -> bool:
        lowered = " ".join(text.lower().split())
        patterns = NOISE_PATTERNS + self.profile.noise_patterns
        if any(pattern in lowered for pattern in patterns):
            return True
        if re.fullmatch(r"[\d\s/().,+-]+", lowered):
            return True
        return False

    def _description_looks_like_continuation(
        self, line: Line, page: PageData, columns: ColumnAnchors | None
    ) -> bool:
        if not line.words or len(line.text) < 2:
            return False
        if is_summary_label(line.text) or is_balance_label(line.text):
            return False
        if columns and columns.description_x is not None:
            return line.x0 < max(columns.description_x + 40, page.width * 0.6)
        return line.x0 < page.width * 0.55

    def _process_page(self, page: PageData) -> None:
        lines = self.lines_by_page.get(page.number, [])
        if not lines:
            return
        header = detect_header(lines)
        columns = header.anchors if header else None
        body_start = header.bottom + 1 if header else 0.0
        skip_indices = header.line_indices if header else set()

        pending: dict[str, object] | None = None
        last_transaction_line_bottom: float | None = None

        def flush_pending(reason: str) -> None:
            nonlocal pending
            if pending is not None:
                raw_line = pending.get("line")
                if isinstance(raw_line, Line):
                    self._add_unparsed(raw_line, reason)
                pending = None

        for index, line in enumerate(lines):
            if index in skip_indices:
                continue
            text = line.text.strip()
            if not text:
                continue
            lowered = " ".join(text.lower().split())

            in_body = line.top >= body_start - 2 or header is None
            if not in_body:
                continue

            if is_summary_label(text) and (header is None or line.top >= body_start - 2):
                flush_pending("Dated line did not contain an amount.")
                continue

            if self._is_noise(lowered):
                continue

            txn_date, value_date, date_error, removed, description_text = self._row_dates(
                line, columns
            )
            amounts = self._amounts_for_line(line, page, removed, columns)

            if txn_date is not None or (date_error and amounts):
                flush_pending("Dated line did not contain an amount.")
                if amounts:
                    txn = self._parse_transaction(
                        line=line,
                        page=page,
                        txn_date=txn_date,
                        value_date=value_date,
                        date_error=date_error,
                        removed_indices=removed,
                        columns=columns,
                    )
                    if txn is not None:
                        last_transaction_line_bottom = line.bottom
                elif description_text:
                    pending = {
                        "line": line,
                        "date": txn_date,
                        "value_date": value_date,
                        "date_error": date_error,
                        "removed": removed,
                        "description": description_text,
                        "top": line.top,
                        "bottom": line.bottom,
                    }
                continue

            if pending is not None:
                pending_line = pending["line"]
                assert isinstance(pending_line, Line)
                if amounts:
                    txn = self._parse_transaction(
                        line=line,
                        page=page,
                        txn_date=pending.get("date") if isinstance(pending.get("date"), date) else None,
                        value_date=(
                            pending.get("value_date")
                            if isinstance(pending.get("value_date"), date)
                            else None
                        ),
                        date_error=str(pending.get("date_error") or "") or None,
                        removed_indices=removed,
                        columns=columns,
                        prefix_description=str(pending.get("description") or ""),
                    )
                    if txn is not None:
                        txn.raw_text = f"{pending_line.text}\n{line.text}"
                        last_transaction_line_bottom = line.bottom
                    pending = None
                elif (
                    self._description_looks_like_continuation(line, page, columns)
                    and line.top - float(pending.get("bottom") or 0) <= 24
                ):
                    pending["description"] = (
                        f"{pending.get('description', '')} {description_text}".strip()
                    )
                    pending["bottom"] = line.bottom
                else:
                    flush_pending("Dated line did not contain an amount.")
                continue

            if amounts:
                # A row with amounts but no date is kept with a review flag rather
                # than discarded. This is common when a date is only printed once
                # per group of transactions.
                if len(amounts) == 1 and not header:
                    self._add_unparsed(
                        line, "Row contained an amount but no date or identifiable table columns."
                    )
                    continue
                txn = self._parse_transaction(
                    line=line,
                    page=page,
                    txn_date=None,
                    value_date=None,
                    date_error=None,
                    removed_indices=removed,
                    columns=columns,
                    no_date_reason="No transaction date was found for this row.",
                )
                if txn is not None:
                    last_transaction_line_bottom = line.bottom
                continue

            # Multi-line descriptions that follow a parsed row.
            if (
                self.transactions
                and last_transaction_line_bottom is not None
                and line.top - last_transaction_line_bottom <= 18
                and self._description_looks_like_continuation(line, page, columns)
                and not is_summary_label(text)
            ):
                self.transactions[-1].description = normalise_description(
                    f"{self.transactions[-1].description} {text}"
                )
                self.transactions[-1].raw_text += f"\n{text}"
                last_transaction_line_bottom = line.bottom
                continue

            # Keep potentially meaningful table rows visible for review.
            if header is not None and amounts:
                self._add_unparsed(line, "Row could not be interpreted as a transaction.")

        flush_pending("Dated line did not contain an amount.")

    # ------------------------------------------------------------------ output

    def parse(self) -> ExtractionResult:
        self._scan_balances()
        if self.previous_balance is None and self.opening_balance is not None:
            # A stated opening balance is the only evidence available for
            # deciding direction on the first row of a single-amount layout.
            self.previous_balance = self.opening_balance
        for page in self.pdf.pages:
            self._process_page(page)

        if self.opening_balance is None and self.first_balance_row is not None:
            first = self.first_balance_row
            if first.balance is not None and (first.debit is not None or first.credit is not None):
                self.opening_balance = first.balance - (first.credit or Decimal("0.00")) + (
                    first.debit or Decimal("0.00")
                )
                self.opening_source = "derived"

        last_with_balance = next(
            (txn for txn in reversed(self.transactions) if txn.balance is not None), None
        )
        if self.closing_balance is None and last_with_balance is not None:
            self.closing_balance = last_with_balance.balance
            self.closing_source = "derived"

        self.duplicate_count = detect_duplicate_transactions(self.transactions)
        confidence, confidence_warnings, low_pages = assess_extraction_confidence(
            pages=self.pdf.pages,
            transactions=self.transactions,
            unparsed_total=self.unparsed_total,
            date_ambiguous=self.date_ambiguous,
            currency_ambiguous=self.currency_ambiguous,
        )
        self.extraction_confidence = confidence
        self.low_confidence_pages = low_pages
        self.warnings.extend(confidence_warnings)

        if self.date_ambiguous:
            self.warnings.append(
                f"The date format was ambiguous. Dates were interpreted as {self.date_order}; "
                "review them before exporting."
            )
        if self.currency_ambiguous:
            self.warnings.append(
                "The statement currency could not be confirmed. Amounts are shown without a currency symbol."
            )
        ocr_pages = [page.number for page in self.pdf.pages if page.method == "ocr"]
        if ocr_pages:
            self.warnings.append(
                f"{len(ocr_pages)} page(s) were read using OCR. Verify the figures and dates before exporting."
            )
        if self.duplicate_count:
            self.warnings.append(
                f"{self.duplicate_count} potential duplicate transaction(s) were found and kept for review."
            )
        if self.opening_balance is None or self.closing_balance is None:
            self.warnings.append(
                "Opening and closing balances were not both available, so end-to-end reconciliation is limited."
            )

        method = "digital"
        if self.pdf.used_ocr and self.pdf.used_digital:
            method = "mixed"
        elif self.pdf.used_ocr:
            method = "ocr"

        validation = validate_statement(
            opening_balance=self.opening_balance,
            closing_balance=self.closing_balance,
            transactions=self.transactions,
        )

        if not self.transactions:
            return ExtractionResult(
                status="failed",
                summary=self._summary(method),
                transactions=[],
                validation=validation,
                report=self._report(),
                error_message=(
                    "No transactions could be identified. The PDF may use an unsupported layout, "
                    "or the scan may be too low quality. Try a clearer copy or enter the transactions manually."
                ),
            )

        has_issues = any(txn.needs_review for txn in self.transactions)
        has_mismatch = validation.get("status") == "mismatch"
        status = (
            "partial"
            if has_issues
            or has_mismatch
            or self.unparsed_total
            or self.extraction_confidence != "high"
            else "completed"
        )

        return ExtractionResult(
            status=status,
            summary=self._summary(method),
            transactions=self.transactions,
            validation=validation,
            report=self._report(),
        )

    def _summary(self, method: str) -> dict[str, object]:
        bank_name = detect_bank_name(self.all_text)
        account_match = re.search(
            r"(?i)account\s*(?:number|no\.?|#)\s*[:\-]?\s*([Xx*\d][\dXx*\s-]{3,})",
            self.all_text,
        )
        last4: str | None = None
        if account_match:
            digits = re.sub(r"\D", "", account_match.group(1))
            last4 = digits[-4:] if len(digits) >= 4 else None

        holder_match = re.search(
            r"(?im)^\s*(?:account\s*holder|customer\s*name|account\s*name)\s*[:\-]\s*(.+)$",
            self.all_text,
        )
        account_holder = holder_match.group(1).strip()[:120] if holder_match else None

        return {
            "bank_name": bank_name,
            "account_number_last4": last4,
            "account_holder": account_holder,
            "statement_start": self.period_start.isoformat() if self.period_start else None,
            "statement_end": self.period_end.isoformat() if self.period_end else None,
            "opening_balance": _decimal_to_float(self.opening_balance),
            "closing_balance": _decimal_to_float(self.closing_balance),
            "opening_balance_source": self.opening_source,
            "closing_balance_source": self.closing_source,
            "currency": self.currency,
            "page_count": self.pdf.page_count,
            "extraction_method": method,
            "date_order": self.date_order,
            "bank_profile": self.profile.key,
            "extraction_confidence": self.extraction_confidence,
        }

    def _report(self) -> dict[str, object]:
        return {
            "page_count": self.pdf.page_count,
            "pages": [
                {
                    "page": page.number,
                    "words": len(page.words),
                    **self.page_stats.get(page.number, {}),
                }
                for page in self.pdf.pages
            ],
            "warnings": self.warnings,
            "unparsed_lines": self.unparsed_lines,
            "unparsed_count": self.unparsed_total,
            "unparsed_lines_truncated": self.unparsed_total > len(self.unparsed_lines),
            "date_order": self.date_order,
            "date_format_assumed": self.date_order if self.date_ambiguous else None,
            "opening_balance_source": self.opening_source,
            "closing_balance_source": self.closing_source,
            "bank_profile": self.profile.key,
            "confidence": {
                "level": self.extraction_confidence,
                "ocr_confidence_threshold": OCR_CONFIDENCE_THRESHOLD,
                "low_confidence_pages": self.low_confidence_pages,
                "duplicate_transactions": self.duplicate_count,
            },
        }


def _decimal_to_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value.quantize(Decimal("0.01")))

