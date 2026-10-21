#!/usr/bin/env python3
"""Inline local images into Markdown as data URIs.

Usage:
    python embed_images.py input.md output.md [--root media_dir]

- Finds Markdown images ![alt](path) that point to local files.
- Replaces them with data URIs (base64) so the Markdown is self-contained.
- Leaves http/https/data URIs unchanged.
- Adds filename as alt text when missing.

Note: This can bloat the Markdown size; use only when you need a single-file artifact.
"""
from __future__ import annotations
import argparse
import base64
import mimetypes
import re
from pathlib import Path

IMG_PATTERN = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")


def to_data_uri(path: Path, alt: str) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    if not mime:
        mime = "application/octet-stream"
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    alt_text = alt.strip() or path.stem
    return f"![{alt_text}](data:{mime};base64,{b64})"


def embed_images(md_path: Path, out_path: Path, root: Path | None) -> None:
    text = md_path.read_text(encoding="utf-8")

    def replace(match: re.Match[str]) -> str:
        alt, raw_path = match.group(1), match.group(2)
        if raw_path.startswith("http://") or raw_path.startswith("https://") or raw_path.startswith("data:"):
            return match.group(0)

        candidates = []
        candidates.append((md_path.parent / raw_path).resolve())
        if root:
            candidates.append((root / raw_path).resolve())

        for candidate in candidates:
            if candidate.exists() and candidate.is_file():
                try:
                    return to_data_uri(candidate, alt)
                except Exception:
                    return match.group(0)
        return match.group(0)

    new_text = IMG_PATTERN.sub(replace, text)
    out_path.write_text(new_text, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Inline local images into Markdown as data URIs.")
    p.add_argument("input", help="Source Markdown file")
    p.add_argument("output", help="Output Markdown file")
    p.add_argument("--root", help="Optional root directory for media/ lookup", default=None)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    md_path = Path(args.input).expanduser().resolve()
    out_path = Path(args.output).expanduser().resolve()
    root = Path(args.root).expanduser().resolve() if args.root else None

    embed_images(md_path, out_path, root)
    print(f"Embedded images written to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
