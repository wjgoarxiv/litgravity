"""Design directions (tonalities) and page components for convert_md_to_docx.py.

A tonality is a data file, templates/tonalities/<name>.yaml, merged over the korean-generic
`design:` tree of templates/registry.yaml; its two dials (density, variance) then set the page
margins, leading and body size. The converter reads the pack; nothing here forks per look.

The six tonalities differ in structure, not colour (docx-spec Amendments 4, "restraint"): what
stands on page 1 (a title block, a cover page, a memo block, a document-control block), how the
summary is set, how headings are numbered, which components a document may use and what the running
head carries. Every pack sets body and headings in near-black ink, booktabs tables without fills,
a quiet 1.2x type scale on an A4 page with 25 mm sides, and at most one accent colour on at most
two element kinds.

The Markdown dialect adds fenced directives (::: cover, callout, sidebar, pullquote, keyfigures,
columns; <!-- column-break --> inside columns) and a {style=...} attribute on table captions. The
pre-pass splits them out before Markdown sees the text, so no fence ever reaches the page. A
directive the tonality does not use, or one past the component budget, keeps its content as
ordinary text; a pull quote that repeats a sentence of the body is left out.

The plain profile (no tonality, no publisher) runs through the same builders with neutral tokens:
A4, Pretendard, booktabs tables, the notice in every header.
"""
from __future__ import annotations

import copy
import datetime as _dt
import math
import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Emu, Mm, Pt, RGBColor
from docx.table import Table
from docx.text.paragraph import Paragraph

SKILL_ROOT = Path(__file__).resolve().parent.parent
TONALITIES = ("Report", "Brief", "Manual", "Proposal", "Memo", "Journal")
NUMBERING = ("none", "decimal", "roman-ko")
TITLE_BLOCKS = ("masthead", "cover", "memo", "manual")
RUNNING_ITEMS = ("title", "folio", "section")
TABLE_STYLES = ("booktabs", "banded", "light-grid", "header-fill")  # caption attributes; every tonality draws booktabs
COVERS = ("typographic", "band", "split", "masthead")               # ::: cover variant= values the source may name
KINDS = ("callout", "sidebar", "pullquote", "keyfigures", "columns")
CALLOUT_KINDS = ("note", "key", "warning")
CALLOUT_PRIORITY = {"key": 0, "warning": 1, "note": 2}
NOTICE = ("A21B12", "FDECEA")  # the plain and publisher profiles' example-data tag: ink on fill
LABELS = {
    "ko": {"note": "참고", "key": "핵심", "warning": "주의", "abstract": "초록", "keywords": "주요어", "contents": "목차",
           "memo": "메모", "to": "받는 사람", "from": "보내는 사람", "date": "날짜", "subject": "제목", "unit": "단위",
           "doc": "문서", "owner": "작성 부서", "org": "기관", "issued": "시행일"},
    "en": {"note": "Note", "key": "Key point", "warning": "Warning", "abstract": "Abstract", "keywords": "Keywords", "contents": "Contents",
           "memo": "Memo", "to": "To", "from": "From", "date": "Date", "subject": "Subject", "unit": "Unit",
           "doc": "Document", "owner": "Owner", "org": "Organisation", "issued": "Issued"},
}
PACK_KEYS = {"schema_version", "tonality", "summary", "dials", "docx", "design"}
DESIGN_KEYS = {"ramp", "numbering", "h1_rule", "title_block", "contents", "summary_form", "conclusion_first", "running_head", "justify",
               "palette", "accent_on", "page_geometry", "components", "figure_style", "spacing"}
ACCENT_PLACES = ("title_rule", "callout_rule", "sidebar_rule")
DIRECTIVE_KEYS = {
    "cover": {"variant", "image", "kicker"},
    "callout": {"kind", "title"},
    "sidebar": {"title", "width", "float"},
    "pullquote": {"cite"},
    "keyfigures": {"cols"},
    "columns": {"gap", "rule"},
}
SOURCE_LINE = re.compile(r"^(출처|자료|주|Source|Sources|Note|Notes)\s*[:：]")
CAPTION_ATTR = re.compile(r"^((?:표|Table)[ \t]*\d+\..*?)[ \t]*\{style=([a-z-]+)\}[ \t]*$", re.M)
TABLE_CAPTION = re.compile(r"^(?:표|Table)\s*\d+[.:]|^<표\s*\d+>")
FIGURE_LABEL = re.compile(r"^((?:Figure|Fig\.|그림|도)\s*\d+[.:])\s*")
TOTALS = re.compile(r"^(합계|총계|소계|계|total|sum)(?![\w])", re.I)
ISO_DATE = re.compile(r"(?<![\d-])((?:19|20)\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?![\d-])")
BACK_MATTER = re.compile(r"^(references|bibliography|acknowledg(e)?ments?|참고\s*문헌|감사의\s*글)$", re.I)
ROMAN = "ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ"
# A single line in em, measured on rendered pages (Word 1.55 / LibreOffice 1.51 for Pretendard; the mean is used).
SINGLE_EM = {"Pretendard": 1.53, "Times New Roman": 1.15}
GANADA = "가나다라마바사아자차카타파하"
CIRCLED = "①②③④⑤"
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")


class DesignError(ValueError):
    """A pack, dial or directive the engine cannot honour; the message names what is allowed."""


# ── Packs and dials ──────────────────────────────────────────────────────────

def _merge(base: dict, over: dict) -> dict:
    out = copy.deepcopy(base)
    for key, value in (over or {}).items():
        out[key] = _merge(out[key], value) if isinstance(value, dict) and isinstance(out.get(key), dict) else copy.deepcopy(value)
    return out


def _half(x: float) -> float:
    return math.floor(x * 2 + 0.5) / 2


# Margins (top, bottom, left, right) in mm by density: sides never under 25 mm (a text block of at most
# 160 mm on A4) and the bottom never under the top (docx-spec Amendments 4, A4.3).
MARGINS = [(2, (30, 32, 30, 30)), (4, (28, 30, 28, 28)), (6, (27, 29, 27, 27)), (8, (26, 28, 26, 26)), (9, (25, 27, 25, 25)), (10, (24, 26, 25, 25))]


@dataclass
class Tonality:
    name: str
    dials: dict
    design: dict
    docx: dict
    locale: str = "ko"
    neutral: bool = False
    palette: dict = field(default_factory=dict)

    # Derived tokens; the converter reads these and never a number of its own.
    @property
    def density(self) -> int:
        return self.dials["density"]

    @property
    def variance(self) -> int:
        return self.dials["variance"]

    @property
    def margins_mm(self) -> tuple:
        return next(m for d, m in MARGINS if self.density <= d)

    @property
    def body_pt(self) -> float:
        font = self.docx.get("font", {})
        b = float(font.get("body_pt_en" if self.locale == "en" else "body_pt_ko", 10.5))
        b += 0.5 if self.density <= 3 else 0
        return max(10.5, b)  # the readable floor: body text never under 10.5 pt

    @property
    def tight(self) -> bool:
        """A pack that keeps short documents on one page (Memo): the low end of the A4.3 pitches, tighter heading space."""
        return self.design.get("spacing") == "tight"

    @property
    def pitch(self) -> float:
        """Body line pitch over the body size (A4.3): Hangul 175-185 %, Latin 130-140 %; a tight pack 165 % / 120 %
        (the low ends of A4.3)."""
        en = self.locale == "en"
        if self.tight:
            return 1.2 if en else 1.65
        return (1.4 if en else 1.85) if self.density <= 4 else (1.37 if en else 1.8) if self.density <= 7 else (1.33 if en else 1.75)

    def line(self, pitch: float, face: str | None = None) -> float:
        """The Word "multiple" that sets a line pitch of `pitch` times the size in the given face (the body face
        when omitted). A single line is not 1.0 em: measured on rendered pages, Pretendard's is 1.55 em in Word
        and 1.51 em in LibreOffice (task-12b/leading-calibration.txt), Times New Roman's about 1.15 em."""
        face = face or self.fonts["latin" if self.locale == "en" else "hangul"]
        return round(pitch / SINGLE_EM.get(face, SINGLE_EM["Pretendard"]), 3)

    @property
    def leading(self) -> float:
        """Body line spacing as a Word multiple (the pitch over the face's single line)."""
        return self.line(self.pitch)

    @property
    def unit(self) -> float:
        return self.body_pt * self.pitch

    @property
    def sizes(self) -> dict:
        b, ramp = self.body_pt, self.design.get("ramp") or {}
        return {"h1": _half(b * float(ramp.get("h1", 1.4))), "h2": _half(b * float(ramp.get("h2", 1.2))), "h3": b, "h4": b,
                "title": _half(b * float(ramp.get("title", 2.5)))}

    @property
    def table_pt(self) -> float:
        return max(9.0, _half(self.body_pt * 0.92))

    @property
    def note_pt(self) -> float:
        return max(8.5, self.table_pt - 0.5)

    @property
    def furniture_pt(self) -> float:
        return max(8.5, _half(self.body_pt * 0.82))

    @property
    def keyfigure_pt(self) -> float:
        # A key figure is one modest step above the body, never a display number.
        return self.sizes["h2"]

    @property
    def numbering(self) -> str:
        n = self.design.get("numbering") or "none"
        if isinstance(n, dict):
            n = n.get(self.locale) or n.get("default") or "none"
        return n

    @property
    def title_block(self) -> str:
        return self.design.get("title_block") or "masthead"

    @property
    def running_head(self) -> dict:
        return self.design.get("running_head") or {}

    @property
    def columns(self) -> int:
        return int((self.design.get("page_geometry") or {}).get("columns", 1) or 1)

    @property
    def column_gap_mm(self) -> float:
        return float((self.design.get("page_geometry") or {}).get("column_gap_cm", 0.6)) * 10

    @property
    def components(self) -> dict:
        return self.design.get("components") or {}

    @property
    def allowed_kinds(self) -> list:
        return list(self.components.get("allowed") or [])

    @property
    def justify(self) -> bool:
        j = self.design.get("justify", "ko")
        return j == "all" or (j == "ko" and self.locale != "en")

    @property
    def fonts(self) -> dict:
        f = self.docx.get("font", {})
        return {"latin": f.get("latin", "Pretendard"), "hangul": f.get("hangul", "Pretendard"), "heading": f.get("heading", "Pretendard")}

    def colour(self, role: str) -> str:
        return self.palette[role]

    def accent_for(self, place: str) -> str:
        """The accent on the places the pack names (at most two element kinds), ink everywhere else."""
        return self.palette["accent"] if place in (self.design.get("accent_on") or []) else self.palette["ink"]


def _registry_base(registry: Path | None = None) -> dict:
    path = registry or SKILL_ROOT / "templates" / "registry.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return copy.deepcopy(data["publishers"]["korean-generic"]["design"])


def _check(value, allowed, what):
    if value not in allowed:
        raise DesignError(f"{what} {value!r} is not one of: {', '.join(allowed)}")


def load_tonality(name: str, density: int | None = None, variance: int | None = None, locale: str = "ko", registry: Path | None = None) -> Tonality:
    """Load a pack by name (any case), merge it over the korean-generic design tree and apply the dials."""
    match = next((t for t in TONALITIES if t.lower() == str(name).strip().lower()), None)
    if not match:
        raise DesignError(f"unknown tonality {name!r}; the tonalities are {', '.join(sorted(TONALITIES))}")
    pack = yaml.safe_load((SKILL_ROOT / "templates" / "tonalities" / f"{match.lower()}.yaml").read_text(encoding="utf-8"))
    unknown = set(pack) - PACK_KEYS
    if unknown:
        raise DesignError(f"{match}: unknown pack keys {sorted(unknown)}; allowed {sorted(PACK_KEYS)}")
    unknown = set(pack.get("design") or {}) - DESIGN_KEYS
    if unknown:
        raise DesignError(f"{match}: unknown design keys {sorted(unknown)}; allowed {sorted(DESIGN_KEYS)}")
    dials = dict(pack.get("dials") or {})
    for key, value in (("density", density), ("variance", variance)):
        if value is not None:
            dials[key] = value
        if not isinstance(dials.get(key), int) or not 1 <= dials[key] <= 10:
            raise DesignError(f"{match}: dial {key} must be an integer from 1 to 10, got {dials.get(key)!r}")
    design = _merge(_registry_base(registry), pack.get("design") or {})
    numbering = design.get("numbering") or "none"
    for value in (numbering.values() if isinstance(numbering, dict) else [numbering]):
        _check(value, NUMBERING, f"{match} numbering")
    _check(design.get("title_block", "masthead"), TITLE_BLOCKS, f"{match} title_block")
    _check(design.get("h1_rule", "none"), ("none", "above"), f"{match} h1_rule")
    _check(design.get("spacing", "normal"), ("normal", "tight"), f"{match} spacing")
    for where, items in (design.get("running_head") or {}).items():
        _check(where, ("header", "footer", "folio_align"), f"{match} running_head key")
        if where != "folio_align":
            for item in items:
                _check(item, RUNNING_ITEMS, f"{match} running_head.{where}")
    for place in design.get("accent_on") or []:
        _check(place, ACCENT_PLACES, f"{match} accent_on")
    if len(design.get("accent_on") or []) > 2:
        raise DesignError(f"{match}: the accent marks at most two element kinds, got {design['accent_on']}")
    for kind in (design.get("components") or {}).get("allowed") or []:
        _check(kind, KINDS, f"{match} components.allowed")
    if "pullquote" in ((design.get("components") or {}).get("allowed") or []):
        raise DesignError(f"{match}: pull quotes are off in every tonality")
    pal = design.get("palette") or {}
    palette = {"ink": str(pal.get("ink", "1A1A1A")).lstrip("#").upper(), "ink_muted": str(pal.get("ink_muted", "555555")).lstrip("#").upper(),
               "line": str(pal.get("line", "8C8C8C")).lstrip("#").upper()}
    palette["accent"] = str(pal["accent"]).lstrip("#").upper() if pal.get("accent") else palette["ink"]
    return Tonality(match, dials, design, dict(pack.get("docx") or {}), locale, False, palette)


def neutral_tonality(locale: str = "ko") -> Tonality:
    """The plain profile's tokens: ink and line only, booktabs tables, plain headings, notice-only header."""
    design = _registry_base()
    design.update({
        "ramp": {"h1": 1.4, "h2": 1.2, "title": 2.1},
        "numbering": "none",
        "title_block": "masthead",
        "figure_style": {"max_height_ratio": 0.45},
        "page_geometry": {"columns": 1, "column_gap_cm": 0.6},
        "components": {"allowed": [k for k in KINDS if k != "pullquote"], "keyfigures": {"per_row": 3}, "sidebar": {"default_width": "third", "float": "right"}},
        "justify": "none",
    })
    palette = {"ink": "1A1A1A", "ink_muted": "555555", "line": "8C8C8C", "accent": "1A1A1A"}
    docx_cfg = {"font": {"latin": "Pretendard", "hangul": "Pretendard", "heading": "Pretendard", "body_pt_ko": 10.5, "body_pt_en": 10.5}}
    return Tonality("plain", {"density": 7, "variance": 10}, design, docx_cfg, locale, True, palette)


def format_date(value, lang: str) -> str:
    """A frontmatter or body date as a reader writes it: 2026. 10. 1. in Korean, 1 October 2026 in English
    (docx-spec Amendments 4, A4.10: no ISO dates in Korean text)."""
    if isinstance(value, (_dt.date, _dt.datetime)):
        y, m, d = value.year, value.month, value.day
    else:
        found = ISO_DATE.fullmatch(str(value).strip())
        if not found:
            return str(value)
        y, m, d = (int(x) for x in found.groups())
    return f"{y}. {m}. {d}." if lang != "en" else f"{d} {MONTHS[m - 1]} {y}"


def korean_dates(text: str) -> str:
    """ISO dates in Korean Markdown, written the Korean way; a date that opens a line escapes its first full stop,
    or Markdown would read "2026. 6. 30." as a numbered list."""
    def korean(m):
        escape = "\\" if m.start() == 0 or text[m.start() - 1] == "\n" else ""
        return f"{int(m.group(1))}{escape}. {int(m.group(2))}. {int(m.group(3))}."
    return ISO_DATE.sub(korean, text)


# ── Directive pre-pass ──────────────────────────────────────────────────────

@dataclass
class Directive:
    name: str
    args: list
    attrs: dict
    body: str
    line: int


_OPEN = re.compile(r"^(:{3,})[ \t]+([A-Za-z]+)(.*)$")
_ARG = re.compile(r'\s*([a-z_]+)=("(?:[^"\\]|\\")*"|[A-Za-z0-9_.%-]+)|\s*([A-Za-z0-9_.%-]+)')
COLUMN_BREAK = re.compile(r"^\s*<!--\s*column-break\s*-->\s*$", re.M)


def _parse_args(name: str, rest: str, line: int) -> tuple[list, dict]:
    args, attrs, pos = [], {}, 0
    rest = rest.rstrip()
    while pos < len(rest):
        m = _ARG.match(rest, pos)
        if not m or m.end() == pos:
            raise DesignError(f"line {line}: cannot read the attributes of ::: {name}: {rest[pos:]!r}")
        if m.group(1):
            key, value = m.group(1), m.group(2)
            if key in attrs:
                raise DesignError(f"line {line}: ::: {name} repeats {key}=")
            if key not in DIRECTIVE_KEYS[name]:
                raise DesignError(f"line {line}: ::: {name} has no attribute {key}; it takes {', '.join(sorted(DIRECTIVE_KEYS[name]))}")
            attrs[key] = value[1:-1].replace('\\"', '"') if value.startswith('"') else value
        else:
            args.append(m.group(3))
        pos = m.end()
    return args, attrs


def split_directives(text: str, offset: int = 0) -> list:
    """The source as a list of Markdown strings and Directive blocks, in order. Fenced code stays text."""
    lines = text.split("\n")
    out, buf, i, code = [], [], 0, False
    while i < len(lines):
        line = lines[i]
        if line.lstrip().startswith(("```", "~~~")):
            code = not code
        m = None if code else _OPEN.match(line)
        if m:
            fence, name = m.group(1), m.group(2)
            if name not in DIRECTIVE_KEYS:
                raise DesignError(f"line {offset + i + 1}: unknown directive ::: {name}; directives are {', '.join(DIRECTIVE_KEYS)}")
            j = i + 1
            while j < len(lines) and lines[j].strip() != fence:
                j += 1
            if j == len(lines):
                raise DesignError(f"line {offset + i + 1}: ::: {name} is never closed (a line of {len(fence)} colons)")
            if buf:
                out.append("\n".join(buf))
                buf = []
            args, attrs = _parse_args(name, m.group(3), offset + i + 1)
            out.append(Directive(name, args, attrs, "\n".join(lines[i + 1:j]), offset + i + 2))
            i = j + 1
            continue
        if not code and re.match(r"^:{3,}\s*$", line):
            raise DesignError(f"line {offset + i + 1}: a closing fence with no directive open")
        buf.append(line)
        i += 1
    if buf:
        out.append("\n".join(buf))
    return out


def has_directives(text: str) -> bool:
    return any(isinstance(b, Directive) for b in split_directives(text)) or bool(COLUMN_BREAK.search(text))


# ── XML helpers ─────────────────────────────────────────────────────────────

PPR_ORDER = ["pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl", "numPr", "suppressLineNumbers", "pBdr", "shd",
             "tabs", "suppressAutoHyphens", "kinsoku", "wordWrap", "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi",
             "adjustRightInd", "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection",
             "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"]
TBLPR_ORDER = ["tblStyle", "tblpPr", "tblOverlap", "bidiVisual", "tblStyleRowBandSize", "tblStyleColBandSize", "tblW", "jc", "tblCellSpacing",
               "tblInd", "tblBorders", "shd", "tblLayout", "tblCellMar", "tblLook", "tblCaption", "tblDescription"]
TCPR_ORDER = ["cnfStyle", "tcW", "gridSpan", "hMerge", "vMerge", "tcBorders", "shd", "noWrap", "tcMar", "textDirection", "tcFitText", "vAlign", "hideMark"]
RPR_ORDER = ["rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike", "dstrike", "outline", "shadow", "emboss", "imprint",
             "noProof", "snapToGrid", "vanish", "webHidden", "color", "spacing", "w", "kern", "position", "sz", "szCs", "highlight", "u",
             "effect", "bdr", "shd", "fitText", "vertAlign", "rtl", "cs", "em", "lang", "eastAsianLayout", "specVanish", "oMath"]
SECTPR_ORDER = ["headerReference", "footerReference", "footnotePr", "endnotePr", "type", "pgSz", "pgMar", "paperSrc", "pgBorders", "lnNumType",
                "pgNumType", "cols", "formProt", "vAlign", "noEndnote", "titlePg", "textDirection", "bidi", "rtlGutter", "docGrid", "printerSettings"]


def _el(tag: str, **attrs):
    el = OxmlElement(f"w:{tag}")
    for key, value in attrs.items():
        el.set(qn(f"w:{key}"), str(value))
    return el


def _put(parent, child, order):
    """Insert child into parent in schema order, replacing an element of the same tag."""
    for old in parent.findall(child.tag):
        parent.remove(old)
    names = [qn(f"w:{n}") for n in order]
    later = set(names[names.index(child.tag) + 1:]) if child.tag in names else set()
    for el in parent:
        if el.tag in later:
            el.addprevious(child)
            return child
    parent.append(child)
    return child


def _borders(tag: str, sides: dict, order=None):
    box = _el(tag)
    for side in order or ("top", "left", "bottom", "right", "insideH", "insideV"):
        if side in sides:
            spec = sides[side]
            if spec is None:
                box.append(_el(side, val="nil"))
            else:
                sz, colour = spec[:2]
                space = spec[2] if len(spec) > 2 else 0
                box.append(_el(side, val="single", sz=int(sz), space=space, color=colour))
    return box


def para_border(p: Paragraph, sides: dict):
    _put(p._p.get_or_add_pPr(), _borders("pBdr", sides, ("top", "left", "bottom", "right", "between")), PPR_ORDER)


def run_shade(run, fill: str):
    _put(run._r.get_or_add_rPr(), _el("shd", val="clear", color="auto", fill=fill), RPR_ORDER)


def set_run_fonts(rpr, latin: str, hangul: str):
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = _put(rpr, _el("rFonts"), RPR_ORDER)
    for key in ("asciiTheme", "hAnsiTheme", "eastAsiaTheme", "cstheme", "hint"):
        if rf.get(qn(f"w:{key}")) is not None:
            del rf.attrib[qn(f"w:{key}")]
    rf.set(qn("w:ascii"), latin)
    rf.set(qn("w:hAnsi"), latin)
    rf.set(qn("w:cs"), latin)
    rf.set(qn("w:eastAsia"), hangul)


def styled_run(p: Paragraph, text: str, size: float | None = None, colour: str | None = None, bold: bool | None = None, font: tuple | None = None):
    run = p.add_run(text)
    if size:
        run.font.size = Pt(size)
    if colour:
        run.font.color.rgb = RGBColor.from_string(colour)
    if bold is not None:
        run.bold = bold
    if font:
        set_run_fonts(run._r.get_or_add_rPr(), *font)
    return run


def _advance(text: str, size: float) -> float:
    """Estimated width in points of bold display type: a Hangul syllable a full em, Latin by letter class."""
    em = 0.0
    for ch in text:
        if "가" <= ch <= "힣" or "ㄱ" <= ch <= "ㆎ" or "一" <= ch <= "鿿":
            em += 1.0
        elif ch == " ":
            em += 0.28
        elif ch.isupper() or ch in "mwMW%&@":
            em += 0.74
        elif ch.isdigit():
            em += 0.62
        elif ch.isalpha():
            em += 0.58
        else:
            em += 0.4
    return em * size


TITLE_LINES = 3


def wrap_words(text: str, size: float, width_pt: float) -> list[str]:
    """Break a display line between words only, into the fewest lines that fit the measure, with the
    lines as even as that count allows (least squared slack); a line never ends inside a word (제/안서)."""
    words = text.split()
    if not words or _advance(text, size) <= width_pt:
        return [" ".join(words)]
    measure = lambda i, j: _advance(" ".join(words[i:j]), size)  # noqa: E731
    n = len(words)
    for lines in range(2, n + 1):
        best = {0: (0.0, [])}  # words placed -> (squared slack so far, break positions)
        for _ in range(lines):
            nxt = {}
            for i, (cost, cuts) in best.items():
                for j in range(i + 1, n + 1):
                    w = measure(i, j)
                    if w > width_pt:
                        break
                    cand = (cost + (width_pt - w) ** 2, cuts + [j])
                    if j not in nxt or cand[0] < nxt[j][0]:
                        nxt[j] = cand
            best = nxt
        if n in best:
            cuts = [0] + best[n][1]
            return [" ".join(words[a:b]) for a, b in zip(cuts, cuts[1:])]
    return [" ".join(words)]


def display_run(p: Paragraph, text: str, size: float, width_emu: int, colour: str, bold: bool, font: tuple):
    """A title at its size, broken between words for its measure in at most three lines; a word wider
    than the measure, or a fourth line, steps the size down."""
    width_pt = width_emu / 12700 * 0.94  # keep a margin for metric differences between renderers
    words = str(text).split() or [""]
    while size > 14 and (max(_advance(w, size) for w in words) > width_pt or len(wrap_words(str(text), size, width_pt)) > TITLE_LINES):
        size -= 1
    lines = wrap_words(str(text), size, width_pt)
    for i, line in enumerate(lines):
        last = i == len(lines) - 1
        run = styled_run(p, line if last else line + " ", size, colour, bold, font)  # the space keeps the text whole
        if not last:
            run.add_break()
    return size


def add_field(p: Paragraph, instr: str, size: float, colour: str, placeholder: str = "1"):
    fld = _el("fldSimple", instr=instr)
    r = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")
    _put(rpr, _el("color", val=colour), RPR_ORDER)
    _put(rpr, _el("sz", val=int(size * 2)), RPR_ORDER)
    r.append(rpr)
    t = OxmlElement("w:t")
    t.text = placeholder
    r.append(t)
    fld.append(r)
    p._p.append(fld)


def tiny(p: Paragraph):
    """A structural paragraph (section or column break carrier) that takes no visible height."""
    pf = p.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = Pt(0)
    pf.line_spacing = Pt(1)
    rpr = p._p.get_or_add_pPr()
    mark = _put(rpr, _el("rPr"), PPR_ORDER)
    mark.append(_el("sz", val=2))


def tbl_set(table, tag: str, el):
    tblPr = table._tbl.tblPr
    _put(tblPr, el, TBLPR_ORDER)


def cell_set(cell, el):
    _put(cell._tc.get_or_add_tcPr(), el, TCPR_ORDER)


def cell_margins(table, top: float, bottom: float, left: float, right: float):
    mar = _el("tblCellMar")
    for side, v in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        mar.append(_el(side, w=int(v * 20), type="dxa"))
    tbl_set(table, "tblCellMar", mar)


def mark_component(table, kind: str):
    tbl_set(table, "tblCaption", _el("tblCaption", val=kind))


def table_width(table, width_emu: int, widths: list | None = None):
    tbl_set(table, "tblW", _el("tblW", w=int(width_emu / 635), type="dxa"))
    tbl_set(table, "tblLayout", _el("tblLayout", type="fixed"))
    table.autofit = False
    cols = len(table.columns)
    widths = widths or [width_emu // cols] * cols
    for ci, column in enumerate(table.columns):
        column.width = Emu(widths[ci])
    for row in table.rows:
        for ci, cell in enumerate(row.cells):
            cell.width = Emu(widths[ci])


def no_borders(table):
    tbl_set(table, "tblBorders", _borders("tblBorders", {s: None for s in ("top", "left", "bottom", "right", "insideH", "insideV")}))


# ── Containers ──────────────────────────────────────────────────────────────

class _FrameSection:
    """Stands in for a section where shape_table reads the usable width (a cell or a column)."""

    def __init__(self, width: int):
        self.page_width, self.left_margin, self.right_margin = Emu(width), Emu(0), Emu(0)


class Box:
    """A table cell that html_to_docx can write into as it writes into a document."""

    def __init__(self, cell, width: int, doc):
        self.cell, self.width, self.doc = cell, width, doc
        self.sections = [_FrameSection(width)]
        self.styles = doc.styles
        self._fresh = True

    def add_paragraph(self, text: str = "", style=None):
        if self._fresh and len(self.cell.paragraphs) == 1 and not self.cell.paragraphs[0].text and not len(self.cell.tables):
            p = self.cell.paragraphs[0]
            if text:
                p.add_run(text)
            if style:
                p.style = style
        else:
            p = self.cell.add_paragraph(text, style)
        self._fresh = False
        return p

    def add_heading(self, text: str = "", level: int = 1):
        return self.add_paragraph(text, f"Heading {level}")

    def add_table(self, rows: int, cols: int):
        self._fresh = False
        return self.cell.add_table(rows, cols)

    @property
    def paragraphs(self):
        return self.cell.paragraphs


def frame_width(doc) -> int:
    s = doc.sections[-1]
    return int(s.page_width - s.left_margin - s.right_margin)


def frame_height(doc) -> int:
    s = doc.sections[-1]
    return int(s.page_height - s.top_margin - s.bottom_margin)


def span(doc, n: int, of: int = 12, width: int | None = None) -> int:
    """n of 12 grid columns with a 4 mm gutter (docx-spec D1.3)."""
    w = width or frame_width(doc)
    gutter = Mm(4)
    col = (w - (of - 1) * gutter) / of
    return int(n * col + (n - 1) * gutter)


# ── Document setup: page, styles, fonts ─────────────────────────────────────

def set_page(section, T: Tonality):
    size = ((T.docx.get("page") or {}).get("size", "A4"))
    section.page_width, section.page_height = (Mm(215.9), Mm(279.4)) if size == "Letter" else (Mm(210), Mm(297))
    top, bottom, left, right = T.margins_mm
    section.top_margin, section.bottom_margin, section.left_margin, section.right_margin = Mm(top), Mm(bottom), Mm(left), Mm(right)
    section.header_distance = section.footer_distance = Mm(min(12, top - 10))


def _style(doc, name: str, base: str | None = "Normal"):
    from docx.enum.style import WD_STYLE_TYPE
    try:
        return doc.styles[name]
    except KeyError:
        st = doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
        if base:
            st.base_style = doc.styles[base]
        return st


def _fmt(st, size=None, colour=None, bold=None, italic=False, before=None, after=None, line=None, keep=None, font=None):
    if size:
        st.font.size = Pt(size)
    if colour:
        st.font.color.rgb = RGBColor.from_string(colour)
    if bold is not None:
        st.font.bold = bold
    st.font.italic = italic
    pf = st.paragraph_format
    if before is not None:
        pf.space_before = Pt(before)
    if after is not None:
        pf.space_after = Pt(after)
    if line is not None:
        pf.line_spacing = line
    if keep is not None:
        pf.keep_with_next = keep
    if font:
        set_run_fonts(st.element.get_or_add_rPr(), *font)


def korean_line_breaking(doc):
    """Hangul wraps between words (어절) in Word: wordWrap on, kinsoku on, and the text marked Korean. The probe
    through Word itself (task-12b/word-probe) broke between syllables with wordWrap 0 and between words with
    wordWrap 1 or none; LibreOffice breaks between syllables whatever the paragraph says."""
    ppr = doc.styles["Normal"].element.get_or_add_pPr()
    _put(ppr, _el("kinsoku", val=1), PPR_ORDER)
    _put(ppr, _el("wordWrap", val=1), PPR_ORDER)
    rpr = doc.styles.element.find(qn("w:docDefaults")).find(qn("w:rPrDefault")).find(qn("w:rPr"))
    lang = rpr.find(qn("w:lang"))
    if lang is None:
        lang = _put(rpr, _el("lang"), RPR_ORDER)
    lang.set(qn("w:eastAsia"), "ko-KR")


def setup_styles(doc, T: Tonality):
    f = T.fonts
    body_font = (f["latin"], f["hangul"])
    head_font = (f["heading"], f["hangul"])
    ink, muted = T.colour("ink"), T.colour("ink_muted")
    after = (5 if T.locale != "en" else 4) if T.tight else (6 if T.locale != "en" else 5)  # paragraphs part by space, never by space and an indent
    normal = doc.styles["Normal"]
    _fmt(normal, T.body_pt, ink, None, False, 0, after, T.leading, None, body_font)
    normal.paragraph_format.widow_control = True
    normal.paragraph_format.first_line_indent = Pt(0)
    normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY if T.justify else WD_ALIGN_PARAGRAPH.LEFT
    sizes = T.sizes
    # Levels part by weight and space (space above about twice the space below), never by colour.
    steps = ((1, 12, 5), (2, 10, 4), (3, 9, 3), (4, 8, 3)) if T.tight else ((1, 22, 9), (2, 15, 6), (3, 11, 4), (4, 9, 3))
    for level, before, below in steps:
        st = doc.styles[f"Heading {level}"]
        _fmt(st, sizes[f"h{level}"], ink, True, False, before, below, T.line(1.3, f["heading"]), True, head_font)
        st.paragraph_format.left_indent = Pt(0)
        st.paragraph_format.first_line_indent = Pt(0)
        st.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    if T.design.get("h1_rule") == "above":
        # Brief: an unnumbered section opens under a full-width ink hairline instead of a number.
        _put(doc.styles["Heading 1"].element.get_or_add_pPr(), _borders("pBdr", {"top": (4, ink, 6)}, ("top", "left", "bottom", "right", "between")), PPR_ORDER)
    caption = _style(doc, "Caption")
    _fmt(caption, T.table_pt, ink, False, False, 4, 4, T.line(1.4), None, body_font)
    caption.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    note = _style(doc, "Source Note")
    _fmt(note, T.note_pt, muted, False, False, 3, 8, T.line(1.4), None, body_font)
    note.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    quote = _style(doc, "Quote")
    _fmt(quote, T.body_pt, ink, False, False, 4, 6, T.leading, None, body_font)
    quote.paragraph_format.left_indent = Mm(6)
    for name in ("List Bullet", "List Number", "List Bullet 2", "List Number 2"):
        try:
            _fmt(doc.styles[name], T.body_pt, ink, None, False, 0, 3, T.leading, None, body_font)
            doc.styles[name].paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        except KeyError:
            pass
    for name in ("Title", "Subtitle", "Intense Quote", "TOC Heading"):
        try:
            set_run_fonts(doc.styles[name].element.get_or_add_rPr(), *head_font)
        except KeyError:
            pass
    # Every style the document carries is in ink, including the ones this build does not use (Heading 5-9,
    # Title, Intense Quote): a reader who applies them later gets no colour either.
    for el in doc.styles.element.iter(qn("w:color")):
        el.set(qn("w:val"), ink)
        for key in ("themeColor", "themeShade", "themeTint"):
            if el.get(qn(f"w:{key}")) is not None:
                del el.attrib[qn(f"w:{key}")]
    declare_fonts(doc, body_font, head_font, T.locale)
    if T.locale != "en":
        korean_line_breaking(doc)


def setup_component_styles(doc, T: Tonality):
    """Only the styles the components need, for a document whose other styles belong to a publisher."""
    _fmt(_style(doc, "Source Note"), T.note_pt, T.colour("ink_muted"), False, False, 3, 8, 1.2)


def declare_fonts(doc, body_font: tuple, head_font: tuple, locale: str = "en"):
    """Name the pack's faces everywhere a renderer looks: the document defaults, every style that
    names a font or a theme font, the theme itself and the bullet glyphs of the numbering part.
    Word's own defaults (Calibri, Cambria, Symbol, the theme's Hangul face) are what LibreOffice
    replaced with Carlito, Caladea and Malgun Gothic before. Korean lists take a plain dash."""
    styles = doc.styles.element
    defaults = styles.find(qn("w:docDefaults"))
    rpr = defaults.find(qn("w:rPrDefault")).find(qn("w:rPr"))
    set_run_fonts(rpr, *body_font)
    for st in styles.findall(qn("w:style")):
        r = st.find(qn("w:rPr"))
        rf = r.find(qn("w:rFonts")) if r is not None else None
        if rf is None:
            continue
        if (rf.get(qn("w:ascii")) or "").startswith("Courier"):
            set_run_fonts(r, "Courier New", body_font[1])
            continue
        heading = (st.get(qn("w:styleId")) or "").startswith(("Heading", "Title", "Subtitle"))
        set_run_fonts(r, *(head_font if heading else body_font))
    for part in doc.part.package.iter_parts():
        if str(part.partname).startswith("/word/theme/"):
            blob = part.blob.decode("utf-8")
            blob = re.sub(r'(<a:(?:latin|ea|cs) typeface=")[^"]*(")', rf"\g<1>{body_font[1]}\g<2>", blob)
            blob = re.sub(r'<a:font script="[^"]*" typeface="[^"]*"/>', "", blob)
            part._blob = blob.encode("utf-8")
    try:
        numbering = doc.part.numbering_part.element
    except Exception:
        return
    glyphs = ["–", "–", "–"] if locale != "en" else ["•", "–", "▪"]
    for lvl in numbering.iter(qn("w:lvl")):
        fmt = lvl.find(qn("w:numFmt"))
        if fmt is not None and fmt.get(qn("w:val")) == "bullet":
            level = int(lvl.get(qn("w:ilvl"), "0"))
            lvl.find(qn("w:lvlText")).set(qn("w:val"), glyphs[level % 3])
        r = lvl.find(qn("w:rPr"))
        if r is None:
            r = OxmlElement("w:rPr")
            lvl.append(r)
        set_run_fonts(r, body_font[1], body_font[1])


# ── Components ──────────────────────────────────────────────────────────────

def _strip_md(text: str) -> str:
    return re.sub(r"[*_`]", "", text).strip()


def _inline(p: Paragraph, text: str, size=None, colour=None, bold=None):
    """Markdown bold (**…**) inside a short line, as runs."""
    for i, part in enumerate(re.split(r"\*\*(.+?)\*\*", text)):
        if part:
            styled_run(p, part, size, colour, True if i % 2 else bold)


def _with_basis(label: str, basis: list) -> str:
    """A key figure's label with its basis in brackets; a label that already ends in brackets takes the basis
    inside them ("품목 (예시, 2026년 9월 기준)"), never a second pair."""
    if not basis:
        return label
    if label.endswith(")"):
        return f"{label[:-1]}, {', '.join(basis)})"
    return f"{label} ({', '.join(basis)})"


def keyfigure_items(body: str, line: int) -> list:
    """`- **figure** label` items; an indented `- …` under one is its basis (period and source)."""
    items = []
    for raw in body.split("\n"):
        if not raw.strip():
            continue
        m = re.match(r"^(\s*)[-*]\s+(.*)$", raw)
        if not m:
            raise DesignError(f"line {line}: ::: keyfigures holds one list; {raw.strip()!r} is not a list item")
        if m.group(1) and items:
            items[-1]["basis"].append(m.group(2).strip())
            continue
        fm = re.match(r"^\*\*(.+?)\*\*\s*(.*)$", m.group(2))
        if not fm or not re.search(r"\d", fm.group(1)):
            raise DesignError(f"line {line}: a key figure is `**<figure with a number>** <label>`, got {m.group(2)!r}")
        items.append({"figure": fm.group(1), "label": fm.group(2), "basis": []})
    if not 1 <= len(items) <= 8:
        raise DesignError(f"line {line}: ::: keyfigures takes 1 to 8 items, got {len(items)}")
    return items


def add_keyfigures(ctx, container, d: Directive, width: int):
    """One row of figures over a hairline in ink: the figure one step above the body, its label, its basis."""
    T = ctx.T
    items = keyfigure_items(d.body, d.line)
    cfg = T.components.get("keyfigures") or {}
    cols = min(len(items), int(d.attrs.get("cols") or cfg.get("per_row", 3)), 4)
    rows = math.ceil(len(items) / cols)
    table = container.add_table(rows, cols)
    mark_component(table, "keyfigures")
    no_borders(table)
    table_width(table, width)
    cell_margins(table, 5, 4, 0, 10)
    for row in table.rows:
        row._tr.get_or_add_trPr().append(_el("cantSplit"))
    for i, item in enumerate(items):
        cell = table.cell(i // cols, i % cols)
        cell_set(cell, _borders("tcBorders", {"top": (4, T.colour("ink"), 0)}))
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(1)
        p.paragraph_format.line_spacing = T.line(1.2, "Pretendard")
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        styled_run(p, _strip_md(item["figure"]), T.keyfigure_pt, T.colour("ink"), True)
        lp = cell.add_paragraph()
        lp.paragraph_format.space_after = Pt(1)
        lp.paragraph_format.line_spacing = T.line(1.4)
        lp.alignment = WD_ALIGN_PARAGRAPH.LEFT
        _inline(lp, item["label"], T.table_pt, T.colour("ink"))
        for basis in item["basis"]:
            bp = cell.add_paragraph()
            bp.paragraph_format.space_after = Pt(0)
            bp.paragraph_format.line_spacing = T.line(1.4)
            bp.alignment = WD_ALIGN_PARAGRAPH.LEFT
            _inline(bp, basis, T.note_pt, T.colour("ink_muted"))
    for cell in table._cells[len(items):]:
        cell.paragraphs[0].text = ""
    # The box stays whole: every paragraph but those of the last row keeps with the next.
    for row in table.rows[:-1]:
        for cell in row.cells:
            for q in cell.paragraphs:
                q.paragraph_format.keep_with_next = True
    ctx.spacer(container)
    return table


def add_callout(ctx, container, d: Directive, width: int):
    """One callout style per document: a ruled box in the vocabulary of the tables (0.75 pt above, 0.5 pt below, in
    the pack's accent), no side stripe, no fill, the title in bold ink."""
    T = ctx.T
    kind = d.attrs.get("kind")
    if kind not in CALLOUT_KINDS:
        raise DesignError(f"line {d.line}: ::: callout needs kind= one of {', '.join(CALLOUT_KINDS)}")
    table = container.add_table(1, 1)
    mark_component(table, f"callout {kind}")
    table_width(table, width)
    no_borders(table)
    cell_margins(table, 5, 5, 0, 0)
    table.rows[0]._tr.get_or_add_trPr().append(_el("cantSplit"))
    cell = table.cell(0, 0)
    rule = T.accent_for("callout_rule")
    cell_set(cell, _borders("tcBorders", {"top": (6, rule, 0), "bottom": (4, rule, 0)}))
    box = Box(cell, width, ctx.doc)
    label = d.attrs.get("title") or LABELS[ctx.lang][kind]
    p = box.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    styled_run(p, label, T.body_pt, T.colour("ink"), True)
    ctx.render(box, d.body)
    for q in cell.paragraphs:
        q.paragraph_format.keep_with_next = True
        if q.paragraph_format.space_after is None or q is cell.paragraphs[-1]:
            q.paragraph_format.space_after = Pt(0)
    ctx.spacer(container)
    return table


def add_sidebar(ctx, container, d: Directive, width: int):
    """A box beside the text (Manual): a hairline down its left side, no fill, table-size text."""
    T = ctx.T
    cfg = T.components.get("sidebar") or {}
    which = d.attrs.get("width") or cfg.get("default_width", "third")
    float_side = d.attrs.get("float") or cfg.get("float", "right")
    if ctx.column_count > 1:
        float_side = "none"
    w = width if float_side == "none" else span(ctx.doc, 6 if which == "half" else 4, width=width)
    table = container.add_table(1, 1)
    mark_component(table, "sidebar")
    table_width(table, w)
    table.rows[0]._tr.get_or_add_trPr().append(_el("cantSplit"))
    no_borders(table)
    cell_margins(table, 2, 2, 8, 0)
    if float_side in ("right", "left"):
        tbl_set(table, "tblpPr", _el("tblpPr", leftFromText=284, rightFromText=284, topFromText=57, bottomFromText=113,
                                     vertAnchor="text", horzAnchor="margin", tblpXSpec=float_side))
    cell = table.cell(0, 0)
    cell_set(cell, _borders("tcBorders", {"left": (6, T.accent_for("sidebar_rule"), 0)}))
    box = Box(cell, w - Mm(4), ctx.doc)
    if d.attrs.get("title"):
        p = box.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        styled_run(p, d.attrs["title"], T.table_pt, T.colour("ink"), True)
    ctx.render(box, d.body, size=T.table_pt)
    return table


def add_columns(ctx, d: Directive):
    T = ctx.T
    n = int(d.args[0]) if d.args else 2
    if n not in (1, 2, 3):
        raise DesignError(f"line {d.line}: ::: columns takes 1, 2 or 3, got {n}")
    gap = float(d.attrs.get("gap") or T.column_gap_mm)
    parts = COLUMN_BREAK.split(d.body)
    if len(parts) > 1 and n > 1:
        # The author placed the break: each part gets its own cell of one borderless row, tops aligned.
        # A column section with a manual column break is not balanced by LibreOffice: it ran to the page
        # foot and the next block started a new page.
        side_by_side(ctx, parts[: n - 1] + ["\n\n".join(parts[n - 1:])], gap, d.attrs.get("rule") in ("true", "1"))
        return
    ctx.section_break(cols=n, gap=gap, rule=d.attrs.get("rule") in ("true", "1"))
    for i, part in enumerate(parts):
        if i:
            p = ctx.doc.add_paragraph()
            tiny(p)
            p.add_run().add_break(WD_BREAK.COLUMN)
        ctx.render(ctx.doc, part)
    ctx.section_break(cols=T.columns, gap=T.column_gap_mm)


def balanced_parts(d: Directive) -> bool:
    """Two columns only when the parts are within 20 % of each other's length (A4.5); a column section
    without a break balances itself."""
    parts = [len(_strip_md(p).replace(" ", "")) for p in COLUMN_BREAK.split(d.body) if p.strip()]
    return len(parts) < 2 or min(parts) >= 0.8 * max(parts)


def side_by_side(ctx, parts: list, gap_mm: float, rule: bool):
    T, doc = ctx.T, ctx.doc
    n = len(parts)
    full = frame_width(doc) if ctx.column_count == 1 else int((frame_width(doc) - Mm(T.column_gap_mm) * (ctx.column_count - 1)) / ctx.column_count)
    half = int(Mm(gap_mm) / 2)
    text_w = int((full - 2 * half * (n - 1)) / n)
    widths = [text_w + half * ((i > 0) + (i < n - 1)) for i in range(n)]
    table = doc.add_table(1, n)
    mark_component(table, "columns")
    no_borders(table)
    table_width(table, sum(widths), widths)
    cell_margins(table, 0, 0, 0, 0)
    for i, part in enumerate(parts):
        cell = table.cell(0, i)
        mar = _el("tcMar")
        mar.append(_el("left", w=int(half / 635) if i else 0, type="dxa"))
        mar.append(_el("right", w=int(half / 635) if i < n - 1 else 0, type="dxa"))
        cell_set(cell, mar)
        if rule and i < n - 1:
            cell_set(cell, _borders("tcBorders", {"right": (4, T.colour("line"), 0)}))
        box = Box(cell, text_w, doc)
        ctx.render(box, part)
    ctx.spacer(doc)
    return table


def settle_sidebars(doc, T: Tonality):
    """A floating sidebar needs text beside it down to its own foot. When the paragraphs before the next
    heading are shorter than the box, the next heading would start beside it, so the box stands full width
    in the flow instead."""
    full = frame_width(doc)
    lead = T.body_pt * 1.8

    def listed(q):
        return q.find(f"{qn('w:pPr')}/{qn('w:numPr')}") is not None or "List" in (Paragraph(q, doc._body).style.name or "")

    for tbl in doc.element.body.iter(qn("w:tbl")):
        cap = tbl.find(f"{qn('w:tblPr')}/{qn('w:tblCaption')}")
        pos = tbl.find(f"{qn('w:tblPr')}/{qn('w:tblpPr')}")
        if cap is None or cap.get(qn("w:val")) != "sidebar" or pos is None:
            continue
        w_box = int(tbl.find(f"{qn('w:tblPr')}/{qn('w:tblW')}").get(qn("w:w"))) * 635
        # Measured on rendered pages: box lines run about 1.9 x the table size, a list item loses its indent.
        box_h = sum(max(1, math.ceil(_advance("".join(t.text or "" for t in q.iter(qn("w:t"))), T.table_pt) / (w_box / 12700 - 16 - (18 if listed(q) else 0))))
                    * T.table_pt * 1.9 + 4 for q in tbl.iter(qn("w:p"))) + 16
        beside, el = 0.0, tbl.getnext()
        while el is not None and el.tag == qn("w:p") and not _level(Paragraph(el, doc._body)):
            text = "".join(t.text or "" for t in el.iter(qn("w:t")))
            if text.strip():
                beside += math.ceil(_advance(text, T.body_pt) * 0.9 / ((full - w_box) / 12700 - 12 - (18 if listed(el) else 0))) * lead + T.body_pt * 0.4
            el = el.getnext()
        if beside < box_h:
            tbl.find(qn("w:tblPr")).remove(pos)
            table_width(Table(tbl, doc._body), full)


def flow_paragraphs(doc):
    """Body paragraphs in reading order, with those inside a side-by-side columns row."""
    for el in doc.element.body.iterchildren():
        if el.tag == qn("w:p"):
            yield Paragraph(el, doc._body)
        elif el.tag == qn("w:tbl"):
            cap = el.find(f"{qn('w:tblPr')}/{qn('w:tblCaption')}")
            if cap is not None and cap.get(qn("w:val")) == "columns":
                for tc in el.iter(qn("w:tc")):
                    for q in tc.iterchildren(qn("w:p")):
                        yield Paragraph(q, doc._body)


# ── Title blocks and covers ─────────────────────────────────────────────────

def _byline(front: dict) -> str:
    """Author and organisation, the organisation left out when the author already names it."""
    authors = front.get("authors") or front.get("author")
    if isinstance(authors, list):
        authors = ", ".join(str(a.get("name", a)) if isinstance(a, dict) else str(a) for a in authors)
    org = front.get("organization")
    parts = [str(authors)] if authors else []
    if org and not (authors and str(org) in str(authors)):
        parts.append(str(org))
    return ", ".join(parts)


def _meta_line(front: dict, lang: str = "ko") -> str:
    """The plain profile's meta line: author, organisation and date."""
    date = format_date(front["date"], lang) if front.get("date") else None
    return "  ".join(v for v in (_byline(front), date) if v)


def notice_tag(p: Paragraph, text: str, size: float = 8.5):
    run = styled_run(p, f" {text} ", size, NOTICE[0], True)
    run_shade(run, NOTICE[1])
    return run


def notice_line(container, T: Tonality, text: str, before: float = 2, after: float = 0):
    """The sample-data notice, once, in ink at the furniture size (A4.7)."""
    p = container.add_paragraph()
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.space_after = Pt(after)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    styled_run(p, text, T.furniture_pt, T.colour("ink_muted"))
    return p


def _abstract(ctx, container, front: dict):
    T, lab = ctx.T, LABELS[ctx.lang]
    if front.get("abstract"):
        p = container.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
        styled_run(p, lab["abstract"], T.body_pt, T.colour("ink"), True)
        a = container.add_paragraph()
        a.paragraph_format.space_after = Pt(4)
        styled_run(a, str(front["abstract"]), T.body_pt, T.colour("ink"))
    keywords = front.get("keywords")
    if keywords:
        k = container.add_paragraph()
        k.paragraph_format.space_after = Pt(4)
        k.alignment = WD_ALIGN_PARAGRAPH.LEFT
        styled_run(k, f"{lab['keywords']}: ", T.table_pt, T.colour("ink"), True)
        styled_run(k, "; ".join(str(x) for x in keywords) if isinstance(keywords, list) else str(keywords), T.table_pt, T.colour("ink"))


MEMO_PAIRS = re.compile(r"^\s*(?:To|From|Date|Subject|Cc|받는 사람|보내는 사람|날짜|제목|참조)\s*:")


def memo_pairs(line: str, lang: str) -> list:
    """`To: … · From: … · Subject: …` as (label, value) pairs; an English value starts with a capital."""
    pairs = [tuple(x.strip() for x in part.split(":", 1)) for part in line.split(" · ") if ":" in part]
    return [(k, v[:1].upper() + v[1:] if lang == "en" else v) for k, v in pairs]


def _pairs_table(ctx, pairs: list, caption: str):
    """Label and value rows between two hairlines (the memo block and the manual's control block)."""
    doc, T = ctx.doc, ctx.T
    table = doc.add_table(len(pairs), 2)
    mark_component(table, caption)
    no_borders(table)
    tbl_set(table, "tblBorders", _borders("tblBorders", {"top": (4, T.colour("ink"), 0), "bottom": (4, T.colour("ink"), 0), "left": None, "right": None,
                                                         "insideH": None, "insideV": None}))
    label_w = span(doc, 2)
    table_width(table, frame_width(doc), [label_w, frame_width(doc) - label_w])
    cell_margins(table, 2, 2, 0, 6)
    for i, (key, value) in enumerate(pairs):
        for ci, (text, bold) in enumerate(((key, True), (value, False))):
            p = table.cell(i, ci).paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_after = Pt(0)
            styled_run(p, text, T.table_pt, T.colour("ink"), bold)
    return table


def _title(ctx, front: dict, size: float, after: float = 6):
    doc, T = ctx.doc, ctx.T
    t = doc.add_paragraph()
    t.paragraph_format.space_after = Pt(after)
    t.paragraph_format.line_spacing = T.line(1.22, T.fonts["heading"])
    t.alignment = WD_ALIGN_PARAGRAPH.LEFT
    display_run(t, str(front["title"]), size, frame_width(doc), T.colour("ink"), True, (T.fonts["heading"], T.fonts["hangul"]))
    return t


def title_block(ctx, front: dict, d: Directive | None):
    """Page 1 opens with the document's own title block above the body (no cover page):

    masthead  a series line (kind left, date right), the title, the subtitle, the byline, one rule, the notice;
              a journal adds affiliations, abstract and keywords
    memo      a label, the subject as title, To / From / Date / Subject rows between hairlines, the notice
    manual    the title and subtitle over a document-control block (document, owner, organisation, issued)
    """
    doc, T, lab = ctx.doc, ctx.T, LABELS[ctx.lang]
    kicker = d.attrs.get("kicker") if d is not None else None
    date = format_date(front["date"], ctx.lang) if front.get("date") else ""
    inner = [b for b in split_directives(d.body, d.line)] if d is not None else []
    lead = "\n".join(b for b in inner if isinstance(b, str)).strip()
    sizes = T.sizes
    if T.title_block == "memo":
        k = doc.add_paragraph()
        k.paragraph_format.space_after = Pt(4)
        styled_run(k, kicker or lab["memo"], T.table_pt, T.colour("ink_muted"), True)
        _title(ctx, front, _half(T.body_pt * 1.8), 8)
        pairs, rest = [], []
        for line in lead.split("\n"):
            if MEMO_PAIRS.match(line):
                pairs += memo_pairs(line, ctx.lang)
            elif line.strip():
                rest.append(line)
        if date and not any(k in (lab["date"], "Date", "날짜") for k, _ in pairs):
            at = next((i + 1 for i, (k, _) in enumerate(pairs) if k in (lab["from"], "From", "보내는 사람")), len(pairs))
            pairs.insert(at, (lab["date"], date))
        if pairs:
            _pairs_table(ctx, pairs, "cover memo")
        if front.get("notice"):
            notice_line(doc, T, str(front["notice"]), 4, 10)
        else:
            ctx.spacer(doc)
        if rest:
            ctx.render(doc, "\n".join(rest))
        return
    if kicker or date:
        s = doc.add_paragraph()
        s.paragraph_format.space_after = Pt(10)
        s.alignment = WD_ALIGN_PARAGRAPH.LEFT
        s.paragraph_format.tab_stops.add_tab_stop(Emu(frame_width(doc)), WD_TAB_ALIGNMENT.RIGHT)
        styled_run(s, kicker or "", T.furniture_pt + 0.5, T.colour("ink"), True)
        if date and T.title_block != "manual":
            styled_run(s, f"\t{date}", T.furniture_pt + 0.5, T.colour("ink"))
    _title(ctx, front, sizes["title"])
    if front.get("subtitle"):
        sub = doc.add_paragraph()
        sub.paragraph_format.space_after = Pt(6)
        sub.alignment = WD_ALIGN_PARAGRAPH.LEFT
        styled_run(sub, str(front["subtitle"]), sizes["h2"], T.colour("ink_muted"))
    if T.title_block == "manual":
        pairs = [(lab["doc"], str(front.get("short_title") or front["title"]))]
        for key, value in ((lab["owner"], front.get("author")), (lab["org"], front.get("organization")), (lab["issued"], date)):
            if value:
                pairs.append((key, str(value)))
        sp = doc.add_paragraph()
        tiny(sp)
        sp.paragraph_format.space_before = Pt(6)
        _pairs_table(ctx, pairs, "cover manual")
        if front.get("notice"):
            notice_line(doc, T, str(front["notice"]), 4, 0)
    else:
        byline = _byline(front)
        if byline:
            m = doc.add_paragraph()
            m.paragraph_format.space_after = Pt(2)
            m.alignment = WD_ALIGN_PARAGRAPH.LEFT
            styled_run(m, byline, T.table_pt, T.colour("ink"))
        affs = front.get("affiliations")
        if isinstance(affs, dict):
            for key in sorted(affs, key=str):
                a = doc.add_paragraph()
                a.paragraph_format.space_after = Pt(0)
                a.alignment = WD_ALIGN_PARAGRAPH.LEFT
                styled_run(a, f"{key} {affs[key]}", T.note_pt, T.colour("ink_muted"))
        if front.get("corresponding_email"):
            c = doc.add_paragraph()
            c.alignment = WD_ALIGN_PARAGRAPH.LEFT
            styled_run(c, f"* {front['corresponding_email']}", T.note_pt, T.colour("ink_muted"))
        rule = doc.add_paragraph()
        tiny(rule)
        rule.paragraph_format.space_before = Pt(4)
        para_border(rule, {"bottom": (6, T.accent_for("title_rule"), 1)})
        if front.get("notice"):
            notice_line(doc, T, str(front["notice"]), 4, 0)
    if lead:
        ctx.spacer(doc)
        lines = lead.split("\n")
        for line in [x for x in lines if MEMO_PAIRS.match(x)]:
            # To / From / Subject in a title block that is not a memo: one line, labels bold, no middle dots.
            m = doc.add_paragraph()
            m.paragraph_format.space_after = Pt(4)
            for i, (key, value) in enumerate(memo_pairs(line, ctx.lang)):
                styled_run(m, ("\u2003" if i else "") + key + " ", T.body_pt, T.colour("ink"), True)
                styled_run(m, value, T.body_pt, T.colour("ink"))
        lead = "\n".join(x for x in lines if not MEMO_PAIRS.match(x)).strip()
        before = len(doc.paragraphs)
        ctx.render(doc, lead)
        for p in doc.paragraphs[before:]:
            for r in p.runs:
                r.font.size = Pt(T.body_pt + 0.5)
    _abstract(ctx, doc, front)
    end = doc.add_paragraph()
    tiny(end)
    end.paragraph_format.space_after = Pt(10)
    ctx.title_end = end


def masthead(ctx, front: dict, d: Directive | None):
    """The plain profile's title block: title, subtitle, one meta line, affiliations, abstract and keywords,
    closed by a hairline."""
    doc, T = ctx.doc, ctx.T
    tb = T.design.get("title_block_pt") or {}
    _title(ctx, front, float(tb.get("title", 22)), 4)
    if front.get("subtitle"):
        s = doc.add_paragraph()
        s.paragraph_format.space_after = Pt(4)
        styled_run(s, str(front["subtitle"]), 13, T.colour("ink_muted"))
    lead = "\n".join(b for b in split_directives(d.body, d.line) if isinstance(b, str)).strip() if d is not None else ""
    meta = _meta_line(front, ctx.lang)
    if meta:
        m = doc.add_paragraph()
        m.paragraph_format.space_after = Pt(2)
        styled_run(m, meta, T.body_pt, T.colour("ink_muted"))
    affs = front.get("affiliations")
    if isinstance(affs, dict):
        for key in sorted(affs, key=str):
            a = doc.add_paragraph()
            a.paragraph_format.space_after = Pt(0)
            styled_run(a, f"{key} {affs[key]}", T.table_pt, T.colour("ink_muted"))
    if front.get("corresponding_email"):
        c = doc.add_paragraph()
        styled_run(c, f"* {front['corresponding_email']}", T.table_pt, T.colour("ink_muted"))
    if lead:
        ctx.render(doc, lead)
    _abstract(ctx, doc, front)
    rule = doc.add_paragraph()
    tiny(rule)
    para_border(rule, {"bottom": (6, T.colour("line"), 1)})
    rule.paragraph_format.space_after = Pt(12)


def cover_page(ctx, front: dict, d: Directive | None):
    """A typographic cover on page 1, its own section (A4.7): the kind, the title left-aligned in the upper
    third, one short rule, the subtitle and the lead; the byline, date and notice at the foot of the page.
    No colour block, no key figures. The body starts on the next page with page number 1."""
    doc, T = ctx.doc, ctx.T
    section = doc.sections[0]
    H, top, W = section.page_height, section.top_margin, frame_width(doc)
    kicker = d.attrs.get("kicker") if d is not None else None
    lead = "\n".join(b for b in split_directives(d.body, d.line) if isinstance(b, str)).strip() if d is not None else ""
    first = doc.paragraphs[0] if doc.paragraphs and not doc.paragraphs[0].text else doc.add_paragraph()
    tiny(first)
    first.paragraph_format.space_before = Pt(max(0, (0.22 * H - top) / 12700))
    if kicker:
        k = doc.add_paragraph()
        k.paragraph_format.space_after = Pt(10)
        k.alignment = WD_ALIGN_PARAGRAPH.LEFT
        styled_run(k, kicker, T.table_pt + 0.5, T.colour("ink"), True)
    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.LEFT  # a justified paragraph would spread the broken title lines
    t.paragraph_format.space_after = Pt(12)
    t.paragraph_format.line_spacing = T.line(1.22, T.fonts["heading"])
    t.paragraph_format.right_indent = Emu(int(W - span(doc, 10)))
    display_run(t, str(front["title"]), T.sizes["title"], span(doc, 10), T.colour("ink"), True, (T.fonts["heading"], T.fonts["hangul"]))
    r = doc.add_paragraph()
    tiny(r)
    r.paragraph_format.right_indent = Emu(max(0, W - Mm(36)))
    para_border(r, {"bottom": (8, T.accent_for("title_rule"), 1)})
    r.paragraph_format.space_after = Pt(14)
    if front.get("subtitle"):
        s = doc.add_paragraph()
        s.paragraph_format.space_after = Pt(10)
        s.paragraph_format.right_indent = Emu(int(W - span(doc, 9)))
        s.alignment = WD_ALIGN_PARAGRAPH.LEFT
        styled_run(s, str(front["subtitle"]), T.sizes["h2"], T.colour("ink_muted"))
    if lead:
        before = len(doc.paragraphs)
        ctx.render(doc, lead)
        for p in doc.paragraphs[before:]:
            p.paragraph_format.right_indent = Emu(int(W - span(doc, 9)))
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    # The byline, the date and the notice stand at the foot of the cover, in the cover section's own footer.
    footer = section.footer
    footer.is_linked_to_previous = False
    lines = [(_byline(front), T.table_pt, T.colour("ink"), True), (format_date(front["date"], ctx.lang) if front.get("date") else "", T.table_pt, T.colour("ink"), False),
             (str(front.get("notice") or ""), T.furniture_pt, T.colour("ink_muted"), False)]
    fp = footer.paragraphs[0]
    for i, (text, size, colour, bold) in enumerate(x for x in lines if x[0]):
        p = fp if i == 0 else footer.add_paragraph()
        p.paragraph_format.space_after = Pt(1)
        styled_run(p, text, size, colour, bold)
    section.header.is_linked_to_previous = False
    new = doc.add_section(WD_SECTION.NEW_PAGE)
    set_page(new, T)
    _put(new._sectPr, _el("pgNumType", start=1), SECTPR_ORDER)
    for p in doc.paragraphs[-1:]:
        tiny(p)
    ctx.title_end = None


# ── Post-passes over the body ───────────────────────────────────────────────

def _level(p: Paragraph) -> int:
    name = p.style.name if p.style is not None else ""
    m = re.match(r"Heading (\d)$", name)
    return int(m.group(1)) if m else 0


def _prefix_runs(p: Paragraph, runs: list):
    """Insert runs (text, size, colour, bold) and an optional tab at the start of a paragraph."""
    anchor = p._p.find(qn("w:pPr"))
    for spec in reversed(runs):
        r = OxmlElement("w:r")
        rpr = OxmlElement("w:rPr")
        if spec == "\t":
            r.append(rpr)
            r.append(OxmlElement("w:tab"))
        else:
            text, size, colour, bold = spec
            if bold:
                _put(rpr, _el("b"), RPR_ORDER)
            _put(rpr, _el("color", val=colour), RPR_ORDER)
            if size:
                _put(rpr, _el("sz", val=int(size * 2)), RPR_ORDER)
            r.append(rpr)
            t = OxmlElement("w:t")
            t.text = text
            t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
            r.append(t)
        if anchor is not None:
            anchor.addnext(r)
        else:
            p._p.insert(0, r)


def _hang(p: Paragraph, mm: float):
    ind = _el("ind", left=int(mm * 56.693), hanging=int(mm * 56.693))
    _put(p._p.get_or_add_pPr(), ind, PPR_ORDER)
    tabs = _el("tabs")
    tabs.append(_el("tab", val="left", pos=int(mm * 56.693)))
    _put(p._p.get_or_add_pPr(), tabs, PPR_ORDER)


def heading_number(scheme: str, counters: list, level: int) -> str | None:
    """Plain ink numbering at the heading's own size: 1 / 1.1 / 1.1.1, or the Korean institute order Ⅰ. / 1. / 가."""
    if scheme == "decimal":
        return ".".join(str(c) for c in counters[:level])
    if scheme == "roman-ko":
        n = counters[level - 1]
        if level == 1:
            return f"{ROMAN[n - 1]}." if n <= len(ROMAN) else f"{n}."
        if level == 2:
            return f"{n}."
        return f"{GANADA[n - 1]}." if n <= len(GANADA) else f"{n})"
    return None


HANG_MM = {"decimal": (8, 11, 13)}


def treat_headings(doc, T: Tonality):
    counters = [0, 0, 0]
    scheme = T.numbering
    numbered = []
    for p in flow_paragraphs(doc):
        level = _level(p)
        if not level or level > 3 or not p.text.strip():
            continue
        if scheme == "none" or BACK_MATTER.match(p.text.strip()):
            continue
        counters[level - 1] += 1
        for i in range(level, 3):
            counters[i] = 0
        if 0 in counters[:level]:
            continue  # a level under a missing parent stays unnumbered
        number = heading_number(scheme, counters, level)
        if number and scheme == "roman-ko":
            # The institute manner: "Ⅴ. 소요 예산" with one space. A tab after a Roman numeral landed at different
            # places in LibreOffice, so the gaps after Ⅰ., Ⅳ. and Ⅴ. differed.
            _prefix_runs(p, [(number, None, T.colour("ink"), True), (" ", None, T.colour("ink"), False)])
        elif number:
            _prefix_runs(p, [(number, None, T.colour("ink"), True), "\t"])
            numbered.append((p, level, number))
    # Decimal numbers: one hang per level, wide enough for the widest number (2.10) plus a gap of about 3 mm, so
    # the heading texts of a level start on one line.
    hang = {}
    for _, level, number in numbered:
        need = _advance(number, T.sizes[f"h{level}"]) * 1.1 / 2.835 + 3
        hang[level] = max(hang.get(level, HANG_MM[scheme][level - 1]), need)
    for p, level, _ in numbered:
        _hang(p, hang[level])


def bookmark_h1(doc) -> list:
    """Each numbered h1 gets a bookmark the contents list points at; returns (text, bookmark) in order."""
    out = []
    for i, p in enumerate(q for q in flow_paragraphs(doc) if _level(q) == 1 and q.text.strip()):
        name = f"_LitSec{i + 1}"
        start = _el("bookmarkStart", id=900 + i, name=name)
        end = _el("bookmarkEnd", id=900 + i)
        anchor = p._p.find(qn("w:pPr"))
        if anchor is not None:
            anchor.addnext(start)
        else:
            p._p.insert(0, start)
        p._p.append(end)
        out.append((p.text.replace("\t", " ").strip(), name))
    return out


def add_contents(ctx, entries: list):
    """A short contents list after the title block: each h1, a dotted leader and its page (PAGEREF)."""
    doc, T = ctx.doc, ctx.T
    anchor = ctx.title_end
    if anchor is None or not entries:
        return
    W = frame_width(doc)
    made = []
    head = doc.add_paragraph()
    head.paragraph_format.space_after = Pt(4)
    head.paragraph_format.keep_with_next = True
    styled_run(head, LABELS[ctx.lang]["contents"], T.table_pt + 0.5, T.colour("ink"), True)
    made.append(head)
    for text, name in entries:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = T.line(1.6)
        p.paragraph_format.keep_with_next = True
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.tab_stops.add_tab_stop(Emu(W), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
        styled_run(p, f"{text}\t", T.table_pt, T.colour("ink"))
        add_field(p, f"PAGEREF {name} \\h", T.table_pt, T.colour("ink"), "")
        made.append(p)
    made[-1].paragraph_format.keep_with_next = False
    rule = doc.add_paragraph()
    tiny(rule)
    para_border(rule, {"bottom": (4, T.colour("line"), 1)})
    rule.paragraph_format.space_after = Pt(10)
    made.append(rule)
    for p in reversed(made):
        anchor._p.addnext(p._p)


def summary_points(doc, T: Tonality):
    """Brief: the paragraphs of the first section become numbered points ①-④, each a bold lead sentence then
    plain text (the conclusion-first summary of a briefing)."""
    paras = list(flow_paragraphs(doc))
    start = next((i for i, p in enumerate(paras) if _level(p) == 1), None)
    if start is None:
        return
    n = 0
    for p in paras[start + 1:]:
        if _level(p):
            break
        style = p.style.name if p.style is not None else ""
        text = p.text.strip()
        if not text or style != "Normal" or n >= len(CIRCLED) - 1:
            continue
        m = re.match(r"^(.+?(?:다\.|[.!?]))(\s+|$)(.*)$", text, re.S)
        lead, rest = (m.group(1), m.group(3)) if m else (text, "")
        for r in list(p.runs):
            r._r.getparent().remove(r._r)
        styled_run(p, f"{CIRCLED[n]} ", None, T.colour("ink"), True)
        styled_run(p, lead, None, T.colour("ink"), True)
        if rest:
            styled_run(p, " " + rest, None, T.colour("ink"))
        _hang(p, 5.5)
        p.paragraph_format.tab_stops.clear_all()
        n += 1


def keep_short_followers(doc):
    """A heading carries at least two lines of its section: a short paragraph after it keeps with
    what follows too (docx-spec D12.2)."""
    ps = doc.paragraphs
    for i, p in enumerate(ps[:-1]):
        if _level(p) and not _level(ps[i + 1]) and len(ps[i + 1].text) < 60:
            ps[i + 1].paragraph_format.keep_with_next = True


def last_line_company(doc):
    """A closing paragraph of up to about four lines does not stand alone on the last page: the block before it
    keeps with it (docx-spec Amendments 6: one paragraph on an otherwise empty last page read as left over)."""
    body = [el for el in doc.element.body.iterchildren() if el.tag in (qn("w:p"), qn("w:tbl"))]
    body = [el for el in body if el.tag == qn("w:tbl") or "".join(t.text or "" for t in el.iter(qn("w:t"))).strip()]
    if len(body) < 2 or body[-1].tag != qn("w:p") or body[-2].tag != qn("w:p"):
        return
    last, prev = Paragraph(body[-1], doc._body), Paragraph(body[-2], doc._body)
    if len(last.text) <= 400 and not _level(prev):
        prev.paragraph_format.keep_with_next = True


REFERENCE_ENTRY = re.compile(r"^\[\d+\]\s")


def _listed(p: Paragraph) -> bool:
    # A reference list ("[1] Author …") keeps together like any short list.
    return ((p.style is not None and p.style.name.startswith("List")) or p._p.find(f"{qn('w:pPr')}/{qn('w:numPr')}") is not None
            or bool(REFERENCE_ENTRY.match(p.text.strip())))


def _column_paragraphs(doc) -> set:
    """The body paragraphs set in a section of two or more columns."""
    found, pending = set(), []
    for el in doc.element.body.iterchildren():
        if el.tag == qn("w:p"):
            pending.append(el)
        sect = el if el.tag == qn("w:sectPr") else el.find(f"{qn('w:pPr')}/{qn('w:sectPr')}") if el.tag == qn("w:p") else None
        if sect is not None:
            cols = sect.find(qn("w:cols"))
            if cols is not None and int(cols.get(qn("w:num"), "1") or 1) >= 2:
                found.update(pending)
            pending = []
    return found


def keep_short_lists(doc, most: int = 6):
    """A list of up to six items reads as one block: every item but the last keeps with the next, and a lead-in of
    a line or two right before it ("다음 단계는 아래와 같다.") keeps with the list (docx-spec Amendments 6). In a
    column the block moved whole and left the column before it a third empty: there the list keeps its first two
    items with the lead-in and its last two together, and may break between them (docx-spec Amendments 7)."""
    body = list(doc.element.body.iterchildren())
    in_columns = _column_paragraphs(doc)
    run = []

    def close():
        if 2 <= len(run) <= most:
            split = len(run) >= 5 and run[0]._p in in_columns
            for k, q in enumerate(run[:-1]):
                q.paragraph_format.keep_with_next = not split or k == 0 or k == len(run) - 2
            first = run[0]._p.getprevious()
            if first is not None and first.tag == qn("w:p"):
                lead = Paragraph(first, doc._body)
                if lead.text.strip() and not _level(lead) and not _listed(lead) and len(lead.text) <= 160:
                    lead.paragraph_format.keep_with_next = True
        run.clear()

    for el in body:
        if el.tag == qn("w:p"):
            p = Paragraph(el, doc._body)
            if _listed(p) and p.text.strip():
                run.append(p)
                continue
        close()
    close()


def keep_heading_with_table(doc):
    """A heading whose first block is a short lead sentence and then a table keeps all three together: the heading
    and its sentence never wait at a page foot while the table opens the next page (docx-spec Amendments 6)."""
    for el in doc.element.body.iterchildren(qn("w:p")):
        p = Paragraph(el, doc._body)
        if not _level(p):
            continue
        lead = el.getnext()
        if lead is None or lead.tag != qn("w:p"):
            continue
        after = lead.getnext()
        # A caption or a units line may stand between the sentence and its table.
        def between(q):
            text = "".join(t.text or "" for t in q.iter(qn("w:t"))).strip()
            return q.tag == qn("w:p") and bool(TABLE_CAPTION.match(text) or text.startswith(("(단위", "(unit", "(Unit")))
        while after is not None and between(after):
            Paragraph(after, doc._body).paragraph_format.keep_with_next = True
            after = after.getnext()
        # A short lead (about two lines) and a table of up to eight body rows: a longer chain moved whole and left
        # half a page empty behind it.
        rows = len(after.findall(qn("w:tr"))) if after is not None and after.tag == qn("w:tbl") else 99
        if after is not None and after.tag == qn("w:tbl") and rows <= 9 and len(re.sub(r"\s+", "", "".join(t.text or "" for t in lead.iter(qn("w:t"))))) <= 200:
            p.paragraph_format.keep_with_next = True
            Paragraph(lead, doc._body).paragraph_format.keep_with_next = True


def keep_closing_section(doc, T: Tonality):
    """A closing section of a few lines and a short list, with no table or picture, keeps whole: its paragraph
    travels with the list to the last page instead of leaving the list and a closing line alone there
    (docx-spec Amendments 7)."""
    body = [el for el in doc.element.body.iterchildren() if el.tag in (qn("w:p"), qn("w:tbl"))]
    heads = [i for i, el in enumerate(body) if el.tag == qn("w:p") and _level(Paragraph(el, doc._body))]
    if not heads:
        return
    rest = body[heads[-1] + 1:]
    if any(el.tag == qn("w:tbl") or el.find(f".//{qn('w:drawing')}") is not None for el in rest):
        return
    paras = [Paragraph(el, doc._body) for el in rest if "".join(t.text or "" for t in el.iter(qn("w:t"))).strip()]
    width = frame_width(doc) / 12700
    lines = sum(_est_lines(p.text, width, T.body_pt) for p in paras)
    if 2 <= len(paras) <= 10 and lines <= 12:
        for p in paras[:-1]:
            p.paragraph_format.keep_with_next = True


def single_rule_after_boxes(doc):
    """A section that opens under a hairline right after a ruled box draws no second rule: the box's own bottom
    rule parts the two (docx-spec Amendments 6: a teal and a black rule stacked under "Fire lane")."""
    for el in doc.element.body.iterchildren(qn("w:p")):
        p = Paragraph(el, doc._body)
        prev = el.getprevious()
        # An empty spacer paragraph after the box does not part the two rules.
        while prev is not None and prev.tag == qn("w:p") and not "".join(t.text or "" for t in prev.iter(qn("w:t"))).strip() and prev.find(f".//{qn('w:drawing')}") is None:
            prev = prev.getprevious()
        if _level(p) == 1 and prev is not None and prev.tag == qn("w:tbl") and prev.find(f".//{qn('w:tcBorders')}/{qn('w:bottom')}") is not None:
            para_border(p, {"top": None})


def restart_numbered_lists(doc):
    """Each numbered list counts from 1. "List Number" numbers through one style-level list, so a second
    list went on at 4; every list after the first gets its own instance with a start override."""
    try:
        style_num = doc.styles["List Number"].element.pPr.numPr.numId.val
    except (KeyError, AttributeError):
        return
    numbering = doc.part.numbering_part.element
    abstract = next((n.abstractNumId.val for n in numbering.num_lst if n.numId == style_num), None)
    if abstract is None:
        return
    seen, prev = 0, False
    for p in doc.paragraphs:
        is_item = p.style is not None and p.style.name == "List Number"
        if is_item and not prev:
            seen += 1
            num_id = None
            if seen > 1:
                num = numbering.add_num(abstract)
                num.add_lvlOverride(ilvl=0).add_startOverride(1)
                num_id = num.numId
        if is_item and seen > 1:
            p_pr = p._p.get_or_add_pPr()
            p_pr.get_or_add_numPr().get_or_add_ilvl().val = 0
            p_pr.get_or_add_numPr().get_or_add_numId().val = num_id
        prev = is_item if p.text.strip() or is_item else prev


def space_after_lists(doc):
    """A paragraph that follows a list stands a paragraph's space clear of the list's last item (list items part by
    a smaller step), so the list reads as one block and the paragraph after it as the next."""
    def listed(q):
        return q.style is not None and q.style.name.startswith("List") or q._p.find(f"{qn('w:pPr')}/{qn('w:numPr')}") is not None
    prev = None
    for p in doc.paragraphs:
        if prev is not None and listed(prev) and not listed(p) and p.text.strip() and not _level(p) and p.paragraph_format.space_before in (None, Pt(0)):
            p.paragraph_format.space_before = Pt(6)
        prev = p


def lone_list_items(doc):
    """A bulleted list of one item is a plain paragraph: a lone item takes no symbol (A4.10)."""
    ps = doc.paragraphs
    for i, p in enumerate(ps):
        if p.style is None or p.style.name != "List Bullet" or not p.text.strip():
            continue
        before = ps[i - 1].style.name if i and ps[i - 1].style is not None else ""
        after = ps[i + 1].style.name if i + 1 < len(ps) and ps[i + 1].style is not None else ""
        if before != "List Bullet" and after != "List Bullet":
            p.style = doc.styles["Normal"]


def hangul_upright(doc):
    """Hangul is emphasised by weight only, never set in italic (A4.10)."""
    for p in doc.paragraphs:
        for r in p.runs:
            if r.italic and re.search(r"[가-힣]", r.text):
                r.italic = False


def style_source_lines(doc, lang: str = "en"):
    for p in doc.paragraphs:
        text = p.text.strip()
        if SOURCE_LINE.match(text) and not _level(p) and (p.style is None or p.style.name in ("Normal", "Body Text")):
            p.style = doc.styles["Source Note"]
            if lang != "en" and text.startswith("출처") and p.runs:
                # Korean tables name their source as 자료: (주: notes first, then 자료:).
                p.runs[0].text = re.sub(r"^출처(\s*[:：])", r"자료\1", p.runs[0].text)


def korean_captions(doc):
    """Korean captions in the institute form: <표 1> above a table, [그림 1] for a figure, the label bold."""
    for p in doc.paragraphs:
        if p.style is None or p.style.name != "Caption":
            continue
        text = p.text.strip()
        m = re.match(r"^(표|그림)\s*(\d+)[.:]\s*(.*)$", text, re.S)
        if not m:
            continue
        label = f"<표 {m.group(2)}>" if m.group(1) == "표" else f"[그림 {m.group(2)}]"
        size = next((r.font.size for r in p.runs if r.font.size), None)
        for r in list(p.runs):
            r._r.getparent().remove(r._r)
        a = p.add_run(label + " ")
        a.bold = True
        b = p.add_run(m.group(3))
        for r in (a, b):
            if size:
                r.font.size = size


def english_captions(doc):
    """An English table caption keeps its label bold ("Table 1.")."""
    for p in doc.paragraphs:
        if p.style is None or p.style.name != "Caption" or not p.runs or p.runs[0].bold:
            continue
        m = re.match(r"^(Table\s*\d+[.:])(.*)$", p.text.strip(), re.S)
        if m:
            for r in list(p.runs):
                r._r.getparent().remove(r._r)
            p.add_run(m.group(1)).bold = True
            p.add_run(m.group(2))


def recolour_links(doc, T: Tonality):
    for hl in doc.element.body.iter(qn("w:hyperlink")):
        for c in hl.iter(qn("w:color")):
            c.set(qn("w:val"), T.colour("ink"))


def _all_tables(doc):
    for tbl in doc.element.body.iter(qn("w:tbl")):
        cap = tbl.find(f"{qn('w:tblPr')}/{qn('w:tblCaption')}")
        if cap is None:
            yield Table(tbl, doc._body)


def _est_lines(text: str, width_pt: float, size: float) -> int:
    ems = sum(1.0 if "가" <= ch <= "힣" else 0.55 for ch in text)
    return max(1, math.ceil(ems * size * 1.05 / max(width_pt, 1)))


NUMERIC = re.compile(r"^[+\-−±▲▼△▽]?\s*[\d.,:]+\s*(?:\([^)]*\))?\s*(?:%p?|배|x|pt|[가-힣]{1,3}|[A-Za-z]{1,3})?$")
DASH_CELL = re.compile(r"^[—–\-]?$")
MINUS = re.compile(r"(?:^|(?<=[\s(]))-(?=\d)")


def style_table(doc, T: Tonality, table):
    """Booktabs (A4.4): a 1 pt rule above and below, 0.5 pt under the header, no verticals, no fills; the header
    bold ink; a total row bold under a 0.5 pt rule; numbers right-aligned in tabular figures."""
    ink = T.colour("ink")
    table.style = None
    rows = table.rows
    total = len(rows) > 2 and bool(TOTALS.match(rows[-1].cells[0].text.strip()))
    tbl_set(table, "tblBorders", _borders("tblBorders", {"top": (8, ink), "left": None, "bottom": (8, ink), "right": None, "insideH": None, "insideV": None}))
    cell_margins(table, 2 if T.tight else 3.5, 2 if T.tight else 3.5, 5, 5)
    cols = len(table.columns)
    numeric = []
    for ci in range(cols):
        data = [r.cells[ci].text.strip() for r in rows[1:] if ci < len(r.cells)]
        data = [t for t in data if not DASH_CELL.match(t)]
        numeric.append(bool(data) and all(NUMERIC.match(t) for t in data))
    for ri, row in enumerate(rows):
        for ci, cell in enumerate(row.cells):
            if ri == 0:
                cell_set(cell, _borders("tcBorders", {"bottom": (4, ink)}))
            elif total and ri == len(rows) - 1:
                cell_set(cell, _borders("tcBorders", {"top": (4, ink)}))
            for shd in cell._tc.findall(f"{qn('w:tcPr')}/{qn('w:shd')}"):
                shd.getparent().remove(shd)
            for p in cell.paragraphs:
                p.paragraph_format.line_spacing = T.line(1.25 if T.tight else 1.4)
                if ci < len(numeric) and numeric[ci]:
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                elif p.alignment in (None, WD_ALIGN_PARAGRAPH.JUSTIFY):
                    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                for r in p.runs:
                    # A negative figure takes the minus sign, never a hyphen (docx-spec Amendments 6), Korean too.
                    if ri and r.text:
                        r.text = MINUS.sub("\u2212", r.text)
                    r.font.size = Pt(T.table_pt)
                    r.font.color.rgb = RGBColor.from_string(ink)
                    if ri == 0 or (total and ri == len(rows) - 1):
                        r.bold = True
                    if ci < len(numeric) and numeric[ci] and ri:
                        r._r.get_or_add_rPr().append(OxmlElement("w14:numSpacing", {qn("w14:val"): "tabular"}))


def hoist_units(doc, table, lang: str):
    """When every unit-bearing header cell names the same unit, the unit moves to one "(단위: …)" line
    right-aligned above the table and leaves the header cells (Korean tables, A4.4)."""
    if lang == "en":
        return None
    head = table.rows[0].cells
    units = [re.search(r"\s*\(([^()]+)\)\s*$", c.text) for c in head[1:]]
    found = [u.group(1).strip() for u in units if u]
    if len(found) < 2 or len(set(found)) != 1 or len(found) != len(head) - 1:
        return None
    for cell in head[1:]:
        for p in cell.paragraphs:
            for r in p.runs:
                r.text = re.sub(r"\s*\([^()]+\)\s*$", "", r.text)
    return found[0]


def fit_word_widths(table, size: float):
    """No column narrower than its longest word plus the cell margins, so "Proposed" never wraps inside the
    word; the room comes from the widest column, and the table keeps its total width."""
    cols = len(table.columns)
    widths = [c.width or 0 for c in table.rows[0].cells][:cols]
    if cols < 2 or not all(widths):
        return
    need = [0] * cols
    for row in table.rows:
        for ci, cell in enumerate(row.cells[:cols]):
            for word in re.findall(r"[^\s()]+", cell.text):
                need[ci] = max(need[ci], int(Pt(_advance(word, size) + 14)))
    short = [ci for ci in range(cols) if widths[ci] < need[ci]]
    if not short:
        return
    for ci in short:
        donor = max(range(cols), key=lambda k: widths[k] - need[k])
        give = min(need[ci] - widths[ci], max(0, widths[donor] - need[donor]))
        widths[donor] -= give
        widths[ci] += give
    table_width(table, sum(widths), widths)


def balance_columns(table, size: float):
    """A text column that wraps while other columns hold their longest cell with room to spare takes that room (all of
    it when that is less than its longest cell needs, so it wraps onto fewer lines; "Harbour Road" no longer breaks);
    the table keeps its width and no column drops under its own longest cell (docx-spec Amendments 6)."""
    cols = len(table.columns)
    widths = [c.width or 0 for c in table.rows[0].cells][:cols]
    if cols < 2 or not all(widths):
        return
    # Data cells set the need; a header may take two lines (its longest word still fits, fit_word_widths).
    body = list(table.rows)[1:] or list(table.rows)
    line = [max(int(Pt(_advance(row.cells[ci].text.strip(), size) + 14)) for row in body if ci < len(row.cells)) for ci in range(cols)]
    # A donor keeps its own longest cell on one line and every word of its header whole.
    words = [max([int(Pt(_advance(w, size) + 14)) for row in table.rows if ci < len(row.cells) for w in re.findall(r"[^\s()]+", row.cells[ci].text)] or [0]) for ci in range(cols)]
    # ... and its header within three lines.
    head = list(table.rows)[0].cells
    words = [max(words[ci], int(Pt(_advance(head[ci].text.strip(), size) / 3 + 14)) if ci < len(head) else 0) for ci in range(cols)]
    spare = [max(0, widths[k] - max(line[k], words[k])) for k in range(cols)]
    changed = False
    for ci in sorted((c for c in range(cols) if widths[c] < line[c]), key=lambda c: line[c] - widths[c]):
        deficit = line[ci] - widths[ci]
        donors = [k for k in range(cols) if k != ci and spare[k] > 0]
        # The room the others can spare, all of it when it is less than the column needs: fewer lines still help.
        gain = min(deficit, sum(spare[k] for k in donors))
        if gain < Pt(12):
            continue
        left = gain
        for k in sorted(donors, key=lambda k: -spare[k]):
            give = min(spare[k], left)
            widths[k] -= give
            spare[k] -= give
            left -= give
            if not left:
                break
        widths[ci] += gain
        spare[ci] = max(0, widths[ci] - max(line[ci], words[ci]))
        changed = True
    if changed:
        table_width(table, sum(widths), widths)


def boxes_clear(doc):
    """A component box (callout, sidebar) right under a paragraph or list item stands 6 pt clear of it: its top rule
    touched the line above (docx-spec Amendments 6)."""
    for el in doc.element.body.iterchildren(qn("w:tbl")):
        cap = el.find(f"{qn('w:tblPr')}/{qn('w:tblCaption')}")
        if cap is not None and (cap.get(qn("w:val")) or "").split(" ")[0] in KINDS:
            lead_in_clear(Table(el, doc._body), boxes=True)


def lead_in_clear(table, boxes=False):
    """A table without a caption under a sentence stands clear of it: the sentence keeps 6 pt under itself (a table
    cannot take space above), so the header rule never touches the line above (docx-spec Amendments 6)."""
    prev = table._tbl.getprevious()
    if prev is None or prev.tag != qn("w:p"):
        return
    p = Paragraph(prev, table._parent)
    text = p.text.strip()
    if not text or (not boxes and TABLE_CAPTION.match(text)) or _level(p) or (p.style is not None and p.style.name in ("Caption", "Source Note")):
        return
    if p.paragraph_format.space_after is None or p.paragraph_format.space_after < Pt(6):
        p.paragraph_format.space_after = Pt(6)


def finish_tables(doc, T: Tonality, lang: str):
    """Every data table in booktabs, its caption kept with it (with a units line under the caption when the
    unit moves out of the header), and kept on one page when it fits there."""
    frame_h = frame_height(doc) / 12700
    for table in list(_all_tables(doc)):
        prev = table._tbl.getprevious()
        caption = Paragraph(prev, table._parent) if prev is not None and prev.tag == qn("w:p") else None
        if caption is not None and TABLE_CAPTION.match(caption.text.strip()):
            caption.style = doc.styles["Caption"]
            caption.paragraph_format.keep_with_next = True
        unit = hoist_units(doc, table, lang)
        style_table(doc, T, table)
        if unit:
            p = Paragraph(OxmlElement("w:p"), table._parent)
            table._tbl.addprevious(p._p)
            p.style = doc.styles["Source Note"]
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.keep_with_next = True
            p.add_run(f"({LABELS[lang]['unit']}: {unit})")
            if caption is not None:
                caption.paragraph_format.space_after = Pt(0)
        fit_word_widths(table, T.table_pt)
        balance_columns(table, T.table_pt)
        lead_in_clear(table)
        widths = [c.width / 12700 if c.width else 100 for c in table.rows[0].cells]
        heights = [7 + T.table_pt * 1.4 * max(_est_lines(c.text, (widths[i] if i < len(widths) else 100) - 12, T.table_pt) for i, c in enumerate(row.cells)) for row in table.rows]
        est = sum(heights)
        if est <= 0.9 * frame_h:
            # A source or note line under the table keeps with it, so it never opens the next page alone.
            nxt = table._tbl.getnext()
            noted = nxt is not None and nxt.tag == qn("w:p") and bool(SOURCE_LINE.match("".join(t.text or "" for t in nxt.iter(qn("w:t"))).strip()))
            rows = list(table.rows)
            # Spec Amendments 3: a long table (header + 6 body rows or more) may break between rows, header repeated,
            # only where a quarter of the frame or more is left: the header keeps rows worth a quarter of the frame
            # (and at least three body rows) with it, so the table can only break when moving it whole would leave
            # the page under 0.75 filled; the last three body rows stay together.
            head, filled = 0, 0.0
            while head < len(rows) and (head < 4 or filled < 0.25 * frame_h):
                filled += heights[head]
                head += 1
            if len(rows) >= 7 and head <= len(rows) - 3:
                keep = rows[:head - 1] + rows[-3:-1] + ([rows[-1]] if noted else [])
            else:
                keep = rows if noted else rows[:-1]
            for row in keep:
                for cell in row.cells:
                    cell.paragraphs[0].paragraph_format.keep_with_next = True
        space_after_table(table)


def space_after_table(table):
    """The text under a table stands clear of its bottom rule: a note or source line 3 pt below it, the next
    paragraph 8 pt below the table or its last note (it touched the rule)."""
    nxt = table._tbl.getnext()
    gap = 3
    while nxt is not None and nxt.tag == qn("w:p"):
        if nxt.find(f"{qn('w:pPr')}/{qn('w:sectPr')}") is not None:
            # The section break after a page-wide table in a column body: the text below starts after it.
            nxt = nxt.getnext()
            continue
        p = Paragraph(nxt, table._parent)
        note = bool(SOURCE_LINE.match(p.text.strip())) or (p.style is not None and p.style.name == "Source Note")
        if not note and _level(p):
            return
        current = p.paragraph_format.space_before
        if current is None or current.pt < (gap if note else 8):
            p.paragraph_format.space_before = Pt(gap if note else 8)
        if not note:
            return
        gap = 0
        nxt = nxt.getnext()


def size_figures(doc, T: Tonality, start: int, width: int):
    shapes = list(doc.inline_shapes)[start:]
    max_h = frame_height(doc) * float((T.design.get("figure_style") or {}).get("max_height_ratio", 0.45))
    for shape in shapes:
        w, h = shape.width, shape.height
        if not w or not h:
            continue
        scale = min(width / w, max_h / h)
        shape.width, shape.height = Emu(int(w * scale)), Emu(int(h * scale))


def single_spaced_figures(doc):
    """A paragraph holding a picture is single spaced: a Latin body multiple under 1 cut the top off the image."""
    for p in doc.element.body.iter(qn("w:p")):
        if p.find(f".//{qn('w:drawing')}") is not None:
            Paragraph(p, doc._body).paragraph_format.line_spacing = 1.0


# ── Header and footer ───────────────────────────────────────────────────────

def short_title(front: dict) -> str:
    if front.get("short_title"):
        return str(front["short_title"])
    title = str(front.get("title") or "")
    if len(title) <= 40:
        return title
    cut = title[:40].rsplit(" ", 1)[0]
    return cut or title[:40]


def _running_line(p: Paragraph, items: list, front: dict, T: Tonality, width: int, align: str):
    """Running-head items on one line at about 82 % of the body size, regular, in the muted ink: the first
    item at the left edge, the last at the right; a folio alone takes the pack's alignment."""
    size, muted = T.furniture_pt, T.colour("ink_muted")
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)

    def put(item):
        if item == "title":
            styled_run(p, short_title(front), size, muted)
        elif item == "folio":
            add_field(p, "PAGE", size, muted)
        elif item == "section":
            add_field(p, 'STYLEREF "Heading 1"', size, muted, "")

    if len(items) == 1:
        p.alignment = {"center": WD_ALIGN_PARAGRAPH.CENTER, "left": WD_ALIGN_PARAGRAPH.LEFT}.get(align, WD_ALIGN_PARAGRAPH.RIGHT) if items[0] == "folio" else WD_ALIGN_PARAGRAPH.LEFT
        put(items[0])
        return
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    # The Header and Footer styles carry a centre tab mid-line; cleared, or the folio stops there.
    style = p.style
    while style is not None:
        for stop in style.paragraph_format.tab_stops:
            if stop.position < width:
                p.paragraph_format.tab_stops.add_tab_stop(stop.position, WD_TAB_ALIGNMENT.CLEAR)
        style = style.base_style
    p.paragraph_format.tab_stops.add_tab_stop(Emu(width), WD_TAB_ALIGNMENT.RIGHT)
    put(items[0])
    p.add_run("\t")
    put(items[-1])


def headers(ctx, front: dict, first_body: int):
    """The running head and folio the pack names (A4.8); none on a cover page or on page 1 of a document that
    opens with its title block. The notice is never repeated here."""
    doc, T = ctx.doc, ctx.T
    section = doc.sections[first_body]
    W = frame_width(doc)
    header, footer = section.header, section.footer
    header.is_linked_to_previous = False
    footer.is_linked_to_previous = False
    rh = T.running_head
    if not first_body:
        section.different_first_page_header_footer = True
    if rh.get("header"):
        _running_line(header.paragraphs[0], rh["header"], front, T, W, rh.get("folio_align", "right"))
    if rh.get("footer"):
        _running_line(footer.paragraphs[0], rh["footer"], front, T, W, rh.get("folio_align", "right"))


def neutral_headers(ctx, front: dict):
    """The plain profile: the notice tag in every header."""
    if front.get("notice"):
        notice_tag(ctx.doc.sections[0].header.paragraphs[0], str(front["notice"]))


# ── The build ───────────────────────────────────────────────────────────────

def _plain_text(text: str) -> str:
    return re.sub(r"\s+", "", re.sub(r"[*_`#>|\-]", "", text))


def estimate_pages(body: str, T: Tonality) -> float:
    """A rough page count for the component budget: characters of running text plus about one line of
    characters per table row, over the characters a page holds at the pack's size and leading."""
    rows = sum(1 for line in body.split("\n") if line.strip().startswith("|"))
    chars = len(_plain_text(body)) + rows * (40 if T.locale != "en" else 90)
    per_page = 1500 if T.locale != "en" else 3300
    return chars / per_page


class Build:
    """One conversion: the document, its tokens and the Markdown renderer the converter lends it."""

    def __init__(self, doc, T: Tonality, render_md, lang: str, filters=None):
        self.doc, self.T, self._render_md, self.lang = doc, T, render_md, lang
        self.filters = filters or (lambda s: s)
        self.column_count = T.columns
        self.kinds = []
        self.callouts_ok = None   # the callouts drawn as boxes, by kind, title and text (None: every callout)
        self.keyfigures_drawn = 0
        self.body_text = ""
        self.title_end = None
        self.notes = []

    def render(self, container, text: str, size: float | None = None):
        """Markdown (which may hold directives) into a container; figures sized to its width."""
        width = container.width if isinstance(container, Box) else frame_width(self.doc) if self.column_count == 1 else \
            int((frame_width(self.doc) - Mm(self.T.column_gap_mm) * (self.column_count - 1)) / self.column_count)
        for block in split_directives(text):
            if isinstance(block, Directive):
                self.directive(container, block, width)
                continue
            if COLUMN_BREAK.search(block):
                raise DesignError("<!-- column-break --> stands only inside ::: columns")
            block = re.sub(r"<!--.*?-->", "", block, flags=re.S)
            block = CAPTION_ATTR.sub(self._caption, block)
            if not block.strip():
                continue
            start = len(self.doc.inline_shapes)
            before = len(container.paragraphs) if size else 0
            tables = len(container.tables) if not isinstance(container, Box) else 0
            self._render_md(container, self.filters(block))
            size_figures(self.doc, self.T, start, width)
            if not isinstance(container, Box) and self.column_count > 1:
                for table in container.tables[tables:]:
                    cols = [c.width or 1 for c in table.rows[0].cells]
                    if len(cols) > 3:
                        # Wider than a column reads: the table and its caption span the page (D6.6).
                        self.span_page(table)
                        full = frame_width(self.doc)
                        table_width(table, full, [int(full * c / sum(cols)) for c in cols])
                    else:
                        # A table set in a column takes the column's width, its columns in proportion.
                        table_width(table, width, [int(width * c / sum(cols)) for c in cols])
            if size:
                for p in container.paragraphs[before:]:
                    for r in p.runs:
                        r.font.size = Pt(size)

    def _caption(self, m):
        style = m.group(2)
        if style not in TABLE_STYLES:
            raise DesignError(f"{{style={style}}}: table styles are {', '.join(TABLE_STYLES)}")
        if style != "booktabs" and not self.T.neutral:
            self.notes.append(f"{{style={style}}} on '{m.group(1).strip()[:30]}' is drawn as booktabs (every tonality)")
        return m.group(1)

    def allowed(self, d: Directive) -> bool:
        """The component budget (A4.5): the pack's kinds, three kinds at most, one key-figure strip, the callouts
        chosen for the document's length, two columns only when the parts are balanced."""
        kind = d.name
        if self.T.neutral:
            return kind != "pullquote"
        if kind not in self.T.allowed_kinds:
            return False
        if kind == "keyfigures" and self.keyfigures_drawn >= 1:
            return False
        if kind == "callout" and self.callouts_ok is not None and _callout_key(d) not in self.callouts_ok:
            return False
        if kind == "columns" and not balanced_parts(d):
            return False
        if kind not in self.kinds:
            if len(self.kinds) >= 3:
                return False
            self.kinds.append(kind)
        return True

    def directive(self, container, d: Directive, width: int):
        if d.name == "cover":
            raise DesignError(f"line {d.line}: ::: cover stands first in the document, before any other block")
        if d.name == "columns" and isinstance(container, Box):
            raise DesignError(f"line {d.line}: ::: columns stands at the top level only")
        if d.name == "pullquote" and not self.allowed(d):
            # Pull quotes are off: a sentence the body already says is left out, anything else stays as a paragraph.
            if _plain_text(d.body) in self.body_text:
                self.notes.append(f"line {d.line}: the pull quote repeats the body and is left out")
                return
            self.render(container, d.body)
            return
        if not self.allowed(d):
            # A component the direction does not use keeps its content as ordinary text.
            before = len(container.paragraphs)
            if d.attrs.get("title"):
                # A run-in head over the block's text: the space above it is a heading's, so it starts a block.
                p = container.add_paragraph()
                p.paragraph_format.keep_with_next = True
                p.paragraph_format.space_before = Pt(12)
                p.paragraph_format.space_after = Pt(2)
                styled_run(p, d.attrs["title"], None, self.T.colour("ink"), True)
            body = COLUMN_BREAK.sub("", d.body)
            if d.name == "keyfigures":
                body = "\n".join(f"- {i['figure'].join(['**', '**'])} {_with_basis(i['label'], i['basis'])}" for i in keyfigure_items(d.body, d.line))
            self.render(container, body)
            # A short block set inline (a sidebar of definitions, a figure list) stays together on one page.
            added = [q for q in container.paragraphs[before:] if q.text.strip()]
            if d.name in ("sidebar", "keyfigures", "callout") and len(added) <= 8:
                for q in added[:-1]:
                    q.paragraph_format.keep_with_next = True
            return
        if d.name == "keyfigures":
            self.keyfigures_drawn += 1
            add_keyfigures(self, container, d, width)
        elif d.name == "callout":
            add_callout(self, container, d, width)
        elif d.name == "sidebar":
            add_sidebar(self, container, d, width)
        elif d.name == "columns":
            add_columns(self, d)

    def spacer(self, container):
        p = container.add_paragraph()
        tiny(p)
        p.paragraph_format.space_after = Pt(8)

    def span_page(self, table):
        """Set one table (and the caption above it) in a one-column section inside a column body."""
        sentinel = self.doc.element.body.find(qn("w:sectPr"))

        def carrier(cols: int):
            sect = copy.deepcopy(sentinel)
            for el in sect.findall(qn("w:headerReference")) + sect.findall(qn("w:footerReference")) + sect.findall(qn("w:pgNumType")) + sect.findall(qn("w:titlePg")):
                sect.remove(el)
            _put(sect, _el("type", val="continuous"), SECTPR_ORDER)
            _put(sect, _el("cols", num=cols, space=int(self.T.column_gap_mm * 56.693)), SECTPR_ORDER)
            p = Paragraph(OxmlElement("w:p"), self.doc._body)
            tiny(p)
            _put(p._p.get_or_add_pPr(), sect, PPR_ORDER)
            return p._p

        start = table._tbl
        prev = start.getprevious()
        if prev is not None and prev.tag == qn("w:p") and TABLE_CAPTION.match("".join(t.text or "" for t in prev.iter(qn("w:t"))).strip()):
            start = prev
        start.addprevious(carrier(self.column_count))
        # A source or note line under the table spans with it: left in the column section it opened a short
        # column at the page foot, and the heading after it stood there alone (docx-spec Amendments 7).
        end = table._tbl
        while end.getnext() is not None and end.getnext().tag == qn("w:p") and SOURCE_LINE.match("".join(t.text or "" for t in end.getnext().iter(qn("w:t"))).strip()):
            end = end.getnext()
        end.addnext(carrier(1))

    def section_break(self, cols: int, gap: float, rule: bool = False):
        doc = self.doc
        new = doc.add_section(WD_SECTION.CONTINUOUS)
        tiny(doc.paragraphs[-1])
        # Page numbers run on through a column section; only the first body section restarts them.
        for restart in new._sectPr.findall(qn("w:pgNumType")) + new._sectPr.findall(qn("w:titlePg")):
            new._sectPr.remove(restart)
        el = _el("cols", num=cols, space=int(gap * 56.693))
        if rule:
            el.set(qn("w:sep"), "1")
        _put(new._sectPr, el, SECTPR_ORDER)
        self.column_count = cols

    def balance_last_page(self):
        """A column body ends with a continuous break, so its last page sets the columns to an even depth instead
        of one column of text beside an empty one (docx-spec Amendments 7)."""
        cols = self.doc.element.body.find(qn("w:sectPr")).find(qn("w:cols"))
        if cols is None or int(cols.get(qn("w:num"), "1") or 1) < 2:
            return
        # LibreOffice gave up balancing when widow control held a short closing paragraph whole (docx-spec
        # Amendments 7: example 06-journal-en kept one column beside an empty one).
        last = next((p for p in reversed(self.doc.paragraphs) if p.text.strip()), None)
        if last is not None:
            last.paragraph_format.widow_control = False
        self.section_break(1, self.T.column_gap_mm)
        # The closing section holds one hidden 1 pt paragraph: an empty one took a body line of its own, and a last
        # page whose columns could not balance spilled it onto a blank page.
        end = self.doc.add_paragraph()
        tiny(end)
        end._p.pPr.find(qn("w:rPr")).insert(0, _el("vanish"))


def choose_callouts(blocks: list, T: Tonality, body: str) -> set | None:
    """The callouts drawn as boxes: about one per four pages (the pack may cap it), the decision request first,
    then warnings, then notes; the others keep their content as text."""
    if T.neutral:
        return None
    found = [b for b in blocks if isinstance(b, Directive) and b.name == "callout"]
    cap = T.components.get("callout_max")
    budget = max(1, round(estimate_pages(body, T) / 4))
    if cap is not None:
        budget = min(budget, int(cap))
    ranked = sorted(found, key=lambda b: (CALLOUT_PRIORITY.get(b.attrs.get("kind"), 3), b.line))
    return {_callout_key(b) for b in ranked[:budget]}


def _callout_key(d: Directive) -> tuple:
    return (d.attrs.get("kind"), d.attrs.get("title"), d.body.strip())


def _place_after_first_paragraph(blocks: list, directive: Directive) -> list:
    """Put a directive after the first paragraph of the first section (the summary)."""
    for i, b in enumerate(blocks):
        if isinstance(b, str) and re.search(r"^#{1,2}\s", b, re.M):
            m = re.search(r"^#{1,2}\s.*$", b, re.M)
            rest = b[m.end():]
            para = re.search(r"\S.*?(?:\n\s*\n|\Z)", rest, re.S)
            if not para:
                return blocks[:i + 1] + [directive] + blocks[i + 1:]
            cut = m.end() + para.end()
            return blocks[:i] + [b[:cut], directive, b[cut:]] + blocks[i + 1:]
    return [directive] + blocks


def build(doc, front: dict, body: str, T: Tonality, render_md, lang: str, filters=None):
    """Convert a body (frontmatter already parsed) into doc with the tonality T."""
    # A source short enough for about one page is set tight in any tonality, as a memo is, so a page of text never
    # spills a few lines onto a near-empty second page (docx-spec Amendments 6).
    if not T.neutral and not T.tight and estimate_pages(body, T) <= 1.0:
        T.design["spacing"] = "tight"
        print(f"Note: a source of about one page is set with tight spacing so it stays on one page")
    ctx = Build(doc, T, render_md, lang, filters)
    ctx.body_text = _plain_text(body)
    set_page(doc.sections[0], T)
    setup_styles(doc, T)
    blocks = split_directives(body)
    while blocks and isinstance(blocks[0], str) and not blocks[0].strip():
        blocks.pop(0)
    cover = blocks.pop(0) if blocks and isinstance(blocks[0], Directive) and blocks[0].name == "cover" else None
    if any(isinstance(b, Directive) and b.name == "cover" for b in blocks):
        raise DesignError("::: cover stands first in the document, before any other block")
    if cover is not None:
        _check(cover.attrs.get("variant") or "typographic", COVERS, f"line {cover.line}: cover variant")
        if not front.get("title"):
            raise DesignError(f"line {cover.line}: a cover takes its title from frontmatter title:, which is missing")
        # Key figures never stand on a cover: they move to the summary when the tonality uses them, and
        # otherwise stay out (the summary states the same numbers).
        figures = [b for b in split_directives(cover.body, cover.line) if isinstance(b, Directive) and b.name == "keyfigures"]
        if figures and not T.neutral:
            if "keyfigures" in T.allowed_kinds:
                blocks = _place_after_first_paragraph(blocks, figures[0])
            else:
                ctx.notes.append(f"{T.name} sets no key figures; the cover's figures stay in the summary text")
    if T.design.get("conclusion_first"):
        # Brief: the decision request opens the document, right under the title block.
        key = next((b for b in blocks if isinstance(b, Directive) and b.name == "callout" and b.attrs.get("kind") == "key"), None)
        if key is not None:
            blocks.remove(key)
            blocks.insert(0, key)
    ctx.callouts_ok = choose_callouts(blocks, T, body)
    first_body = 0
    if T.neutral:
        if front.get("title"):
            masthead(ctx, front, cover)
    elif T.title_block == "cover" and front.get("title"):
        cover_page(ctx, front, cover)
        first_body = 1
    elif front.get("title"):
        title_block(ctx, front, cover)
    if T.columns > 1:
        if first_body:
            _put(doc.sections[-1]._sectPr, _el("cols", num=T.columns, space=int(T.column_gap_mm * 56.693)), SECTPR_ORDER)
        else:
            ctx.column_count = 1
            ctx.section_break(T.columns, T.column_gap_mm)
    rest = "\n".join(b if isinstance(b, str) else _unsplit(b) for b in blocks)
    ctx.render(doc, rest)
    if not T.neutral:
        treat_headings(doc, T)
        if T.design.get("summary_form") == "points":
            summary_points(doc, T)
    settle_sidebars(doc, T)
    keep_short_followers(doc)
    keep_short_lists(doc)
    if T.columns == 1:
        # In a column body the chain jumped to the next column and left the one before it empty.
        keep_heading_with_table(doc)
        keep_closing_section(doc, T)
    single_rule_after_boxes(doc)
    last_line_company(doc)
    single_spaced_figures(doc)
    restart_numbered_lists(doc)
    space_after_lists(doc)
    style_source_lines(doc, lang)
    finish_tables(doc, T, lang)
    boxes_clear(doc)
    if not T.neutral:
        lone_list_items(doc)
        if lang != "en":
            korean_captions(doc)
            hangul_upright(doc)
        else:
            english_captions(doc)
        if T.design.get("contents") and estimate_pages(body, T) >= 5:
            add_contents(ctx, bookmark_h1(doc))
    recolour_links(doc, T)
    if T.neutral:
        neutral_headers(ctx, front)
    else:
        headers(ctx, front, first_body)
    if T.columns > 1:
        ctx.balance_last_page()
    for note in ctx.notes:
        print(f"Note: {note}")
    return ctx


def _unsplit(d: Directive) -> str:
    """A directive written back as source, so the body renders in one ordered pass."""
    depth = 3 + max([len(m.group(1)) - 2 for m in re.finditer(r"^(:{3,})", d.body, re.M)] or [0])
    fence = ":" * depth
    attrs = " ".join([*d.args, *(f'{k}="{v}"' for k, v in d.attrs.items())])
    return f"{fence} {d.name} {attrs}\n{d.body}\n{fence}"
