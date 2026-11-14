from __future__ import annotations

import re

from .profiles import BANK_PROFILES, GENERIC_PROFILE, KNOWN_BANK_NAMES, BankProfile


def _matches(text: str, alias: str) -> bool:
    pattern = rf"(?<![A-Za-z0-9]){re.escape(alias)}(?![A-Za-z0-9])"
    return re.search(pattern, text, re.IGNORECASE) is not None


def detect_bank_profile(text: str) -> BankProfile:
    """Return the most specific profile whose alias appears in the document."""
    best: BankProfile | None = None
    best_length = 0
    for profile in BANK_PROFILES:
        for alias in profile.aliases:
            if len(alias) > best_length and _matches(text, alias):
                best = profile
                best_length = len(alias)
    return best or GENERIC_PROFILE


def detect_bank_name(text: str) -> str | None:
    """Return a display name, even for banks without a parsing profile."""
    profile = detect_bank_profile(text)
    if profile.key != GENERIC_PROFILE.key:
        return profile.name
    for name in sorted(KNOWN_BANK_NAMES, key=len, reverse=True):
        if _matches(text, name):
            return name
    return None
