from __future__ import annotations

import argparse
import json
from pathlib import Path

from .extract.pipeline import extract_pdf


def main() -> None:
    parser = argparse.ArgumentParser(description="Run FlowParse extraction on a local PDF.")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--no-ocr", action="store_true")
    parser.add_argument("--tesseract", type=str, default=None)
    args = parser.parse_args()

    data = args.pdf.read_bytes()
    result = extract_pdf(
        data,
        ocr_enabled=not args.no_ocr,
        tesseract_cmd=args.tesseract,
    )
    payload = result.to_json()
    if args.output:
        args.output.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    else:
        # ASCII escaping keeps the CLI usable on Windows terminals whose
        # default code page cannot encode characters such as the minus sign.
        print(json.dumps(payload, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
