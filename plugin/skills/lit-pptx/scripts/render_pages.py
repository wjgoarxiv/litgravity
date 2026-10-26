#!/usr/bin/env python3
"""Render a .pptx, .docx or .pdf to PNG pages so a person (or the model) can look at it.

LibreOffice (soffice) converts Office files to PDF in a private profile directory,
so parallel runs never share a lock; PyMuPDF rasterises the PDF pages. A PDF input
skips the conversion. Without soffice an Office file cannot be rendered: the script
prints SKIP with the reason and exits 0, and the caller must say that the visual
pass did not happen.

Usage:
    python3 render_pages.py <file> --out-dir DIR [--pages N] [--dpi 110] [--json]

Writes DIR/page-01.png ... and DIR/<stem>.pdf. Exit 1 on a failed conversion.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


def _windows_soffice() -> str | None:
    """LibreOffice's installer does not add itself to PATH on Windows."""
    for variable in ("ProgramFiles", "ProgramFiles(x86)"):
        base = os.environ.get(variable)
        candidate = Path(base) / "LibreOffice" / "program" / "soffice.exe" if base else None
        if candidate and candidate.is_file():
            return str(candidate)
    return None


def profile_fonts(source: Path, profile: Path) -> list[Path]:
    """LibreOffice ignores fonts embedded in a .pptx, so copy each embedded part into the private
    profile's font folder before converting. OpenType and TrueType parts are kept; any other part
    (EOT, obfuscated) is skipped."""
    if source.suffix.lower() != ".pptx":
        return []
    target = profile / "user" / "fonts"
    written = []
    try:
        with zipfile.ZipFile(source) as package:
            for name in package.namelist():
                if not (name.startswith("ppt/fonts/") and name.endswith(".fntdata")):
                    continue
                data = package.read(name)
                if data[:4] == b"OTTO":
                    ext = ".otf"
                elif data[:4] in (b"\x00\x01\x00\x00", b"true"):
                    ext = ".ttf"
                else:
                    continue
                target.mkdir(parents=True, exist_ok=True)
                path = target / f"{Path(name).stem}{ext}"
                path.write_bytes(data)
                written.append(path)
    except zipfile.BadZipFile:
        return []
    return written


def to_pdf(source: Path, out_dir: Path) -> tuple[Path | None, str]:
    if source.suffix.lower() == ".pdf":
        return source, "input is already PDF"
    soffice = shutil.which("soffice") or shutil.which("libreoffice") or _windows_soffice()
    if not soffice:
        return None, "LibreOffice (soffice) is not on PATH"
    with tempfile.TemporaryDirectory(prefix="litgravity-soffice-") as profile:
        profile_fonts(source, Path(profile))
        result = subprocess.run(
            [
                soffice,
                f"-env:UserInstallation={Path(profile).as_uri()}",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(out_dir),
                str(source),
            ],
            capture_output=True,
            text=True,
            timeout=300,
        )
    pdf = out_dir / f"{source.stem}.pdf"
    if result.returncode != 0 or not pdf.exists():
        raise RuntimeError(f"soffice conversion failed: {(result.stderr or result.stdout).strip()[-400:]}")
    return pdf, "converted with soffice"


def rasterise(pdf: Path, out_dir: Path, pages: int, dpi: int) -> list[Path]:
    import pymupdf

    written = []
    with pymupdf.open(pdf) as document:
        for index, page in enumerate(document):
            if index >= pages:
                break
            target = out_dir / f"page-{index + 1:02d}.png"
            page.get_pixmap(dpi=dpi).save(target)
            written.append(target)
    return written


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Render Office or PDF pages to PNG.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--pages", type=int, default=5)
    parser.add_argument("--dpi", type=int, default=110)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    sys.dont_write_bytecode = True
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from office_runtime_bootstrap import ensure_runtime

    ensure_runtime(["pymupdf"])
    source = args.input.expanduser().resolve()
    out_dir = args.out_dir.expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        pdf, how = to_pdf(source, out_dir)
        pngs = rasterise(pdf, out_dir, args.pages, args.dpi) if pdf else []
    except (RuntimeError, subprocess.TimeoutExpired) as error:
        report = {"status": "fail", "input": str(source), "detail": str(error), "pages": []}
        print(json.dumps(report, ensure_ascii=False) if args.json else f"FAIL  {error}")
        return 1
    status = "rendered" if pdf else "skipped"
    report = {"status": status, "input": str(source), "detail": how, "pdf": str(pdf) if pdf else None, "pages": [str(p) for p in pngs]}
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    elif pdf:
        print(f"PASS  rendered {len(pngs)} page(s) -> {out_dir}")
    else:
        print(f"SKIP  {how}; visual pages were not rendered")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
