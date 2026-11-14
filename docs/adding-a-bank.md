# Adding support for a new bank

FlowParse is layout-aware by design. Most statements work without a bank-specific
profile. Add a profile only when a bank has a consistent convention that the
generic parser cannot infer, such as a non-ISO date order or a recurring label
that is not a standard English banking term.

## 1. Prove the gap with a fixture

1. Create a **synthetic** PDF that reproduces the layout. Never commit real
   customer statements, account numbers, or personal data.
2. Add a generator to `services/processor/tests/fixtures/generate.py`.
3. Register it in `generate_all()` so the test suite builds it automatically.
4. Add an assertion that currently fails for the right reason. Run:

   ```bash
   cd services/processor
   .\.venv\Scripts\python.exe -m pytest -q
   ```

A profile should be the last resort. Check first whether:

- the generic header detection can see the columns;
- a date is ambiguous because every date is 12 or below;
- a label is already covered by `NOISE_PATTERNS`, opening/closing phrases, or
  `CREDIT_HINTS` in `app/extract/parser.py`;
- the amount parser already supports the number/currency format.

## 2. Add the profile

Profiles live in `services/processor/app/extract/banks/profiles.py`. A profile
is declarative configuration, not a parser fork:

```python
BankProfile(
    key="example_bank",                 # stable identifier, never a display name
    name="Example Bank",                # used in the UI and exports
    aliases=("Example Bank PLC", "Example Bank"),
    currency="GBP",                     # only a conservative default
    date_order="DMY",                   # only used when the document is ambiguous
    credit_hints=("salary", "refund"),  # optional description phrases
    opening_labels=("balance b/f",),    # optional statement-specific labels
    closing_labels=("balance c/f",),    # optional statement-specific labels
    noise_patterns=("example bank plc",),  # optional repeated page furniture
)
```

Then add it to `BANK_PROFILES` in the same file.

### Rules for conservative defaults

- **Document evidence wins.** A profile currency or date order is only applied
  when the document does not provide a stronger signal. A USD amount on a
  Barclays statement must stay USD.
- **Do not encode a single layout.** Profiles must not contain coordinates,
  column indices, or statement-specific row heuristics. Those belong in the
  generic parser.
- **Keep aliases specific.** `HSBC UK` and `HSBC Bank` are safer than `HSBC`,
  which exists in many countries with different conventions. Add separate
  profiles when the difference matters.
- **Do not add noise patterns that could hide transactions.** Match only
  repeated headers, footers, or legal text.

Detection lives in `services/processor/app/extract/banks/registry.py`; the
longest matching alias wins. `KNOWN_BANK_NAMES` is only for display when no
parsing profile exists, so it does not change extraction behaviour.

## 3. If declarative configuration is not enough

Use `parser_key` on the profile to signal that a future parser extension is
needed. Do not fork `StatementParser` silently. The intended extension point is
a small strategy module that implements layout-specific decisions and returns
the same `ParsedTransaction` objects. The generic parser must remain the
fallback, and every strategy must preserve the same guarantees:

- never invent a transaction;
- never drop a row that contains money movement;
- flag ambiguous dates, amounts, currencies, and duplicates;
- report unresolved source lines;
- never log descriptions, account numbers, or file names.

If you add a strategy, register it explicitly in `app/extract/banks/` and cover
it with a synthetic fixture. Also update this document and the README so the
next contributor can find it.

## 4. What the parser extracts

Each transaction supports:

| Field | Notes |
| --- | --- |
| `txn_date` | Primary transaction date, normalised to `YYYY-MM-DD`; yearless dates are aligned to the statement period |
| `value_date` | Separate value-date column, inline `Value date:` label, or second leading date, optional |
| `description` | Whitespace-normalised, original wording preserved |
| `reference` | Header-driven reference column or explicit reference pattern |
| `debit` / `credit` | Separated using column position, sign, `DR`/`CR`, or running balance |
| `balance` | Running balance when printed |
| `currency` | Row currency when explicit, otherwise the statement currency |

The parser also records `page_number`, `sort_index`, `needs_review`,
`review_reasons`, and `raw_text` for auditability.

## 5. Add tests

At minimum assert:

- status (`completed` vs `partial`);
- extracted dates, including value dates;
- debit/credit separation;
- description and reference preservation;
- row currency;
- reconciliation (`validation.status`, totals, closing balance);
- review flags for anything ambiguous;
- that no rows were dropped.

Run the full suite:

```bash
cd services/processor
.\.venv\Scripts\python.exe -m pytest -q
```

## 6. Update the documentation

- Add the bank to the supported-bank discussion in `README.md` if it is a
  meaningful coverage improvement.
- Note the convention the profile relies on.
- If a new layout class is supported, add it to the extraction-engine section
  and to the manual regression checklist.

## 7. Review checklist

- [ ] Synthetic fixture added and registered in `generate_all()`.
- [ ] Profile uses only conservative defaults.
- [ ] No real customer data in fixtures, logs, or tests.
- [ ] All new ambiguity is flagged, never silently corrected.
- [ ] Duplicate rows are kept and flagged.
- [ ] `pytest` passes.
- [ ] README/docs updated.
