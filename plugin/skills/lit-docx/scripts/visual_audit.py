#!/usr/bin/env python3
from __future__ import annotations

import os as _os
import sys as _sys

_sys.dont_write_bytecode = True  # the installed skill directory stays read-only
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "..", "lit-pptx", "scripts"))
from office_runtime_bootstrap import ensure_runtime  # noqa: E402

ensure_runtime(["pymupdf"])

import argparse  # noqa: E402
import subprocess  # noqa: E402
from pathlib import Path  # noqa: E402

from render_pages import rasterise, to_pdf  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render a visual audit snapshot (PDF + PNG pages) for DOCX/PDF artifacts")
    parser.add_argument("input", help="Input DOCX or PDF")
    parser.add_argument("--out-dir", required=True, help="Directory for rendered artifacts")
    parser.add_argument("--pages", type=int, default=3, help="How many pages to rasterise (default 3)")
    parser.add_argument("--dpi", type=int, default=110)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source = Path(args.input).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        pdf, how = to_pdf(source, out_dir)
    except (RuntimeError, subprocess.TimeoutExpired) as error:
        print(f"FAIL  {error}", file=_sys.stderr)
        return 1
    if pdf is None:
        print(f"SKIP  {how}; visual audit unavailable — say so instead of claiming a visual check")
        return 0
    pages = rasterise(pdf, out_dir, args.pages, args.dpi)
    print(f"PASS  visual audit render complete -> {out_dir} ({len(pages)} PNG page(s); open them before reporting)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
