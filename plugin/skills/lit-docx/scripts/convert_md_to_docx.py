#!/usr/bin/env python3
"""Convert Markdown to DOCX with proper styling.

Usage:
    python convert_md_to_docx.py input.md output.docx [--template template.docx]
    python convert_md_to_docx.py input.md output.docx --publisher elsevier

Features:
- Headings (H1-H6 → Word heading styles)
- Paragraphs with bold/italic/code formatting
- Bullet and numbered lists
- Tables
- Code blocks (monospace font)
- Images (if local)
- Links (as hyperlinks)
- [NEW in M1] --publisher NAME loads templates/registry.yaml and applies
  journal design discipline: title block from YAML frontmatter, curly
  quotes, en/em dashes, nbsp before units, ellipsis, heading auto-numbering,
  booktabs tables, banned-font/style stripping, CJK font pairing.
- --tonality NAME (or frontmatter `tonality:`) builds the document in one of
  the six design directions of templates/tonalities/ (docx_design.py), with
  the page components written as ::: directives; --density and --variance
  move the pack's dials. Without a tonality or a publisher the plain profile
  runs through the same builders with neutral tokens.
"""

from __future__ import annotations
import os as _os
import sys as _sys

_sys.dont_write_bytecode = True  # the installed skill directory stays read-only
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "..", "lit-pptx", "scripts"))
from office_runtime_bootstrap import ensure_runtime  # noqa: E402
from office_data import DataError, resolve_text  # noqa: E402

ensure_runtime(["docx", "markdown", "bs4", "yaml"])

import argparse
import copy
import re
import sys
from pathlib import Path
from typing import Any

try:
    import markdown
    from markdown.extensions.tables import TableExtension
    from markdown.extensions.fenced_code import FencedCodeExtension
except ImportError:
    print("Error: 'markdown' library not found. Install with: pip install markdown")
    sys.exit(1)

try:
    from docx import Document
    from docx.shared import Pt, Inches, Cm, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.style import WD_STYLE_TYPE
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    from docx.text.paragraph import Paragraph
except ImportError:
    print("Error: 'python-docx' library not found. Install with: pip install python-docx")
    sys.exit(1)

try:
    from bs4 import BeautifulSoup, NavigableString
except ImportError:
    print("Error: 'beautifulsoup4' library not found. Install with: pip install beautifulsoup4")
    sys.exit(1)

import docx_design  # noqa: E402  (needs the runtime's python-docx and PyYAML)


# ===========================================================================
# Legacy HTML→DOCX helpers (unchanged from pre-M1 — preserved byte-for-byte)
# ===========================================================================


def create_hyperlink(paragraph, url: str, text: str):
    """Add a hyperlink to a paragraph."""
    part = paragraph.part
    r_id = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)

    hyperlink = OxmlElement('w:hyperlink')
    hyperlink.set(qn('r:id'), r_id)

    new_run = OxmlElement('w:r')
    rPr = OxmlElement('w:rPr')

    # Blue color and underline for hyperlink
    color = OxmlElement('w:color')
    color.set(qn('w:val'), '0000FF')
    rPr.append(color)

    underline = OxmlElement('w:u')
    underline.set(qn('w:val'), 'single')
    rPr.append(underline)

    new_run.append(rPr)

    text_elem = OxmlElement('w:t')
    text_elem.text = text
    new_run.append(text_elem)

    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)


def process_inline_elements(paragraph, element, md_path: Path):
    """Process inline elements like bold, italic, code, links within a paragraph."""
    if isinstance(element, NavigableString):
        text = str(element)
        if text.strip():
            paragraph.add_run(text)
        elif text:
            paragraph.add_run(text)
        return

    if element.name == 'strong' or element.name == 'b':
        run = paragraph.add_run(element.get_text())
        run.bold = True
    elif element.name == 'em' or element.name == 'i':
        run = paragraph.add_run(element.get_text())
        run.italic = True
    elif element.name == 'code':
        run = paragraph.add_run(element.get_text())
        run.font.name = 'Courier New'
        run.font.size = Pt(10)
    elif element.name == 'a':
        href = element.get('href', '')
        text = element.get_text()
        if href:
            create_hyperlink(paragraph, href, text)
        else:
            paragraph.add_run(text)
    elif element.name == 'img':
        src = element.get('src', '')
        if src and not src.startswith(('http://', 'https://', 'data:')):
            img_path = (md_path.parent / src).resolve()
            if img_path.exists():
                try:
                    paragraph.add_run().add_picture(str(img_path), width=Inches(4))
                except Exception:
                    paragraph.add_run(f"[Image: {src}]")
            else:
                paragraph.add_run(f"[Image not found: {src}]")
        else:
            paragraph.add_run(f"[Image: {src}]")
    elif element.name == 'br':
        paragraph.add_run('\n')
    else:
        # Recursively process children
        for child in element.children:
            process_inline_elements(paragraph, child, md_path)


def add_paragraph_with_formatting(doc: Document, element, md_path: Path, style: str = None):
    """Add a paragraph with inline formatting."""
    para = doc.add_paragraph(style=style)
    for child in element.children:
        process_inline_elements(para, child, md_path)
    return para


def process_list(doc: Document, element, md_path: Path, ordered: bool = False, level: int = 0):
    """Process ordered or unordered lists."""
    for i, li in enumerate(element.find_all('li', recursive=False)):
        # Create paragraph with list style
        para = doc.add_paragraph(style='List Number' if ordered else 'List Bullet')

        # Set indentation for nested lists
        if level > 0:
            para.paragraph_format.left_indent = Inches(0.5 * level)

        # Process direct text content. Only the item's own edges are trimmed: the space after a bold lead
        # ("**1,200개** 태그") belongs to the text.
        children = list(li.children)
        for ci, child in enumerate(children):
            if isinstance(child, NavigableString):
                text = str(child).replace("\n", " ")
                if ci == 0 or getattr(children[ci - 1], "name", None) in ('ul', 'ol', 'p'):
                    text = text.lstrip()
                if ci == len(children) - 1 or getattr(children[ci + 1], "name", None) in ('ul', 'ol', 'p'):
                    text = text.rstrip()
                if text:
                    para.add_run(text)
            elif child.name in ('ul', 'ol'):
                # Nested list
                process_list(doc, child, md_path, ordered=(child.name == 'ol'), level=level + 1)
            elif child.name == 'p':
                # Process paragraph content inline
                for subchild in child.children:
                    process_inline_elements(para, subchild, md_path)
            else:
                process_inline_elements(para, child, md_path)


def process_table(doc: Document, element, md_path: Path):
    """Process HTML table and create DOCX table."""
    rows = element.find_all('tr')
    if not rows:
        return

    # Count columns from first row
    first_row = rows[0]
    cols = len(first_row.find_all(['th', 'td']))

    if cols == 0:
        return

    table = doc.add_table(rows=len(rows), cols=cols)
    table.style = 'Table Grid'

    for row_idx, tr in enumerate(rows):
        cells = tr.find_all(['th', 'td'])
        for col_idx, cell in enumerate(cells):
            if col_idx < cols:
                table_cell = table.rows[row_idx].cells[col_idx]
                # Clear default paragraph
                table_cell.text = ''
                para = table_cell.paragraphs[0]
                for child in cell.children:
                    process_inline_elements(para, child, md_path)

                # Bold for header cells
                if cell.name == 'th':
                    for run in para.runs:
                        run.bold = True

    shape_table(doc, table, [[c.get_text(" ", strip=True) for c in tr.find_all(['th', 'td'])] for tr in rows])


# A cell reads as a number when, after signs and units, only digits remain.
NUMERIC_CELL = re.compile(r"^[+\-−±▲▼△▽]?\s*[\d.,]+\s*(?:%p?|배|x|pt|[가-힣]{1,3}|[A-Za-z]{1,3})?$")


def shape_table(doc, table, texts: list[list[str]]) -> None:
    """Give a table readable columns and keep it whole on the page.

    Column widths follow the longest cell of each column (Hangul counted wider)
    with a floor, so a short column never squeezes a long one into one word per
    line. The header row repeats on a new page, a row never splits across pages,
    and columns of numbers are right-aligned.
    """
    if not texts or not texts[0]:
        return
    cols = len(table.columns)
    section = doc.sections[-1]
    usable = section.page_width - section.left_margin - section.right_margin

    def width_of(text: str) -> float:
        # Hangul runs a little over twice as wide as Latin; +3 covers the cell padding.
        return sum(2.3 if "\uac00" <= ch <= "\ud7a3" else 1.0 for ch in text) + 3.0

    want = []
    for ci in range(cols):
        column = [row[ci] for row in texts if ci < len(row)]
        want.append(max([width_of(t) for t in column] + [4.0]))
    # Each column first gets its natural width (about 0.085 in per Latin character at
    # body size, capped at 45% of the line); columns that hit the cap share what is left.
    unit = Inches(0.085)
    cap = usable * 0.45
    natural = [min(w * unit, cap) for w in want]
    capped = [ci for ci in range(cols) if want[ci] * unit > cap]
    spare = usable - sum(natural)
    if spare > 0 and capped:
        for ci in capped:
            natural[ci] += spare / len(capped)
    elif spare > 0:
        natural = [w + spare / cols for w in natural]
    scale = usable / sum(natural)
    widths = [int(w * scale) for w in natural]

    table.autofit = False
    for ci, column in enumerate(table.columns):
        column.width = widths[ci]
    for ri, row in enumerate(table.rows):
        tr_pr = row._tr.get_or_add_trPr()
        # Schema order puts cantSplit before trHeight and tblHeader after it.
        tr_pr.insert(0, OxmlElement("w:cantSplit"))
        if ri == 0:
            header = OxmlElement("w:tblHeader")
            tr_pr.append(header)
        for ci, cell in enumerate(row.cells):
            if ci < cols:
                cell.width = widths[ci]
                for paragraph in cell.paragraphs:
                    # Body line spacing (1.6 in some profiles) makes every row a double row.
                    paragraph.paragraph_format.line_spacing = 1.15
                    paragraph.paragraph_format.space_after = Pt(0)
                    paragraph.paragraph_format.first_line_indent = Cm(0)

    for ci in range(cols):
        data = [row[ci] for row in texts[1:] if ci < len(row) and row[ci].strip()]
        if data and all(NUMERIC_CELL.match(t.strip()) for t in data):
            for row in table.rows:
                for paragraph in row.cells[ci].paragraphs:
                    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT


def process_code_block(doc: Document, element):
    """Process code block with monospace formatting."""
    code = element.find('code')
    text = code.get_text() if code else element.get_text()

    para = doc.add_paragraph()
    run = para.add_run(text)
    run.font.name = 'Courier New'
    run.font.size = Pt(9)

    # Light gray background (via shading)
    shading = OxmlElement('w:shd')
    shading.set(qn('w:fill'), 'F0F0F0')
    para._p.get_or_add_pPr().append(shading)


def add_figure_caption(doc, element, para) -> None:
    """An image alone in its paragraph keeps its alt text as the caption under it
    ("Figure 1." / "그림 1." bold), and the image keeps with the caption."""
    images = element.find_all('img')
    alt = images[0].get('alt', '').strip() if len(images) == 1 else ''
    if not alt or element.get_text(strip=True):
        return
    para.paragraph_format.keep_with_next = True
    try:
        caption = doc.add_paragraph(style='Caption')
    except KeyError:
        caption = doc.add_paragraph()
    label = docx_design.FIGURE_LABEL.match(alt)
    if label:
        caption.add_run(label.group(1)).bold = True
        caption.add_run(alt[len(label.group(1)):])
    else:
        caption.add_run(alt)


def html_to_docx(html: str, doc: Document, md_path: Path):
    """Convert HTML to DOCX elements."""
    soup = BeautifulSoup(html, 'html.parser')

    for element in soup.children:
        if isinstance(element, NavigableString):
            text = str(element).strip()
            if text:
                doc.add_paragraph(text)
            continue

        if element.name in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            level = int(element.name[1])
            heading = doc.add_heading(level=level)
            for child in element.children:
                process_inline_elements(heading, child, md_path)

        elif element.name == 'p':
            para = add_paragraph_with_formatting(doc, element, md_path)
            add_figure_caption(doc, element, para)

        elif element.name == 'ul':
            process_list(doc, element, md_path, ordered=False)

        elif element.name == 'ol':
            process_list(doc, element, md_path, ordered=True)

        elif element.name == 'table':
            process_table(doc, element, md_path)

        elif element.name == 'pre':
            process_code_block(doc, element)

        elif element.name == 'blockquote':
            para = doc.add_paragraph(style='Quote')
            for child in element.children:
                if child.name == 'p':
                    for subchild in child.children:
                        process_inline_elements(para, subchild, md_path)
                else:
                    process_inline_elements(para, child, md_path)

        elif element.name == 'hr':
            # Add a horizontal line
            para = doc.add_paragraph()
            para.add_run('─' * 50)
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER

        elif element.name in ('div', 'section', 'article'):
            # Recursively process container elements
            html_to_docx(str(element), doc, md_path)


# ===========================================================================
# M1: Journal workflow — frontmatter, filters, design enforcement
# ===========================================================================


def _load_yaml():
    try:
        import yaml
        return yaml
    except ImportError:
        print("Error: 'pyyaml' library required for --publisher. pip install pyyaml")
        sys.exit(1)


def parse_frontmatter(md_text: str) -> tuple[dict, str]:
    """Extract leading YAML frontmatter. Returns (frontmatter_dict, body)."""
    if not md_text.startswith("---"):
        return {}, md_text
    # Find closing fence
    lines = md_text.splitlines(keepends=True)
    if len(lines) < 2:
        return {}, md_text
    end_idx = None
    for i in range(1, len(lines)):
        if lines[i].rstrip() == "---":
            end_idx = i
            break
    if end_idx is None:
        return {}, md_text
    yaml_src = "".join(lines[1:end_idx])
    body = "".join(lines[end_idx + 1:])
    yaml = _load_yaml()
    try:
        data = yaml.safe_load(yaml_src) or {}
    except Exception as exc:
        print(f"Warning: could not parse YAML frontmatter: {exc}", file=sys.stderr)
        return {}, md_text
    if not isinstance(data, dict):
        return {}, md_text
    return data, body


def load_publisher(registry_path: Path, name: str) -> dict:
    yaml = _load_yaml()
    if not registry_path.exists():
        raise SystemExit(f"Error: registry not found: {registry_path}")
    with registry_path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    pubs = data.get("publishers") or {}
    if name not in pubs:
        raise SystemExit(
            f"Error: publisher {name!r} not in registry "
            f"(known: {', '.join(sorted(pubs)) or 'none'})"
        )
    return pubs[name]


# ---------------------------------------------------------------------------
# Code-preserving filter helpers
# ---------------------------------------------------------------------------


_FENCE_RE = re.compile(r"(^```.*?^```)", re.MULTILINE | re.DOTALL)
_INLINE_CODE_RE = re.compile(r"(`[^`\n]+`)")


def _split_code_preserving(text: str) -> list[tuple[str, bool]]:
    """Split text into (segment, is_code) tuples.

    Fenced code blocks and inline backtick code are returned as is_code=True
    and must never be touched by the micro-typography filters.
    """
    # First split on fenced code blocks
    out: list[tuple[str, bool]] = []
    pos = 0
    for m in _FENCE_RE.finditer(text):
        if m.start() > pos:
            out.append((text[pos:m.start()], False))
        out.append((m.group(0), True))
        pos = m.end()
    if pos < len(text):
        out.append((text[pos:], False))
    # Then split non-code segments on inline backtick code
    refined: list[tuple[str, bool]] = []
    for seg, is_code in out:
        if is_code:
            refined.append((seg, True))
            continue
        last = 0
        for m in _INLINE_CODE_RE.finditer(seg):
            if m.start() > last:
                refined.append((seg[last:m.start()], False))
            refined.append((m.group(0), True))
            last = m.end()
        if last < len(seg):
            refined.append((seg[last:], False))
    return refined


def _apply_to_noncode(text: str, fn) -> str:
    parts = _split_code_preserving(text)
    out = []
    for seg, is_code in parts:
        out.append(seg if is_code else fn(seg))
    return "".join(out)


# ---------------------------------------------------------------------------
# Pre-MD micro-typography filters
# ---------------------------------------------------------------------------


_NUMRANGE_RE = re.compile(r"(\d)-(\d)")
_PAREN_DASH_RE = re.compile(r"(\w) - (\w)")


def fix_dashes(text: str, rules: dict | None = None) -> str:
    """Numeric ranges → en-dash; parenthetical 'word - word' → em-dash.

    rules is the design.micro_typography.dashes block (currently informational;
    M1 hardcodes en-dash for numeric range and em-dash for parenthetical).
    """
    def _fn(seg: str) -> str:
        seg = _NUMRANGE_RE.sub(lambda m: f"{m.group(1)}\u2013{m.group(2)}", seg)
        seg = _PAREN_DASH_RE.sub(lambda m: f"{m.group(1)} \u2014 {m.group(2)}", seg)
        return seg
    return _apply_to_noncode(text, _fn)


def fix_quotes(text: str) -> str:
    """ASCII "..." → "..."; '...' → '...' via left/right state machine."""
    def _fn(seg: str) -> str:
        out_chars = []
        open_dq = True
        open_sq = True
        for ch in seg:
            if ch == '"':
                out_chars.append("\u201C" if open_dq else "\u201D")
                open_dq = not open_dq
            elif ch == "'":
                # Keep apostrophe if surrounded by letters (e.g. "don't")
                prev = out_chars[-1] if out_chars else ""
                if prev.isalpha():
                    out_chars.append("\u2019")
                else:
                    out_chars.append("\u2018" if open_sq else "\u2019")
                    open_sq = not open_sq
            else:
                out_chars.append(ch)
        return "".join(out_chars)
    return _apply_to_noncode(text, _fn)


_UNIT_GROUP = (
    r"mg|g|kg|mL|L|\u03BCL|uL|nm|\u03BCm|um|mm|cm|m|km|K|\u00B0C|%|min|h|s|ms"
)
_UNIT_RE = re.compile(rf"(\d)(\s+)({_UNIT_GROUP})(?=\b|\W|$)")
_FIG_RE = re.compile(r"(Fig\.)\s(\d)")
_TABLE_RE = re.compile(r"(Table)\s(\d)")
_EQ_RE = re.compile(r"(Eq\.)\s(\d)")


def fix_unit_spacing(text: str) -> str:
    """Insert U+00A0 between number and SI unit, and after Fig./Table/Eq."""
    def _fn(seg: str) -> str:
        seg = _UNIT_RE.sub(lambda m: f"{m.group(1)}\u00A0{m.group(3)}", seg)
        seg = _FIG_RE.sub(lambda m: f"{m.group(1)}\u00A0{m.group(2)}", seg)
        seg = _TABLE_RE.sub(lambda m: f"{m.group(1)}\u00A0{m.group(2)}", seg)
        seg = _EQ_RE.sub(lambda m: f"{m.group(1)}\u00A0{m.group(2)}", seg)
        return seg
    return _apply_to_noncode(text, _fn)


def fix_ellipsis(text: str) -> str:
    def _fn(seg: str) -> str:
        return seg.replace("...", "\u2026")
    return _apply_to_noncode(text, _fn)


def normalize_double_spaces(text: str) -> str:
    def _fn(seg: str) -> str:
        # Preserve leading indentation; collapse interior double spaces
        lines = seg.split("\n")
        cleaned = []
        for line in lines:
            stripped_left = line.lstrip(" ")
            lead = line[: len(line) - len(stripped_left)]
            cleaned.append(lead + re.sub(r" {2,}", " ", stripped_left))
        return "\n".join(cleaned)
    return _apply_to_noncode(text, _fn)


# ---------------------------------------------------------------------------
# Post-HTML (doc object) filters
# ---------------------------------------------------------------------------


def apply_heading_numbering(doc, design: dict) -> None:
    def to_roman(value: int) -> str:
        numerals = [
            (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
            (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
            (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
        ]
        out: list[str] = []
        remaining = value
        for arabic, roman in numerals:
            while remaining >= arabic:
                out.append(roman)
                remaining -= arabic
        return "".join(out)

    def prefix_for(level: int, counters: list[int]) -> str | None:
        key = f"h{level}"
        cfg = (design.get("heading_hierarchy") or {}).get(key) or {}
        numbering = cfg.get("numbering")
        if numbering is None:
            return None
        numbering = str(numbering).strip()
        if level == 1 and numbering.upper() == "I.":
            return f"{to_roman(counters[0])}. "
        if level == 1:
            return f"{counters[0]}. "
        if level == 2:
            return f"{counters[0]}.{counters[1]}. "
        if level == 3:
            return f"{counters[0]}.{counters[1]}.{counters[2]}. "
        return None

    counters = [0, 0, 0]
    for para in doc.paragraphs:
        style_name = para.style.name if para.style else ""
        level = 0
        if style_name == "Heading 1":
            level = 1
            counters[0] += 1
            counters[1] = 0
            counters[2] = 0
        elif style_name == "Heading 2":
            level = 2
            counters[1] += 1
            counters[2] = 0
        elif style_name == "Heading 3":
            level = 3
            counters[2] += 1
        else:
            continue
        prefix = prefix_for(level, counters)
        if prefix is None:
            continue
        current = para.text or ""
        # Skip if already numbered (e.g. "1 Introduction" from the source)
        if re.match(r"^(?:\d+(?:\.\d+)*\.?|[IVXLCDM]+\.?)\s", current):
            continue
        if para.runs:
            para.runs[0].text = prefix + para.runs[0].text
        else:
            para.add_run(prefix)


def _set_cell_borders_nil(tcPr):
    tcBorders = tcPr.find(qn("w:tcBorders"))
    if tcBorders is None:
        tcBorders = OxmlElement("w:tcBorders")
        tcPr.append(tcBorders)
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = tcBorders.find(qn(f"w:{side}"))
        if el is None:
            el = OxmlElement(f"w:{side}")
            tcBorders.append(el)
        el.set(qn("w:val"), "nil")
        el.set(qn("w:sz"), "0")


def apply_table_style(doc, design: dict) -> None:
    """Override python-docx 'Table Grid' with booktabs: only horizontal rules.

    Rules: top rule (table top), header-bottom rule, bottom rule (table bottom).
    All vertical rules (left/right/insideV) set to nil.
    """
    for table in doc.tables:
        table.style = None  # detach Table Grid
        tbl = table._tbl
        tblPr = tbl.find(qn("w:tblPr"))
        if tblPr is None:
            tblPr = OxmlElement("w:tblPr")
            tbl.insert(0, tblPr)
        # Remove any existing tblBorders and add our booktabs set
        existing = tblPr.find(qn("w:tblBorders"))
        if existing is not None:
            tblPr.remove(existing)
        tblBorders = OxmlElement("w:tblBorders")

        def _add_border(name: str, val: str, sz: str):
            el = OxmlElement(f"w:{name}")
            el.set(qn("w:val"), val)
            el.set(qn("w:sz"), sz)
            el.set(qn("w:space"), "0")
            el.set(qn("w:color"), "000000")
            tblBorders.append(el)

        _add_border("top", "single", "12")       # ~1.5pt
        _add_border("bottom", "single", "12")    # ~1.5pt
        _add_border("left", "nil", "0")
        _add_border("right", "nil", "0")
        _add_border("insideH", "single", "6")    # ~0.75pt (header-bottom)
        _add_border("insideV", "nil", "0")       # explicit no verticals
        tblPr.append(tblBorders)

        # Bold header row + add bottom border only to header cells so the
        # thicker rule sits under the header (and horizontal rules between
        # body rows are suppressed)
        if table.rows:
            header_row = table.rows[0]
            for cell in header_row.cells:
                for p in cell.paragraphs:
                    for r in p.runs:
                        r.bold = True
            # Remove insideH to prevent inner body rules; header-bottom comes
            # from a per-cell bottom border on the first row.
            insideH = tblBorders.find(qn("w:insideH"))
            if insideH is not None:
                insideH.set(qn("w:val"), "nil")
            for cell in header_row.cells:
                tcPr = cell._tc.get_or_add_tcPr()
                tcBorders = tcPr.find(qn("w:tcBorders"))
                if tcBorders is None:
                    tcBorders = OxmlElement("w:tcBorders")
                    tcPr.append(tcBorders)
                existing_bottom = tcBorders.find(qn("w:bottom"))
                if existing_bottom is None:
                    existing_bottom = OxmlElement("w:bottom")
                    tcBorders.append(existing_bottom)
                existing_bottom.set(qn("w:val"), "single")
                existing_bottom.set(qn("w:sz"), "6")
                existing_bottom.set(qn("w:space"), "0")
                existing_bottom.set(qn("w:color"), "000000")


def keep_tables_with_captions(doc) -> None:
    """A table caption keeps with its table, and a table that fits one page keeps its rows together
    (every row but the last keeps with the next). Pagination only: text, styles and rules are unchanged."""
    section = doc.sections[-1]
    frame_h = (section.page_height - section.top_margin - section.bottom_margin) / 12700
    for table in doc.tables:
        prev = table._tbl.getprevious()
        if prev is not None and prev.tag == qn("w:p") and docx_design.TABLE_CAPTION.match("".join(t.text or "" for t in prev.iter(qn("w:t"))).strip()):
            Paragraph(prev, table._parent).paragraph_format.keep_with_next = True
        widths = [c.width / 12700 if c.width else 100 for c in table.rows[0].cells]
        est = sum(6 + 11 * 1.3 * max(docx_design._est_lines(c.text, (widths[i] if i < len(widths) else 100) - 12, 11) for i, c in enumerate(row.cells)) for row in table.rows)
        if est <= 0.9 * frame_h:
            for row in table.rows[:-1]:
                for cell in row.cells:
                    cell.paragraphs[0].paragraph_format.keep_with_next = True


def publisher_spacing(doc) -> None:
    """Text never touches a table or a caption (spec-v2 Amendments 7, R10): the paragraph after a table stands three
    quarters of a body line clear (docx-spec Amendments 6; 8 pt read as half a line), a table caption after text
    8 pt, and a figure caption keeps 8 pt under it. A paragraph after a list stands 6 pt clear of its last item."""
    body = doc.element.body
    normal = doc.styles["Normal"]
    size = normal.font.size.pt if normal.font.size else 11
    multiple = normal.paragraph_format.line_spacing if isinstance(normal.paragraph_format.line_spacing, float) else 1.15
    clear = Pt(max(8, round(size * multiple * 1.2 * 0.75)))
    for el in body.iterchildren(qn("w:tbl")):
        nxt = el.getnext()
        if nxt is not None and nxt.tag == qn("w:p") and "".join(t.text or "" for t in nxt.iter(qn("w:t"))).strip():
            para = Paragraph(nxt, doc._body)
            # A heading keeps its own (larger) space above.
            own = para.style.paragraph_format.space_before if para.style is not None else None
            fmt = para.paragraph_format
            if not (own and own >= clear) and (not fmt.space_before or fmt.space_before < clear):
                fmt.space_before = clear
        prev = el.getprevious()
        if prev is not None and prev.tag == qn("w:p") and docx_design.TABLE_CAPTION.match("".join(t.text or "" for t in prev.iter(qn("w:t"))).strip()):
            fmt = Paragraph(prev, doc._body).paragraph_format
            if not fmt.space_before or fmt.space_before < Pt(8):
                fmt.space_before = Pt(8)
    docx_design.space_after_lists(doc)
    for p in doc.paragraphs:
        prev = p._p.getprevious()
        under_picture = prev is not None and prev.find(f".//{qn('w:drawing')}") is not None
        if docx_design.FIGURE_LABEL.match(p.text.strip()) and (under_picture or (p.style is not None and p.style.name == "Caption")):
            if not p.paragraph_format.space_after or p.paragraph_format.space_after < Pt(8):
                p.paragraph_format.space_after = Pt(8)


def plain_table_cells(doc) -> None:
    """Table cells neither hyphenate nor justify: the body may (the profile's hyphenation), but a narrow cell
    broke "Pro-posed" and a justified header spread "Conversion   at"."""
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    p_pr = paragraph._p.get_or_add_pPr()
                    if p_pr.find(qn("w:suppressAutoHyphens")) is None:
                        p_pr.insert_element_before(OxmlElement("w:suppressAutoHyphens"), *SUPPRESS_AFTER)
                    if paragraph.alignment in (None, WD_ALIGN_PARAGRAPH.JUSTIFY):
                        paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT


SUPPRESS_AFTER = ("w:kinsoku", "w:wordWrap", "w:overflowPunct", "w:topLinePunct", "w:autoSpaceDE", "w:autoSpaceDN", "w:bidi",
                  "w:adjustRightInd", "w:snapToGrid", "w:spacing", "w:ind", "w:contextualSpacing", "w:mirrorIndents",
                  "w:suppressOverlap", "w:jc", "w:textDirection", "w:textAlignment", "w:textboxTightWrap",
                  "w:outlineLvl", "w:divId", "w:cnfStyle", "w:rPr", "w:sectPr", "w:pPrChange")


def page_numbers(doc, design: dict) -> None:
    """The profile's page numbering (registry design.header_footer): a centred PAGE field in the footer at the
    footer size, and none on the first page when the profile says so (its header keeps the notice tag)."""
    hf = design.get("header_footer") or {}
    if hf.get("page_numbering") != "bottom_center":
        return
    size = Pt(float(hf.get("footer_font_size_pt") or 9))
    for index, section in enumerate(doc.sections):
        if index and section.footer.is_linked_to_previous:
            continue
        if not hf.get("page_numbering_first_page", True) and not section.different_first_page_header_footer:
            section.different_first_page_header_footer = True
            first = section.first_page_header
            for paragraph in section.header.paragraphs:
                first._element.append(copy.deepcopy(paragraph._p))
            first._element.remove(first.paragraphs[0]._p)
        footer = section.footer
        paragraph = footer.paragraphs[0]
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = paragraph.add_run()
        run.font.size = size
        for kind, text in (("begin", None), (None, " PAGE "), ("separate", None), (None, "1"), ("end", None)):
            if kind:
                char = OxmlElement("w:fldChar")
                char.set(qn("w:fldCharType"), kind)
                run._r.append(char)
            elif text == " PAGE ":
                instr = OxmlElement("w:instrText")
                instr.set(qn("xml:space"), "preserve")
                instr.text = text
                run._r.append(instr)
            else:
                t = OxmlElement("w:t")
                t.text = text
                run._r.append(t)


def strip_banned(doc, design: dict) -> None:
    """Remove any banned font/style from runs and paragraphs."""
    banned = design.get("banned") or {}
    banned_fonts = set(banned.get("fonts") or [])
    banned_styles = set(banned.get("styles") or [])
    body_font = None
    # body font is enforced on Normal style already, but we override raw runs too
    for para in doc.paragraphs:
        if para.style and para.style.name in banned_styles:
            try:
                para.style = doc.styles["Normal"]
            except KeyError:
                pass
        for run in para.runs:
            if run.font.name and run.font.name in banned_fonts:
                run.font.name = None  # inherit from style
    # Also walk table cells
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    if para.style and para.style.name in banned_styles:
                        try:
                            para.style = doc.styles["Normal"]
                        except KeyError:
                            pass
                    for run in para.runs:
                        if run.font.name and run.font.name in banned_fonts:
                            run.font.name = None


def _set_run_fonts(run, latin: str, cjk: str | None) -> None:
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:ascii"), latin)
    rfonts.set(qn("w:hAnsi"), latin)
    rfonts.set(qn("w:cs"), latin)
    if cjk:
        rfonts.set(qn("w:eastAsia"), cjk)


THEME_PAIRS = (("asciiTheme", "ascii"), ("hAnsiTheme", "hAnsi"), ("eastAsiaTheme", "eastAsia"), ("cstheme", "cs"))


def drop_shadowed_theme_fonts(doc) -> None:
    """A style that names its face keeps no theme font beside it: Word and LibreOffice both let the theme
    attribute win, so the profile's heading face (Times New Roman, Arial, Pretendard) rendered as the
    theme's Calibri. Styles only; the document body is untouched."""
    for rfonts in doc.styles.element.iter(qn("w:rFonts")):
        for theme, named in THEME_PAIRS:
            if rfonts.get(qn(f"w:{named}")) and rfonts.get(qn(f"w:{theme}")) is not None:
                del rfonts.attrib[qn(f"w:{theme}")]


def apply_cjk_font_pairing(doc, font_cfg: dict) -> None:
    body = font_cfg.get("body") or {}
    body_cjk = font_cfg.get("body_cjk") or {}
    latin = body.get("family")
    cjk = body_cjk.get("family")
    if not latin:
        return

    def _walk(paragraphs):
        for para in paragraphs:
            for run in para.runs:
                # Only fix runs that already have a font set to something
                # other than the registry-banned default; leaving run.font.name
                # as None lets the style do its job. We still force eastAsia.
                current_name = run.font.name
                if current_name and current_name != "Courier New":
                    _set_run_fonts(run, latin, cjk)
                elif not current_name:
                    # set only eastAsia pair to avoid losing style inheritance
                    rpr = run._element.get_or_add_rPr()
                    rfonts = rpr.find(qn("w:rFonts"))
                    if rfonts is None:
                        rfonts = OxmlElement("w:rFonts")
                        rpr.append(rfonts)
                    if cjk:
                        rfonts.set(qn("w:eastAsia"), cjk)

    _walk(doc.paragraphs)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                _walk(cell.paragraphs)


# ---------------------------------------------------------------------------
# Title block builder
# ---------------------------------------------------------------------------


def _insert_paragraph_before(doc, before_p, style=None):
    """Insert a new paragraph before the given paragraph element."""
    new_p = OxmlElement("w:p")
    before_p._p.addprevious(new_p)
    from docx.text.paragraph import Paragraph
    para = Paragraph(new_p, before_p._parent)
    if style is not None:
        try:
            para.style = doc.styles[style]
        except KeyError:
            pass
    return para


def inject_title_block(doc, frontmatter: dict, design: dict) -> None:
    """Prepend title/authors/affiliations/abstract/keywords to the doc.

    Builds the block at the top of the document body via the underlying
    XML so it appears before any html_to_docx output. Called BEFORE
    html_to_docx in M1's control flow so paragraphs just append normally.
    """
    tb = design.get("title_block") or {}
    title = frontmatter.get("title")
    if not title:
        return

    def _p_center(size: int, bold=False, italic=False, space_after=4):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.space_after = Pt(space_after)
        return p

    def _add_run(p, text: str, size: int, bold=False, italic=False, sup=False):
        run = p.add_run(text)
        run.font.size = Pt(size)
        run.bold = bold
        run.italic = italic
        run.font.superscript = sup
        return run

    # Title
    tp = _p_center(
        tb.get("title", {}).get("size_pt", 18),
        bold=True,
        space_after=tb.get("title", {}).get("space_after_pt", 12),
    )
    _add_run(tp, str(title), tb.get("title", {}).get("size_pt", 18), bold=True)

    # Report-style frontmatter: a subtitle and one author / organisation / date line
    # when there is no journal author list.
    if frontmatter.get("subtitle"):
        sp = _p_center(13, space_after=6)
        _add_run(sp, str(frontmatter["subtitle"]), 13)
    if not frontmatter.get("authors"):
        meta = [str(v) for v in (frontmatter.get("author"), frontmatter.get("organization"), frontmatter.get("date")) if v]
        if meta:
            mp = _p_center(10.5, space_after=14)
            _add_run(mp, " · ".join(meta), 10.5)

    # Authors
    authors = frontmatter.get("authors") or []
    if authors:
        ap = _p_center(
            tb.get("authors", {}).get("size_pt", 12),
            space_after=tb.get("authors", {}).get("space_after_pt", 4),
        )
        sep = tb.get("author_separator", ", ")
        corr_mark = tb.get("corresponding_marker", "*")
        size = tb.get("authors", {}).get("size_pt", 12)
        for i, author in enumerate(authors):
            if not isinstance(author, dict):
                continue
            if i > 0:
                _add_run(ap, sep, size)
            name = str(author.get("name", "Author"))
            _add_run(ap, name, size)
            aff = author.get("affiliation")
            if aff is not None:
                if isinstance(aff, list):
                    aff_text = ",".join(str(a) for a in aff)
                else:
                    aff_text = str(aff)
                _add_run(ap, aff_text, size, sup=True)
            if author.get("corresponding"):
                _add_run(ap, corr_mark, size, sup=True)

    # Affiliations
    affs = frontmatter.get("affiliations")
    if isinstance(affs, dict):
        for key in sorted(affs.keys(), key=lambda k: str(k)):
            fp = _p_center(
                tb.get("affiliations", {}).get("size_pt", 10),
                italic=True,
                space_after=2,
            )
            _add_run(
                fp,
                f"{key} {affs[key]}",
                tb.get("affiliations", {}).get("size_pt", 10),
                italic=True,
            )

    # Corresponding email (if present, small italic line)
    corr_email = frontmatter.get("corresponding_email")
    if corr_email:
        cp = _p_center(10, italic=True, space_after=8)
        _add_run(cp, f"* Corresponding author: {corr_email}", 10, italic=True)

    # Abstract
    abstract = frontmatter.get("abstract")
    if abstract:
        lp = doc.add_paragraph()
        lp.paragraph_format.first_line_indent = Cm(0)
        lp.paragraph_format.space_after = Pt(4)
        _add_run(
            lp,
            tb.get("abstract_label", "Abstract"),
            tb.get("abstract_font_size_pt", 10),
            bold=True,
        )
        body = doc.add_paragraph()
        body.paragraph_format.first_line_indent = Cm(0)
        body.paragraph_format.space_after = Pt(6)
        _add_run(
            body,
            str(abstract),
            tb.get("abstract_font_size_pt", 10),
        )

    # Keywords
    keywords = frontmatter.get("keywords")
    if keywords:
        kp = doc.add_paragraph()
        kp.paragraph_format.first_line_indent = Cm(0)
        kp.paragraph_format.space_after = Pt(12)
        _add_run(
            kp,
            tb.get("keywords_label", "Keywords") + ": ",
            tb.get("abstract_font_size_pt", 10),
            bold=True,
        )
        if isinstance(keywords, list):
            sep = tb.get("keywords_separator", "; ")
            text = sep.join(str(k) for k in keywords)
        else:
            text = str(keywords)
        _add_run(kp, text, tb.get("abstract_font_size_pt", 10))


# ---------------------------------------------------------------------------
# Locale detection
# ---------------------------------------------------------------------------


_HANGUL_RE = re.compile(r"[\uac00-\ud7a3]")


def detect_locale(text: str) -> str:
    total = len(text) or 1
    hangul_count = len(_HANGUL_RE.findall(text))
    ratio = hangul_count / total
    if ratio > 0.05:
        return "ko"
    if ratio > 0.01:
        return "mixed"
    return "en"


# ===========================================================================
# Conversion entry point
# ===========================================================================


NOTICE_INK, NOTICE_FILL = docx_design.NOTICE


def _shade(element, fill: str) -> None:
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    element.append(shd)


def add_notice(doc, text: str) -> None:
    """The frontmatter `notice:` (e.g. "예시 데이터: 수치는 가정입니다") as a tag in
    every page header, so an example document cannot be mistaken for a sourced one
    on any page it is printed from. A profile whose title page has its own, empty
    header (korean-generic) gets a tinted band under the title block instead."""
    if doc.sections[0].different_first_page_header_footer:
        band = doc.add_paragraph()
        band_run = band.add_run(str(text))
        band_run.bold = True
        band_run.font.size = Pt(10.5)
        band_run.font.color.rgb = RGBColor.from_string(NOTICE_INK)
        band.paragraph_format.space_before = Pt(4)
        band.paragraph_format.space_after = Pt(14)
        _shade(band._p.get_or_add_pPr(), NOTICE_FILL)
    for index, section in enumerate(doc.sections):
        if index and section.header.is_linked_to_previous:
            continue
        header = section.header
        tag = header.paragraphs[0] if header.paragraphs and not header.paragraphs[0].text.strip() else header.add_paragraph()
        tag_run = tag.add_run(f"\u00a0{text}\u00a0")
        tag_run.bold = True
        tag_run.font.size = Pt(9)
        tag_run.font.color.rgb = RGBColor.from_string(NOTICE_INK)
        _shade(tag_run._r.get_or_add_rPr(), NOTICE_FILL)


def read_source(md_path: Path) -> str:
    """The Markdown source, with {{ … }} numbers filled from its `data:` files
    (office_data.py computes derived values and runs the declared checks)."""
    text = md_path.read_text(encoding="utf-8")
    try:
        return resolve_text(text, md_path.parent)[0]
    except DataError as exc:
        raise SystemExit(f"Data error: {exc}") from exc


MD_EXTENSIONS = ['tables', 'fenced_code', 'nl2br', 'sane_lists']


def _md_renderer(md_path: Path):
    """Markdown into a document or a component's cell, through the legacy HTML helpers."""
    def render(container, text: str) -> None:
        html_to_docx(markdown.Markdown(extensions=MD_EXTENSIONS).convert(text), container, md_path)
    return render


def _typography(design: dict, lang: str = "en"):
    """The registry's micro-typography filters, for Markdown outside the directive fences; Korean text also
    writes ISO dates the Korean way (2026. 10. 1.)."""
    def apply(text: str) -> str:
        # Dates first: the dash filter would read 2026-06-30 as a number range.
        if lang != "en":
            text = docx_design.korean_dates(text)
        text = fix_dashes(text, design.get("micro_typography", {}).get("dashes"))
        text = fix_quotes(text)
        text = fix_unit_spacing(text)
        text = fix_ellipsis(text)
        return normalize_double_spaces(text)
    return apply


def convert_md_to_docx(
    md_path: Path,
    docx_path: Path,
    template_path: Path = None,
    publisher_name: str | None = None,
    registry_path: Path | None = None,
    locale: str = "auto",
    tonality: str | None = None,
    density: int | None = None,
    variance: int | None = None,
):
    """Convert Markdown file to DOCX.

    With a tonality (argument or frontmatter `tonality:`), the document is built
    by docx_design in that design direction. Without a tonality or a publisher,
    the plain profile runs through the same builders with neutral tokens (A4,
    Pretendard, booktabs tables, notice in every header).

    When publisher_name is set, apply the full journal pipeline: registry
    load, frontmatter parse, pre-MD filters, title-block injection, post-HTML
    heading numbering, booktabs tables, banned stripping, CJK font pairing.
    A publisher run writes the same document.xml as before the tonality
    engine unless the source holds figures (captions) or directives.
    """
    if publisher_name is None:
        md_text = read_source(md_path)
        front, body = parse_frontmatter(md_text) if md_text.startswith("---") else ({}, md_text)
        name = tonality or front.get("tonality")
        lang = "en" if (detect_locale(body) if locale == "auto" else locale) == "en" else "ko"
        dials = {k: v for k, v in (("density", density if density is not None else front.get("density")),
                                    ("variance", variance if variance is not None else front.get("variance"))) if v is not None}
        try:
            if name:
                T = docx_design.load_tonality(name, locale=lang, **{k: int(v) for k, v in dials.items()})
                filters = _typography(T.design, lang)
            else:
                T, filters = docx_design.neutral_tonality(lang), None
            doc = Document(str(template_path)) if template_path and template_path.exists() else Document()
            docx_design.build(doc, front, body, T, _md_renderer(md_path), lang, filters)
        except docx_design.DesignError as exc:
            raise SystemExit(f"Error: {exc}") from exc
        doc.save(str(docx_path))
        label = f"tonality={T.name}, density={T.density}, variance={T.variance}" if not T.neutral else "plain profile"
        print(f"Successfully converted {md_path} to {docx_path} [{label}, locale={lang}]")
        return

    # --- Journal workflow ---
    script_dir = Path(__file__).resolve().parent
    registry_path = registry_path or (script_dir.parent / "templates" / "registry.yaml")
    publisher = load_publisher(Path(registry_path), publisher_name)
    design = publisher["design"]
    docx_font = publisher["docx"]["font"]

    md_text = read_source(md_path)
    frontmatter, body = parse_frontmatter(md_text)
    if frontmatter.get("tonality"):
        raise SystemExit(f"Error: frontmatter tonality: {frontmatter['tonality']} and --publisher {publisher_name} are mutually exclusive")

    # Locale detection (informational in M1; Korean rules land in M6)
    detected_locale = detect_locale(body) if locale == "auto" else locale

    # Pre-MD micro-typography filters
    if detected_locale in ("ko", "mixed"):
        # Spec Amendments 4, A4.10 (every path): no ISO dates in Korean text. Before the dash filter, which would
        # read 2026-06-30 as a number range.
        body = docx_design.korean_dates(body)
        if frontmatter.get("date"):
            frontmatter["date"] = docx_design.format_date(frontmatter["date"], "ko")
    dash_rules = design.get("micro_typography", {}).get("dashes")

    def typeset(text: str) -> str:
        return normalize_double_spaces(fix_ellipsis(fix_unit_spacing(fix_quotes(fix_dashes(text, dash_rules)))))

    # A ::: fence line carries attributes (title="..."); curly quotes there would break the directive. The text
    # between fence lines is typeset as whole runs, so code fences and quote pairs keep their context and a
    # source without fences is typeset exactly as one piece.
    parts = re.split(r"^([ \t]*:{3,}.*)$", body, flags=re.M)
    body = "".join(part if i % 2 else typeset(part) for i, part in enumerate(parts))

    # Load template if available
    template_docx = script_dir.parent / "templates" / "docx" / f"{publisher_name}.docx"
    if template_docx.exists():
        doc = Document(str(template_docx))
        # The template includes a self-describing sample title block and
        # sample heading/body paragraph. Strip all existing body paragraphs
        # and tables so the conversion output is the user's content only.
        body_el = doc.element.body
        sect_pr = body_el.find(qn("w:sectPr"))
        for child in list(body_el):
            if child is sect_pr:
                continue
            body_el.remove(child)
        if sect_pr is None:
            pass  # keep original body even if no sectPr detected
    elif template_path and template_path.exists():
        doc = Document(str(template_path))
    else:
        doc = Document()

    # Title block (built from frontmatter) before main content
    if frontmatter.get("title"):
        inject_title_block(doc, frontmatter, design)
    if frontmatter.get("notice"):
        add_notice(doc, frontmatter["notice"])
    page_numbers(doc, design)

    # Main content
    if docx_design.has_directives(body):
        # Components in a journal manuscript are drawn with neutral styling (ink and line only).
        neutral = docx_design.neutral_tonality("en" if detected_locale == "en" else "ko")
        docx_design.setup_component_styles(doc, neutral)
        ctx = docx_design.Build(doc, neutral, _md_renderer(md_path), "en" if detected_locale == "en" else "ko")
        try:
            ctx.render(doc, body)
        except docx_design.DesignError as exc:
            raise SystemExit(f"Error: {exc}") from exc
        print("Note: the ::: components are drawn with publisher-neutral styling under a publisher profile")
    else:
        md_converter = markdown.Markdown(extensions=[
            'tables',
            'fenced_code',
            'nl2br',
            'sane_lists',
        ])
        html = md_converter.convert(body)
        html_to_docx(html, doc, md_path)

    # Post-HTML design enforcement
    apply_heading_numbering(doc, design)
    apply_table_style(doc, design)
    keep_tables_with_captions(doc)
    plain_table_cells(doc)
    publisher_spacing(doc)
    # No column narrower than its longest word (spec Amendments 4, todo 12b: "Cataly/st" in a publisher table).
    normal = doc.styles["Normal"].font.size
    for table in doc.tables:
        docx_design.fit_word_widths(table, normal.pt if normal else 11)
    docx_design.restart_numbered_lists(doc)
    docx_design.keep_short_lists(doc)
    strip_banned(doc, design)
    apply_cjk_font_pairing(doc, docx_font)
    drop_shadowed_theme_fonts(doc)

    doc.save(str(docx_path))
    print(
        f"Successfully converted {md_path} to {docx_path} "
        f"[publisher={publisher_name}, locale={detected_locale}]"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert Markdown to DOCX with proper styling"
    )
    parser.add_argument("input", help="Input Markdown file")
    parser.add_argument("output", help="Output DOCX file")
    parser.add_argument(
        "--template",
        help="Optional DOCX template to use as base",
        default=None,
    )
    parser.add_argument(
        "--publisher",
        help="Journal publisher profile from templates/registry.yaml (e.g. elsevier)",
        default=None,
    )
    parser.add_argument(
        "--registry",
        help="Path to templates/registry.yaml (defaults to the one in this skill)",
        default=None,
    )
    parser.add_argument(
        "--tonality",
        help="Design direction from templates/tonalities/: Report, Brief, Manual, Proposal, Memo or Journal "
             "(frontmatter tonality: works too)",
        default=None,
    )
    parser.add_argument("--density", type=int, default=None, help="Density dial 1-10 (default: the pack's)")
    parser.add_argument("--variance", type=int, default=None, help="Variance dial 1-10 (default: the pack's)")
    parser.add_argument(
        "--locale",
        choices=("auto", "en", "ko", "mixed"),
        default="auto",
        help="Force locale; 'auto' detects via Hangul codepoint ratio",
    )
    args = parser.parse_args()
    if args.publisher and args.template:
        parser.error("--publisher and --template are mutually exclusive")
    if args.publisher and args.tonality:
        parser.error("--tonality and --publisher are mutually exclusive: a tonality is a design direction, a publisher a journal profile")
    return args


def main() -> int:
    args = parse_args()

    md_path = Path(args.input).expanduser().resolve()
    docx_path = Path(args.output).expanduser().resolve()
    template_path = Path(args.template).expanduser().resolve() if args.template else None
    registry_path = Path(args.registry).expanduser().resolve() if args.registry else None

    if not md_path.exists():
        print(f"Error: Input file not found: {md_path}")
        return 1

    convert_md_to_docx(
        md_path, docx_path, template_path,
        publisher_name=args.publisher,
        registry_path=registry_path,
        locale=args.locale,
        tonality=args.tonality,
        density=args.density,
        variance=args.variance,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
