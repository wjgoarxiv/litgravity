#!/usr/bin/env python3
"""Lightweight Markdown cleaner for DOCX/PDF conversions.

- Strips pandoc-style attributes on images/links: ![](img.png){width="1in"} -> ![](img.png)
- Ensures a blank line before and after headings and tables
- Collapses 3+ blank lines to 2
- Trims trailing whitespace on all lines
- Leaves UTF-8 untouched
"""

from __future__ import annotations
import re
import sys
from pathlib import Path


def strip_attributes(text: str) -> str:
    # Remove { ... } attribute blocks after images/links/code spans
    return re.sub(r"(\]\([^\)]+\))(\{[^\}]*\})", r"\1", text)


def normalize_blank_lines(text: str) -> str:
    # Collapse 3+ blank lines to max 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def is_table_row(line: str) -> bool:
    stripped = line.strip()
    return stripped.startswith("|") and "|" in stripped[1:]


def ensure_spacing_before_headings_and_tables(lines: list[str]) -> list[str]:
    out: list[str] = []
    for i, line in enumerate(lines):
        stripped = line.lstrip()
        is_heading = stripped.startswith("#")
        table_row = is_table_row(line)
        needs_blank = is_heading or table_row
        if needs_blank and out and out[-1].strip() != "":
            out.append("")
        out.append(line)
    return out


def ensure_spacing_after_blocks(lines: list[str]) -> list[str]:
    out: list[str] = []
    total = len(lines)
    for i, line in enumerate(lines):
        out.append(line)
        stripped = line.lstrip()
        heading = stripped.startswith("#")
        table = is_table_row(line)
        if not heading and not table:
            continue
        next_line = lines[i + 1] if i + 1 < total else ""
        if next_line.strip() == "":
            continue
        out.append("")
    return out


def trim_trailing_whitespace(lines: list[str]) -> list[str]:
    return [ln.rstrip() for ln in lines]


def clean_markdown(src: Path, dst: Path) -> None:
    text = src.read_text(encoding="utf-8")
    text = strip_attributes(text)

    lines = text.splitlines()
    lines = trim_trailing_whitespace(lines)
    lines = ensure_spacing_before_headings_and_tables(lines)
    lines = ensure_spacing_after_blocks(lines)

    text = "\n".join(lines)
    text = normalize_blank_lines(text)

    cleaned = text.strip() + "\n"
    dst.write_text(cleaned, encoding="utf-8")


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("Usage: python clean_markdown.py <input.md> <output.md>")
        return 1
    src = Path(argv[1]).expanduser().resolve()
    dst = Path(argv[2]).expanduser().resolve()
    clean_markdown(src, dst)
    print(f"Cleaned Markdown written to {dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
