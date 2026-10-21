#!/usr/bin/env python3
from __future__ import annotations

import os as _os
import sys as _sys

_sys.dont_write_bytecode = True  # the installed skill directory stays read-only
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "..", "lit-pptx", "scripts"))
from office_runtime_bootstrap import ensure_runtime  # noqa: E402

ensure_runtime(["docx", "markdown", "bs4", "yaml"])

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from pdf_fonts import require_fonts
from convert_md_to_docx import (
    detect_locale,
    fix_dashes,
    fix_ellipsis,
    fix_quotes,
    fix_unit_spacing,
    load_publisher,
    normalize_double_spaces,
    parse_frontmatter,
)


def command_path(name: str) -> str | None:
    return shutil.which(name)


def run_checked(command: list[str], workdir: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=str(workdir) if workdir else None,
        text=True,
        capture_output=True,
        check=False,
    )


def ensure_pandoc() -> None:
    if not command_path("pandoc"):
        raise SystemExit("Error: pandoc not found. Install pandoc to use convert_md_to_pdf.py")


def preprocess_markdown(md_path: Path, publisher: dict, locale: str) -> tuple[dict, str, str]:
    md_text = md_path.read_text(encoding="utf-8")
    frontmatter, body = parse_frontmatter(md_text)
    detected_locale = detect_locale(body) if locale == "auto" else locale
    design = publisher["design"]
    dash_rules = design.get("micro_typography", {}).get("dashes")
    body = fix_dashes(body, dash_rules)
    body = fix_quotes(body)
    body = fix_unit_spacing(body)
    body = fix_ellipsis(body)
    body = normalize_double_spaces(body)
    return frontmatter, body, detected_locale


def format_author_meta(frontmatter: dict) -> str:
    authors = frontmatter.get("authors") or []
    if not isinstance(authors, list):
        return str(authors)
    items: list[str] = []
    for author in authors:
        if isinstance(author, dict):
            name = str(author.get("name") or "").strip()
            aff = author.get("affiliation")
            if isinstance(aff, list):
                suffix = ",".join(str(item) for item in aff)
            elif aff is None:
                suffix = ""
            else:
                suffix = str(aff)
            marker = "*" if author.get("corresponding") else ""
            items.append(f"{name}$^{{{suffix}{marker}}}$" if suffix or marker else name)
        else:
            items.append(str(author))
    return ", ".join(item for item in items if item)


def format_affiliation_meta(frontmatter: dict) -> str:
    affiliations = frontmatter.get("affiliations") or {}
    if not isinstance(affiliations, dict):
        return str(affiliations)
    lines = []
    for key, value in affiliations.items():
        lines.append(f"$^{{{key}}}$ {value}")
    return r" \\ ".join(lines)


def format_keywords(frontmatter: dict) -> str:
    keywords = frontmatter.get("keywords") or []
    if isinstance(keywords, list):
        return "; ".join(str(item) for item in keywords)
    return str(keywords)


def short_author_list(frontmatter: dict) -> str:
    authors = frontmatter.get("authors") or []
    if not isinstance(authors, list) or not authors:
        return ""
    first = authors[0]
    if isinstance(first, dict):
        first_name = str(first.get("name") or "")
    else:
        first_name = str(first)
    if len(authors) == 1:
        return first_name
    return f"{first_name} et al."


def template_variables(frontmatter: dict, publisher_name: str, publisher: dict, detected_locale: str, mode: str) -> dict[str, str]:
    latex_cfg = publisher["latex"]
    cjk_cfg = latex_cfg.get("cjk") or {}
    body_font = ((publisher.get("docx") or {}).get("font") or {}).get("body") or {}
    title = str(frontmatter.get("title") or "")
    return {
        "title": title,
        "author-meta": format_author_meta(frontmatter),
        "affiliation-meta": format_affiliation_meta(frontmatter),
        "abstract": str(frontmatter.get("abstract") or ""),
        "keywords-meta": format_keywords(frontmatter),
        "corresponding-email": str(frontmatter.get("corresponding_email") or ""),
        "short-title": title[:80],
        "author-list-short": short_author_list(frontmatter),
        "documentclass": str(latex_cfg.get("documentclass") or "article"),
        "classoptions": ",".join(str(item) for item in latex_cfg.get("classoptions") or []),
        "mainfont": str(body_font.get("family") or "Times New Roman"),
        "cjk-main-font": str(cjk_cfg.get("main_font") or "Pretendard"),
        "publisher-name": publisher_name,
        "detected-locale": detected_locale,
        "mode": mode,
        "has-cjk": "true" if detected_locale in {"ko", "mixed"} else "false",
    }


def build_pandoc_command(md_path: Path, out_path: Path, template_path: Path, variables: dict[str, str]) -> list[str]:
    command = [
        "pandoc",
        str(md_path),
        "--standalone",
        "--from",
        "markdown",
        "--to",
        "latex",
        "--template",
        str(template_path),
        "--output",
        str(out_path),
    ]
    for key, value in variables.items():
        if value:
            command.extend(["-V", f"{key}={value}"])
    return command


def render_markdown_to_latex(
    md_path: Path,
    tex_path: Path,
    publisher_name: str,
    registry_path: Path,
    locale: str = "auto",
    mode: str = "submission",
) -> str:
    ensure_pandoc()
    publisher = load_publisher(registry_path, publisher_name)
    frontmatter, body, detected_locale = preprocess_markdown(md_path, publisher, locale)
    script_dir = Path(__file__).resolve().parent
    template_path = script_dir.parent / publisher["latex"]["pandoc_template"]
    if not template_path.exists():
        raise SystemExit(f"Error: LaTeX template not found: {template_path}")
    tex_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_md = Path(tmpdir) / "input.md"
        tmp_md.write_text(body, encoding="utf-8")
        result = run_checked(
            build_pandoc_command(tmp_md, tex_path, template_path, template_variables(frontmatter, publisher_name, publisher, detected_locale, mode))
        )
        if result.returncode != 0:
            raise SystemExit(result.stdout + result.stderr)
    return detected_locale


def kpsewhich_has(target: str) -> bool:
    result = run_checked(["kpsewhich", target])
    return result.returncode == 0 and bool(result.stdout.strip())


def required_pdf_fonts(publisher: dict, detected_locale: str) -> list[str]:
    """The families the LaTeX template sets with fontspec: the main font, and the CJK font for Korean or mixed text."""
    variables = template_variables({}, "", publisher, detected_locale, "submission")
    fonts = [variables["mainfont"]]
    if variables["has-cjk"] == "true":
        fonts.append(variables["cjk-main-font"])
    return fonts


def preflight_pdf_compile(publisher_name: str, publisher: dict, detected_locale: str) -> None:
    ensure_pandoc()
    if not command_path("xelatex"):
        raise SystemExit(
            "Error: xelatex not found. TeX Live is required for PDF output. "
            "Install TeX Live with elsarticle, achemso, IEEEtran, sn-jnl, oblivoir, xeCJK, and latexmk."
        )
    if not command_path("kpsewhich"):
        raise SystemExit(
            "Error: kpsewhich not found. Install TeX Live so the script can verify required class files before compilation."
        )
    documentclass = str(publisher["latex"].get("documentclass") or "")
    class_file = f"{documentclass}.cls"
    if not kpsewhich_has(class_file):
        raise SystemExit(
            f"Error: required LaTeX class not found: {class_file}. Install the matching TeX Live package for publisher '{publisher_name}'."
        )
    if detected_locale in {"ko", "mixed"} and not kpsewhich_has("xeCJK.sty"):
        raise SystemExit(
            "Error: xeCJK.sty not found. Korean/CJK PDF output requires xeCJK from TeX Live."
        )
    require_fonts(required_pdf_fonts(publisher, detected_locale))


def compile_latex_to_pdf(tex_path: Path, pdf_path: Path) -> str:
    result = run_checked(
        ["xelatex", "-interaction=nonstopmode", "-halt-on-error", tex_path.name],
        workdir=tex_path.parent,
    )
    built_pdf = tex_path.with_suffix(".pdf")
    if result.returncode != 0 or not built_pdf.exists():
        raise SystemExit(result.stdout + result.stderr)
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    pdf_path.write_bytes(built_pdf.read_bytes())
    return result.stdout + result.stderr


def convert_md_to_pdf(
    md_path: Path,
    pdf_path: Path,
    publisher_name: str,
    registry_path: Path,
    locale: str = "auto",
    mode: str = "submission",
) -> str:
    publisher = load_publisher(registry_path, publisher_name)
    _, _, detected_locale = preprocess_markdown(md_path, publisher, locale)
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_tex = Path(tmpdir) / f"{publisher_name}.tex"
        render_markdown_to_latex(md_path, tmp_tex, publisher_name, registry_path, locale, mode)
        if mode == "draft":
            draft_tex = pdf_path.with_suffix(".tex")
            draft_tex.parent.mkdir(parents=True, exist_ok=True)
            draft_tex.write_text(tmp_tex.read_text(encoding="utf-8"), encoding="utf-8")
        preflight_pdf_compile(publisher_name, publisher, detected_locale)
        log = compile_latex_to_pdf(tmp_tex, pdf_path)
    return log


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert Markdown to PDF via pandoc and XeLaTeX")
    parser.add_argument("input", help="Input Markdown file")
    parser.add_argument("output", help="Output PDF file")
    parser.add_argument("--publisher", required=True, help="Publisher profile from templates/registry.yaml")
    parser.add_argument("--registry", default=None, help="Path to templates/registry.yaml")
    parser.add_argument("--locale", choices=("auto", "en", "ko", "mixed"), default="auto")
    parser.add_argument("--submission", action="store_true")
    parser.add_argument("--draft", action="store_true")
    args = parser.parse_args()
    if args.submission and args.draft:
        parser.error("--submission and --draft are mutually exclusive")
    return args


def main() -> int:
    args = parse_args()
    script_dir = Path(__file__).resolve().parent
    md_path = Path(args.input).expanduser().resolve()
    pdf_path = Path(args.output).expanduser().resolve()
    registry_path = Path(args.registry).expanduser().resolve() if args.registry else script_dir.parent / "templates" / "registry.yaml"
    if not md_path.exists():
        print(f"Error: Input file not found: {md_path}")
        return 1
    mode = "draft" if args.draft else "submission"
    try:
        log = convert_md_to_pdf(md_path, pdf_path, args.publisher, registry_path, args.locale, mode)
    except SystemExit as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(f"Successfully converted {md_path} to {pdf_path} [publisher={args.publisher}, mode={mode}]")
    if log.strip():
        print(log)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
