from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class BankProfile:
    """Configuration for a bank's statement conventions.

    A profile changes parsing *defaults* only. Explicit evidence in the
    document (for example a USD amount on a Barclays statement) always wins.
    Profiles are intentionally declarative so new banks can be added without
    editing the parser.
    """

    key: str
    name: str
    aliases: tuple[str, ...]
    currency: str | None = None
    date_order: str | None = None
    parser_key: str = "generic"
    credit_hints: tuple[str, ...] = field(default_factory=tuple)
    opening_labels: tuple[str, ...] = field(default_factory=tuple)
    closing_labels: tuple[str, ...] = field(default_factory=tuple)
    noise_patterns: tuple[str, ...] = field(default_factory=tuple)


GENERIC_PROFILE = BankProfile(
    key="generic",
    name="Generic",
    aliases=(),
)

# Conservative domestic defaults: only applied when the document itself does
# not provide a stronger signal. Aliases are deliberately specific so a global
# bank name is not forced into one country's conventions.
BANK_PROFILES: tuple[BankProfile, ...] = (
    BankProfile(
        key="barclays",
        name="Barclays",
        aliases=("Barclays Bank", "Barclays"),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="hsbc_uk",
        name="HSBC",
        aliases=("HSBC UK", "HSBC Bank"),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="lloyds",
        name="Lloyds",
        aliases=("Lloyds Bank", "Lloyds"),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="natwest",
        name="NatWest",
        aliases=("NatWest", "National Westminster Bank"),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="rbs",
        name="Royal Bank of Scotland",
        aliases=("Royal Bank of Scotland", "RBS"),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="santander_uk",
        name="Santander",
        aliases=("Santander UK", "Santander Bank"),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="nationwide",
        name="Nationwide",
        aliases=("Nationwide Building Society", "Nationwide"),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="halifax",
        name="Halifax",
        aliases=("Halifax",),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="bank_of_scotland",
        name="Bank of Scotland",
        aliases=("Bank of Scotland",),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="tsb",
        name="TSB",
        aliases=("TSB Bank", "TSB"),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="cooperative_bank",
        name="Co-operative Bank",
        aliases=("The Co-operative Bank", "Co-operative Bank"),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="virgin_money",
        name="Virgin Money",
        aliases=("Virgin Money",),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="first_direct",
        name="First Direct",
        aliases=("First Direct",),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="monzo",
        name="Monzo",
        aliases=("Monzo Bank", "Monzo"),
        currency="GBP",
        date_order="DMY",
        credit_hints=("pot transfer", "faster payment received"),
    ),
    BankProfile(
        key="starling",
        name="Starling",
        aliases=("Starling Bank", "Starling"),
        currency="GBP",
        date_order="DMY",
        credit_hints=("faster payment received", "interest paid"),
    ),
    BankProfile(
        key="tide",
        name="Tide",
        aliases=("Tide",),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="metro_bank",
        name="Metro Bank",
        aliases=("Metro Bank",),
        currency="GBP",
        date_order="DMY",
    ),
    BankProfile(
        key="chase_us",
        name="Chase",
        aliases=("Chase Bank", "JPMorgan Chase"),
        currency="USD",
        date_order="MDY",
    ),
    BankProfile(
        key="bank_of_america",
        name="Bank of America",
        aliases=("Bank of America",),
        currency="USD",
        date_order="MDY",
    ),
    BankProfile(
        key="wells_fargo",
        name="Wells Fargo",
        aliases=("Wells Fargo",),
        currency="USD",
        date_order="MDY",
    ),
    BankProfile(
        key="capital_one",
        name="Capital One",
        aliases=("Capital One",),
        currency="USD",
        date_order="MDY",
    ),
    BankProfile(
        key="us_bank",
        name="U.S. Bank",
        aliases=("U.S. Bank", "US Bank"),
        currency="USD",
        date_order="MDY",
    ),
    BankProfile(
        key="pnc",
        name="PNC",
        aliases=("PNC Bank", "PNC"),
        currency="USD",
        date_order="MDY",
    ),
    BankProfile(
        key="citibank",
        name="Citibank",
        aliases=("Citibank",),
        currency="USD",
        date_order="MDY",
    ),
    BankProfile(
        key="anz",
        name="ANZ",
        aliases=("ANZ Bank", "ANZ"),
        currency="AUD",
        date_order="DMY",
    ),
    BankProfile(
        key="commonwealth_bank",
        name="Commonwealth Bank",
        aliases=("Commonwealth Bank",),
        currency="AUD",
        date_order="DMY",
    ),
    BankProfile(
        key="westpac",
        name="Westpac",
        aliases=("Westpac",),
        currency="AUD",
        date_order="DMY",
    ),
    BankProfile(
        key="nab",
        name="National Australia Bank",
        aliases=("National Australia Bank", "NAB"),
        currency="AUD",
        date_order="DMY",
    ),
)

# Names used only for display/reporting when a bank has no profile yet. Keeping
# this list separate from BANK_PROFILES makes it obvious which entries affect
# parsing and which are purely cosmetic.
KNOWN_BANK_NAMES: tuple[str, ...] = tuple(
    dict.fromkeys(
        [
            name
            for profile in BANK_PROFILES
            for name in (profile.name, *profile.aliases)
        ]
        + [
            "Revolut",
            "Rabobank",
            "Scotiabank",
            "Deutsche Bank",
            "BNP Paribas",
            "ING",
            "UniCredit",
            "BBVA",
            "UBS",
            "Credit Suisse",
            "TD Bank",
            "RBC",
        ]
    )
)
