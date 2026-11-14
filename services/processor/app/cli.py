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
    payload = json.dumps(result.to_json(), indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(payload, encoding="utf-8")
    else:
        print(payload)


if __name__ == "__main__":
    main()
