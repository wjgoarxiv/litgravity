"""docx_layout.py — the document output checks qa_docx.py runs on a converted .docx.

Two groups. The structural checks read the Word file (and the frontmatter of its Markdown source):

  heading.declarative  a heading, the title or the subtitle is a sentence, not a noun-phrase label
  heading.order        heading levels never skip downward, and the first heading is h1 or h2
  notice.dash          the frontmatter notice joins its label and line with a colon, not a spaced dash (FAIL on a
                       tonality run, advice on the plain and publisher paths)
  component.count      components per kind (cover, callout, sidebar, pullquote, keyfigures, columns)

The page checks need the document rendered (qa_docx.py --layout; soffice converts it to PDF and
PyMuPDF reads the text lines, drawings and pictures of each page, in points):

  fill.page            no body page is filled under 0.35 of its frame (the cover and the last page excepted)
  memo.fit             a memo never spills onto a second page that it fills under a quarter of the frame
  page.spill           a two-page document fills its second page to 0.4 of the frame or more, and no
                       document ends on a page holding a paragraph or two (under an eighth of the frame)
  list.split           a list of up to six items stands on one page (or in one column); in a column body a list of
                       five or six may break once with two items or more on each side
  heading.apart        a heading and its short lead sentence stand on the page where the table (up to eight body
                       rows) they open starts
  heading.stranded     no page ends on a heading
  heading.column       in a column body a heading never ends a column while its text opens the next one
  columns.balance      in a column body no column stops a quarter of the frame short beside one that runs to the
                       foot, and the last page sets its columns to about the same depth
  heading.wrap         the title, the subtitle and every heading wrap only between words
  title.lines          the title takes at most three lines
  folio.total          a "page / total" folio counts the pages the reader has
  sidebar.overlap      a floating sidebar ends before the next heading starts beside it
  table.split          a table that fits one frame (0.9 of its height) stays on one page and with its
                       caption, except an allowed long-table split (spec Amendments 3: tonality run, header
                       + 6 body rows or more, 3 body rows each side, the table started above 0.75 of the
                       frame); a component box (key figures, callout, sidebar) always stays whole
  figure.split         a picture and its caption stand on the same page
  component.variety    a document of four or more pages uses at least two component kinds
  cover.block          a filled shape covers more than a quarter of the cover page (tonality runs)

The restraint checks (spec Amendments 4, A4.11) read the Word file; they FAIL on a tonality run and are advice on
the plain and publisher paths, except date.iso, which holds on every path:

  color.accent-kinds   more than one non-ink hue, or the accent on more than two element kinds (figures aside)
  heading.ink          a heading set in a colour instead of ink
  heading.ratio        h1 more than 1.5 times the body size
  table.fill           a shaded data-table cell, or a component tint darker than L 95 %
  component.budget     more than three component kinds, more than one key-figure strip, any pull quote, or key
                       figures on the cover
  date.iso             an ISO date (2026-10-01) in the text of a Korean document
  furniture.chip       a coloured or shaded notice in a page header
  tonality.structure   (qa_docx.py --compare) two tonalities of one source differ in fewer than three structural
                       features: title block, summary form, heading numbering, component set, running head, contents

Each finding is {"check", "severity" ("FAIL" or "ADVISORY"), "page" or None, "detail", "fix"}.
"""

from __future__ import annotations

import re
import statistics
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
PIC = "{http://schemas.openxmlformats.org/drawingml/2006/main}blip"
KINDS = ("cover", "callout", "sidebar", "pullquote", "keyfigures", "columns")
FILL_MIN = 0.35
MEMO_SPILL = 0.25
SPILL_SECOND = 0.4     # docx-spec Amendments 6: page 2 of a two-page document
SPILL_LAST = 0.125     # the last page of any document
SHORT_LIST = 6
TITLE_LINES = 3
TABLE_CAPTION = re.compile(r"^(?:표|Table)\d+[.:]")  # on normalised text (no spaces)
FIT_SHARE = 0.9


def finding(check: str, severity: str, page, detail: str, fix: str) -> dict:
    return {"check": check, "severity": severity, "page": page, "detail": detail, "fix": fix}


def norm(text: str) -> str:
    """Text as both sides print it: no spaces, dashes and quotes folded (the converter sets 1-3 as 1–3)."""
    text = re.sub(r"\s+", "", text or "")
    return text.translate(str.maketrans({"–": "-", "—": "-", "‘": "'", "’": "'", "“": '"', "”": '"'}))


# ── heading.declarative ─────────────────────────────────────────────────────
#
# A heading names what its section covers; the finding goes in the first sentence under it. Korean is
# read on its last word: a sentence ending (다, 요, 죠, 니다) or a nominalised claim (…함, …됨, …음 after
# a verb stem) makes the line a sentence. English is read for a closing full stop or a finite verb (an
# auxiliary, or a reporting verb in the past or the third person). A closing parenthesis is set aside
# ("시범 운영 결과 (예시)"), and a question is not a claim.

KO_SENTENCE = re.compile(r"(?:니다|[어아해세에예네지군래게]요|죠|[었았였했겠됐](?:다|음)|[가-힣]다|[가-힣](?:함|됨)|(?:있|없)음)$")
KO_LABEL_WORDS = {"바다", "판다", "소다", "람다", "캐나다", "어젠다", "아젠다", "포함", "보다", "함", "다", "중심", "가능성", "다음"}
EN_AUX = re.compile(r"\b(?:is|are|was|were|has|have|had|will|would|can|could|should|must|does|did|won't|isn't|aren't|wasn't|doesn't|didn't)\b", re.I)
EN_FINITE = {
    "grew", "grows", "rose", "rises", "fell", "falls", "doubled", "doubles", "tripled", "halved", "increased", "increases",
    "decreased", "decreases", "declined", "declines", "improved", "improves", "dropped", "drops", "reached", "reaches",
    "exceeded", "exceeds", "missed", "misses", "stays", "stayed", "remains", "remained", "shows", "showed", "needs",
    "makes", "made", "drives", "drove", "leads", "led", "beats", "cuts", "saves", "saved", "pays", "paid", "works",
    "worked", "takes", "took", "wins", "won", "lost", "loses", "fails", "failed", "outperforms", "outperformed",
    "explains", "explained", "matters", "lifts", "lifted", "slowed", "slows", "delivers", "delivered", "requires",
}


def declarative(text: str) -> bool:
    t = re.sub(r"\s+", " ", str(text or "")).strip()
    t = re.sub(r"^(?:\d+(?:\.\d+)*\.?|[A-Z]\.|[IVX]+\.|[□○■▪•-])\s+", "", t)  # a number or marker the treatment adds
    t = re.sub(r"\s*\([^()]*\)$", "", t).strip().rstrip("\"'”’")
    if not t or t.endswith("?") or t[0] in "“\"「『‘'":
        return False
    if re.search(r"[가-힣]", t):
        last = re.sub(r"[.!…]+$", "", t.split(" ")[-1])
        return last not in KO_LABEL_WORDS and bool(KO_SENTENCE.search(last))
    if t.endswith((".", "!")):
        return True
    words = re.findall(r"[A-Za-z']+", t)
    return bool(EN_AUX.search(t)) or any(w.lower() in EN_FINITE for w in words[1:])


# ── Reading the Word file ───────────────────────────────────────────────────

class Styles:
    """Paragraph style ids to heading levels and names, following basedOn."""

    def __init__(self, root):
        self.s = {}
        for st in root.findall(W + "style") if root is not None else []:
            name = st.find(W + "name")
            based = st.find(W + "basedOn")
            outline = st.find(f"{W}pPr/{W}outlineLvl")
            self.s[st.get(W + "styleId")] = (
                name.get(W + "val") if name is not None else "",
                based.get(W + "val") if based is not None else None,
                int(outline.get(W + "val")) if outline is not None else None,
            )

    def chain(self, sid):
        seen = set()
        while sid and sid in self.s and sid not in seen:
            seen.add(sid)
            yield sid, self.s[sid]
            sid = self.s[sid][1]

    def level(self, sid):
        for key, (name, _, outline) in self.chain(sid):
            m = re.match(r"(?i)^heading\s*(\d)$", name or "") or re.match(r"^Heading(\d)$", key)
            if m:
                return int(m.group(1))
            if (name or "").lower() in ("title", "subtitle"):
                return None
            if outline is not None and outline < 9:
                return outline + 1
        return None

    def names(self, sid) -> str:
        return " ".join(f"{key} {name}" for key, (name, _, _) in self.chain(sid)).lower()


def _text(el) -> str:
    return "".join(t.text or "" for t in el.iter(W + "t"))


def _body_blocks(parent):
    for child in parent:
        if child.tag == W + "sdt":
            content = child.find(W + "sdtContent")
            if content is not None:
                yield from _body_blocks(content)
        elif child.tag in (W + "p", W + "tbl"):
            yield child


def _columns(blocks: list, sect) -> None:
    """The blocks a section break closes take its column count ("cols")."""
    cols = sect.find(W + "cols") if sect is not None else None
    n = int(cols.get(W + "num", "1") or 1) if cols is not None else 1
    for b in reversed(blocks):
        if "cols" in b:
            break
        b["cols"] = n


def read_docx(path: Path) -> dict:
    """Blocks in reading order ({"t": "h"|"p"|"cap"|"img"|"tbl"}), components, body frame and sections."""
    with zipfile.ZipFile(path) as z:
        body = ET.fromstring(z.read("word/document.xml")).find(W + "body")
        styles = Styles(ET.fromstring(z.read("word/styles.xml")) if "word/styles.xml" in z.namelist() else None)
    blocks, comp = [], {k: 0 for k in KINDS}
    cover = memo = False
    seen_heading = False
    for el in _body_blocks(body):
        if el.tag == W + "tbl":
            tag = el.find(f"{W}tblPr/{W}tblCaption")
            kind = (tag.get(W + "val") if tag is not None else "") or ""
            word = kind.split(" ")[0]
            memo = memo or kind.startswith("cover memo")
            if word in comp:
                comp[word] += 1
                if word == "cover":
                    cover = True
            rows = []
            for tr in el.findall(W + "tr"):
                cells = [norm(_text(tc)) for tc in tr.findall(W + "tc")]
                rows.append(next((c for c in cells if c), ""))
            paras = [norm(_text(p)) for p in el.iter(W + "p")]
            blocks.append({"t": "tbl", "rows": rows, "component": word if word in comp else None, "cells": [t for t in paras if t]})
            continue
        ppr = el.find(W + "pPr")
        sid_el = ppr.find(W + "pStyle") if ppr is not None else None
        sid = sid_el.get(W + "val") if sid_el is not None else None
        level = styles.level(sid)
        names = styles.names(sid)
        text = _text(el)
        if "pullquote" in names:
            comp["pullquote"] += 1
        if el.find(f".//{PIC}") is not None:
            blocks.append({"t": "img", "text": norm(text)})
        elif level and text.strip():
            blocks.append({"t": "h", "level": level, "text": norm(text), "raw": text.strip()})
            seen_heading = True
        elif text.strip():
            listed = (ppr is not None and ppr.find(W + "numPr") is not None) or "list" in names
            blocks.append({"t": "cap" if "caption" in names else "p", "text": norm(text), "list": listed})
        if not seen_heading and ppr is not None and ppr.find(W + "sectPr") is not None and blocks:
            cover = True  # the first section ends before any heading: a cover page
        if ppr is not None and ppr.find(W + "sectPr") is not None:
            _columns(blocks, ppr.find(W + "sectPr"))
    _columns(blocks, body.find(W + "sectPr"))
    sections = list(body.iter(W + "sectPr"))
    # Column sections, plus the side-by-side rows the converter draws for columns with a column break.
    comp["columns"] += sum(1 for s in sections for c in s.findall(W + "cols") if int(c.get(W + "num", "1")) >= 2)
    comp["cover"] = max(comp["cover"], int(cover))
    main = body.find(W + "sectPr")
    if main is None and sections:
        main = sections[-1]
    frame = None
    if main is not None:
        size, margin = main.find(W + "pgSz"), main.find(W + "pgMar")
        pt = lambda el, key: abs(int(el.get(W + key, "0"))) / 20.0  # noqa: E731 (twips)
        frame = {"page_h": pt(size, "h"), "top": pt(margin, "top"), "bottom": pt(margin, "bottom")}
    return {"blocks": blocks, "components": comp, "cover": cover, "memo": memo, "frame": frame}


# ── Restraint checks (spec Amendments 4, A4.11) ────────────────────────────

def _rgb(hexs: str):
    try:
        return tuple(int(hexs[i:i + 2], 16) for i in (0, 2, 4))
    except (ValueError, TypeError):
        return None


def hue(hexs: str):
    """None for ink (black, greys, white, auto) and for a near-white tint; else a hue bucket of 30 degrees."""
    rgb = _rgb((hexs or "").lstrip("#"))
    if rgb is None:
        return None
    hi, lo = max(rgb), min(rgb)
    if hi - lo < 32 or lo >= 236:  # a neutral grey, or a tint too pale to read as a colour
        return None
    r, g, b = (c / 255 for c in rgb)
    mx, mn = max(r, g, b), min(r, g, b)
    d = mx - mn
    h = ((g - b) / d) % 6 if mx == r else (b - r) / d + 2 if mx == g else (r - g) / d + 4
    return int(round(h * 60 / 30)) % 12


def lightness(hexs: str) -> float:
    rgb = _rgb((hexs or "").lstrip("#"))
    return 1.0 if rgb is None else (max(rgb) + min(rgb)) / 510


INK_FILLS = {"", "AUTO", "FFFFFF"}
ISO_DATE = re.compile(r"(?<!\d)(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?!\d)")
HANGUL = re.compile(r"[가-힣]")


def _style_props(root):
    """styleId -> (heading level or 0, own colour, own size in pt, basedOn, is a pull-quote style)."""
    out = {}
    for st in root.findall(W + "style") if root is not None else []:
        sid = st.get(W + "styleId")
        name = (st.find(W + "name").get(W + "val") if st.find(W + "name") is not None else "") or ""
        m = re.match(r"(?i)^heading\s*(\d)$", name) or re.match(r"^Heading(\d)$", sid or "")
        colour = st.find(f"{W}rPr/{W}color")
        size = st.find(f"{W}rPr/{W}sz")
        based = st.find(W + "basedOn")
        out[sid] = (int(m.group(1)) if m else 0, colour.get(W + "val") if colour is not None else None,
                    int(size.get(W + "val")) / 2 if size is not None else None, based.get(W + "val") if based is not None else None,
                    "pullquote" in name.lower())
    return out


def _resolve(props, sid, index):
    seen = set()
    while sid and sid in props and sid not in seen:
        seen.add(sid)
        if props[sid][index] is not None:
            return props[sid][index]
        sid = props[sid][3]
    return None


def restraint(path: Path, tonality: bool) -> list[dict]:
    """The A4.11 checks read from the Word XML (everything but cover.block and tonality.structure)."""
    sev = "FAIL" if tonality else "ADVISORY"
    found = []
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        doc = ET.fromstring(z.read("word/document.xml"))
        sroot = ET.fromstring(z.read("word/styles.xml")) if "word/styles.xml" in names else None
        heads = {n: ET.fromstring(z.read(n)) for n in names if re.match(r"word/header\d*\.xml$", n)}
        foots = {n: ET.fromstring(z.read(n)) for n in names if re.match(r"word/footer\d*\.xml$", n)}
    props = _style_props(sroot)
    default_id = next((s.get(W + "styleId") for s in (sroot.findall(W + "style") if sroot is not None else [])
                       if s.get(W + "type") == "paragraph" and s.get(W + "default") in ("1", "true")), "Normal")
    body = doc.find(W + "body")
    uses = {}  # hue bucket -> set of element kinds

    def use(colour, kind):
        h = hue(colour)
        if h is not None:
            uses.setdefault(h, set()).add(kind)

    used = {el.get(W + "val") for el in doc.iter(W + "pStyle")} | {el.get(W + "val") for el in doc.iter(W + "rStyle")} | {default_id}
    for sid in list(used):
        s, seen = sid, set()
        while s in props and s not in seen:  # a used style's colour may come from the style it is based on
            seen.add(s)
            if props[s][1]:
                use(props[s][1], "heading text" if sid in props and props[sid][0] else "text")
                break
            s = props[s][3]
    # heading.ink and heading.ratio
    body_pt = _resolve(props, default_id, 2) or 11.0
    h1_pt = 0.0
    coloured, shaded = [], []
    for p in body.iter(W + "p"):
        sid_el = p.find(f"{W}pPr/{W}pStyle")
        sid = sid_el.get(W + "val") if sid_el is not None else default_id
        level = 0
        s, seen = sid, set()
        while s in props and s not in seen:
            seen.add(s)
            if props[s][0]:
                level = props[s][0]
                break
            s = props[s][3]
        if not level:
            continue
        text = "".join(t.text or "" for t in p.iter(W + "t")).strip()
        if not text:
            continue
        colours = [c.get(W + "val") for c in p.iter(W + "color")] + [_resolve(props, sid, 1)]
        bad = [c for c in colours if hue(c) is not None]
        if bad:
            coloured.append(f"h{level} '{text[:30]}' #{bad[0]}")
        if level == 1:
            sizes = [int(s.get(W + "val")) / 2 for s in p.iter(W + "sz")] + [_resolve(props, sid, 2) or 0]
            h1_pt = max(h1_pt, max(sizes))
    if coloured:
        found.append(finding("heading.ink", sev, None, f"{len(coloured)} heading(s) in colour, e.g. {coloured[0]}",
                             "Set every heading in the body ink; separate levels by weight and space, never by colour."))
    if h1_pt and h1_pt / body_pt > 1.5:
        found.append(finding("heading.ratio", sev, None, f"h1 {h1_pt:g} pt over body {body_pt:g} pt is {h1_pt / body_pt:.2f}x (at most 1.5)",
                             "Keep the steps quiet: h1 about 1.4x, h2 about 1.2x, h3 the body size in bold."))
    # colours in the body: runs, rules, fills; tables apart from figures
    comp_count = {}
    for tbl in body.iter(W + "tbl"):
        cap = tbl.find(f"{W}tblPr/{W}tblCaption")
        kind = ((cap.get(W + "val") if cap is not None else "") or "").split(" ")[0]
        if kind:
            comp_count[kind] = comp_count.get(kind, 0) + 1
        for b in tbl.iter():
            if b.tag in (W + "top", W + "bottom", W + "left", W + "right", W + "insideH", W + "insideV") and b.get(W + "val") not in (None, "nil", "none"):
                use(b.get(W + "color"), "box rule" if kind else "table rule")
        for tc in tbl.iter(W + "tc"):
            shd = tc.find(f"{W}tcPr/{W}shd")
            fill = (shd.get(W + "fill") if shd is not None else "") or ""
            if fill.upper() in INK_FILLS:
                continue
            use(fill, "box fill" if kind else "table fill")
            if not kind:
                shaded.append(f"a data-table cell #{fill}")
                break
            if kind in ("callout", "sidebar", "keyfigures") and lightness(fill) < 0.95:
                shaded.append(f"a {kind} tint #{fill} darker than L 95 %")
                break
    if shaded:
        found.append(finding("table.fill", sev, None, f"{len(shaded)} shaded table(s), e.g. {shaded[0]}",
                             "Booktabs only: three rules, no fills, no zebra, a bold ink header; at most one very light tint (L 95 % or lighter) for one component kind."))
    for p in body.iter(W + "p"):
        for b in p.iter(W + "pBdr"):
            for side in b:
                if side.get(W + "val") not in (None, "nil", "none"):
                    use(side.get(W + "color"), "rule")
        shd = p.find(f"{W}pPr/{W}shd")
        if shd is not None:
            use(shd.get(W + "fill"), "paragraph fill")
        for r in p.iter(W + "r"):
            c = r.find(f"{W}rPr/{W}color")
            if c is not None:
                use(c.get(W + "val"), "text")
            rs = r.find(f"{W}rPr/{W}shd")
            if rs is not None:
                use(rs.get(W + "fill"), "text fill")
    for part in list(heads.values()) + list(foots.values()):
        for el in part.iter():
            if el.tag == W + "color":
                use(el.get(W + "val"), "page furniture")
            elif el.tag == W + "shd":
                use(el.get(W + "fill"), "page furniture")
    if len(uses) > 1:
        found.append(finding("color.accent-kinds", sev, None, f"{len(uses)} hues outside the ink: {sorted({k for v in uses.values() for k in v})}",
                             "One accent colour per document at most; everything else is ink and grey."))
    else:
        for h, kinds in uses.items():
            if len(kinds) > 2:
                found.append(finding("color.accent-kinds", sev, None, f"the accent marks {len(kinds)} element kinds: {sorted(kinds)}",
                                     "Use the accent on two element kinds at most (for example the cover rule and the callout hairline)."))
    # component.budget
    kinds = {k for k in ("callout", "sidebar", "keyfigures", "columns") if comp_count.get(k)}
    pull = sum(1 for p in body.iter(W + "p")
               if (lambda s: s is not None and _resolve(props, s.get(W + "val"), 4))(p.find(f"{W}pPr/{W}pStyle")))
    if any(int(c.get(W + "num", "1")) >= 2 for s in body.iter(W + "sectPr") for c in s.findall(W + "cols")):
        kinds.add("columns")
    if pull:
        kinds.add("pullquote")
    cover_kf = False
    for el in body:
        if el.tag == W + "tbl":
            cap = el.find(f"{W}tblPr/{W}tblCaption")
            if cap is not None and cap.get(W + "val") == "keyfigures":
                cover_kf = True
        if el.tag == W + "p" and el.find(f"{W}pPr/{W}sectPr") is not None:
            break
        if el.tag == W + "p" and el.find(f"{W}pPr/{W}pStyle") is not None and props.get(el.find(f"{W}pPr/{W}pStyle").get(W + "val"), (0,))[0]:
            cover_kf = False  # a heading before the first section break: page 1 is not a cover
            break
    else:
        cover_kf = False
    problems = []
    if len(kinds) > 3:
        problems.append(f"{len(kinds)} component kinds ({', '.join(sorted(kinds))})")
    if comp_count.get("keyfigures", 0) > 1:
        problems.append(f"{comp_count['keyfigures']} key-figure strips")
    if pull:
        problems.append(f"{pull} pull quote(s)")
    if cover_kf:
        problems.append("key figures on the cover")
    if problems:
        found.append(finding("component.budget", sev, None, "; ".join(problems),
                             "Three component kinds at most; one key-figure strip, in the summary; no pull quotes; a cover holds no key figures."))
    # date.iso (every path) and furniture.chip
    text = " ".join(t.text or "" for part in [doc, *heads.values(), *foots.values()] for t in part.iter(W + "t"))
    if len(HANGUL.findall(text)) > 0.05 * max(1, len(re.sub(r"\s", "", text))):
        m = ISO_DATE.search(text)
        if m:
            found.append(finding("date.iso", "FAIL", None, f"an ISO date {m.group(0)} in a Korean document",
                                 "Write Korean dates as 2026. 10. 1. or 2026년 10월 1일."))
    for name, part in heads.items():
        chip = [el for el in part.iter() if (el.tag == W + "shd" and (el.get(W + "fill") or "").upper() not in INK_FILLS)
                or (el.tag == W + "color" and hue(el.get(W + "val")) is not None)]
        if chip and "".join(t.text or "" for t in part.iter(W + "t")).strip():
            found.append(finding("furniture.chip", sev, None, f"{name.split('/')[-1]} holds a coloured or shaded notice",
                                 "State the sample-data notice once, on the cover or the first page, in ink; page headers stay quiet."))
            break
    return found


# ── tonality.structure ──────────────────────────────────────────────────────

STRUCTURE_KEYS = ("title_block", "summary", "numbering", "components", "running_head", "contents")


def structure(path: Path) -> dict:
    """The structural features of a document (A4.6): what stands on page 1, how the summary is set, how headings
    are numbered, which components it uses, what the running head carries and whether it lists its contents."""
    info = read_docx(path)
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        heads = [ET.fromstring(z.read(n)) for n in names if re.match(r"word/header\d*\.xml$", n)]
        foots = [ET.fromstring(z.read(n)) for n in names if re.match(r"word/footer\d*\.xml$", n)]
        body = ET.fromstring(z.read("word/document.xml")).find(W + "body")
    caps = [((t.find(f"{W}tblPr/{W}tblCaption").get(W + "val") if t.find(f"{W}tblPr/{W}tblCaption") is not None else "") or "")
            for t in body.iter(W + "tbl")]
    # A cover page: the first section ends before any heading and the next section starts on a new page
    # (a section's w:type says how that section starts).
    cover_page = False
    sects = [el.find(f"{W}pPr/{W}sectPr") for el in body if el.tag == W + "p" and el.find(f"{W}pPr/{W}sectPr") is not None]
    sects.append(body.find(W + "sectPr"))
    for el in body:
        ppr = el.find(W + "pPr") if el.tag == W + "p" else None
        if ppr is not None and ppr.find(W + "pStyle") is not None and re.match(r"Heading\d", ppr.find(W + "pStyle").get(W + "val") or ""):
            break
        if ppr is not None and ppr.find(W + "sectPr") is not None:
            nxt = sects[1] if len(sects) > 1 else None
            kind = nxt.find(W + "type") if nxt is not None else None
            cover_page = kind is None or kind.get(W + "val") != "continuous"
            break
    if cover_page:
        title = "cover page"
    elif any(c.startswith("cover memo") for c in caps):
        title = "memo block"
    elif any(c.startswith("cover") for c in caps):
        title = "title block + " + next(c for c in caps if c.startswith("cover")).split(" ", 1)[-1]
    else:
        title = "title block"
    blocks = info["blocks"]
    first_h = next((i for i, b in enumerate(blocks) if b["t"] == "h"), None)
    lead = blocks[first_h + 1:first_h + 6] if first_h is not None else []
    if any(b["t"] == "p" and re.match(r"^[①②③④⑤]", b["text"]) for b in lead):
        summary = "numbered points"
    elif any(b["t"] == "tbl" and b["component"] == "keyfigures" for b in blocks[: (first_h or 0) + 8]):
        summary = "key figures"
    else:
        summary = "prose"
    heads_text = [b["text"] for b in blocks if b["t"] == "h"]
    if heads_text and sum(bool(re.match(r"^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]\.", h)) for h in heads_text) >= 2:
        numbering = "roman"
    elif heads_text and sum(bool(re.match(r"^\d+(\.\d+)*\.?", h)) for h in heads_text) >= 2:
        numbering = "decimal"
    else:
        numbering = "none"
    comps = sorted(k for k, v in info["components"].items() if v and k != "cover")

    def furniture(parts):
        out = set()
        for part in parts:
            xml = ET.tostring(part, encoding="unicode")
            text = "".join(t.text or "" for t in part.iter(W + "t")).strip()
            if "PAGE" not in xml and "STYLEREF" not in xml:
                continue  # a cover's own footer (byline, date) is not a running head
            if "STYLEREF" in xml:
                out.add("section")
            if "PAGE" in xml:
                out.add("folio")
            if re.sub(r"\d", "", text):
                out.add("title")
        return out
    running = f"header:{'+'.join(sorted(furniture(heads))) or '-'} footer:{'+'.join(sorted(furniture(foots))) or '-'}"
    contents = any(b["t"] == "p" and b["text"] in ("목차", "Contents") for b in blocks)
    return {"title_block": title, "summary": summary, "numbering": numbering, "components": ",".join(comps) or "-",
            "running_head": running, "contents": contents}


def structure_diff(a: dict, b: dict) -> list[str]:
    return [k for k in STRUCTURE_KEYS if a.get(k) != b.get(k)]


# ── Structural checks ───────────────────────────────────────────────────────

def structural(info: dict, front: dict, manuscript: bool, tonality: bool = True) -> list[dict]:
    found = []
    heads = [b for b in info["blocks"] if b["t"] == "h"]
    if heads and heads[0]["level"] > 2:
        found.append(finding("heading.order", "FAIL", None, f"the first heading is h{heads[0]['level']}: {heads[0]['raw'][:60]}",
                             "Open the document with a # or ## heading."))
    for prev, head in zip(heads, heads[1:]):
        if head["level"] > prev["level"] + 1:
            found.append(finding("heading.order", "FAIL", None, f"h{prev['level']} -> h{head['level']}: {head['raw'][:60]}",
                                 f"Make it an h{prev['level'] + 1}, or add the missing level above it."))
    # The example-data note reads as a label and its line, never two halves around a spaced dash (Amendments 6).
    notice = str(front.get("notice") or "")
    if re.search(r"\s[—–]\s", notice):
        found.append(finding("notice.dash", "FAIL" if tonality else "ADVISORY", None, f"the notice joins its parts with a spaced dash: {notice[:60]}",
                             "Write the label with a colon (예시 데이터: …; Sample memo: …)."))
    labels = [("title", front.get("title")), ("subtitle", front.get("subtitle"))] + [(f"h{h['level']}", h["raw"]) for h in heads]
    for what, text in labels:
        if text and declarative(str(text)):
            found.append(finding("heading.declarative", "ADVISORY" if manuscript else "FAIL", None, f"the {what} is a sentence: {str(text)[:60]}",
                                 "Name the topic as a noun phrase (1년 운영 결과; Conversion by feed rate) and put the claim in the first sentence under it."))
    return found


# ── Page checks ─────────────────────────────────────────────────────────────

def read_pdf(pdf: Path) -> list[dict]:
    """Per page: size, text lines (top, bottom, normalised text) and ink boxes (text, drawings, pictures)."""
    import pymupdf

    pages = []
    with pymupdf.open(pdf) as document:
        for page in document:
            lines, ink, boxes = [], [], []
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    text = "".join(span["text"] for span in line["spans"])
                    if text.strip():
                        x0, y0, x1, y1 = line["bbox"]
                        lines.append((y0, y1, norm(text)))
                        boxes.append((x0, y0, x1, y1, norm(text)))
                        ink.append((y0, y1))
            fills = 0.0
            for drawing in page.get_drawings():
                fill = drawing.get("fill")
                if drawing.get("color") is not None or (fill is not None and min(fill) < 0.96):
                    ink.append((drawing["rect"].y0, drawing["rect"].y1))
                if fill is not None and min(fill) < 0.96:
                    fills += drawing["rect"].width * drawing["rect"].height
            images = [(info["bbox"][1], info["bbox"][3]) for info in page.get_image_info()]
            ink.extend(images)
            lines.sort()
            pages.append({"h": page.rect.height, "w": page.rect.width, "lines": lines, "ink": ink, "images": len(images), "boxes": boxes,
                          "filled": fills / (page.rect.width * page.rect.height)})
    return pages


def _column(hit, pages) -> int:
    """0 for a line in the left half of its page, 1 for the right half (a two-column body)."""
    page = pages[hit[0] - 1]
    box = next((b for b in page.get("boxes", []) if abs(b[1] - hit[1]) < 0.5 and b[4] == hit[3]), None)
    return 0 if box is None or box[0] < 297 else 1


def _starts(line: str, target: str) -> bool:
    """The PDF line opens the target: six shared characters, or all of a short target, or a short wrapped first line."""
    if not line or not target:
        return False
    k = 0
    for a, b in zip(line, target):
        if a != b:
            break
        k += 1
    return k >= min(len(target), 6) or k == len(line) >= min(2, len(target))


def _wraps(raw: str, lines: list) -> list[str]:
    """Where a label set over several PDF lines breaks inside a word: the text either side of each such break.
    A break may fall at a space or after a dash or slash; anywhere else it splits a word (제/안서)."""
    target = norm(raw)
    spaced = re.sub(r"\s+", " ", raw.translate(str.maketrans({"–": "-", "—": "-"}))).strip()
    ok_after, k = set(), 0  # positions in the normalised text where a break is allowed
    marker = re.match(r"^(?:\d+(?:\.\d+)*\.?|[A-Z]\.|[IVX]+\.|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]\.|[가나다라마바사아자차카타파하]\.|[□○■▪•-])", target)
    if marker:
        ok_after.add(marker.end())  # a numeral or marker the treatment sets apart with a tab
    for i, ch in enumerate(spaced):
        if ch == " ":
            ok_after.add(k)
            continue
        k += 1
        if ch in "-/":
            ok_after.add(k)
    cut = _set_over(target, lines)
    return [f"{target[max(0, c - 4):c]}/{target[c:c + 4]}" for c in cut or [] if c not in ok_after]


def _set_over(target: str, lines: list) -> list[int] | None:
    """The break positions of a normalised label set over consecutive PDF lines ([] on one line), or None."""
    for start in range(len(lines)):
        if lines[start][2] == target:
            return []
        if not lines[start][2] or not target.startswith(lines[start][2]):
            continue
        got, cut = lines[start][2], []
        for nxt in lines[start + 1:start + 8]:
            if not target.startswith(got + nxt[2]):
                break
            cut.append(len(got))
            got += nxt[2]
            if got == target:
                return cut
    return None


def _same(line: str, target: str) -> bool:
    """A stricter _starts for captions and box cells: 12 shared characters (or the whole text), so a sentence
    that only opens alike ("Table 2 summarises", "Half-conversion time.") is not taken for them."""
    if not line or not target:
        return False
    k = next((i for i, (a, b) in enumerate(zip(line, target)) if a != b), min(len(line), len(target)))
    return k >= min(len(target), 12) or (k == len(line) >= 8)


LONG_TABLE_ROWS = 7     # header + 6 body rows (spec Amendments 3)
SPLIT_SIDE_MIN = 3      # body rows on each side of an allowed split
SPLIT_START_MAX = 0.75  # moving the table whole would leave its first page under this fill


def long_split_ok(block, got, cap_hit, pages, frame, tonality) -> bool:
    """Spec Amendments 3: in a tonality run, a table of a header and six or more body rows may break between rows
    (header repeated) when it started high enough that moving it whole would leave the page under 0.75 filled,
    with at least three body rows on each side. Never on the publisher path."""
    spread = sorted({h[0] for h in got})
    if not tonality or len(block["rows"]) < LONG_TABLE_ROWS or len(spread) != 2:
        return False
    first = sum(1 for h in got if h[0] == spread[0]) - 1  # the header row stands on the first page
    second = sum(1 for h in got if h[0] == spread[1])
    page = pages[spread[0] - 1]
    top, floor = frame["top"], page["h"] - frame["bottom"]
    start = cap_hit[1] if cap_hit and cap_hit[0] == spread[0] else min(h[1] for h in got if h[0] == spread[0])
    return first >= SPLIT_SIDE_MIN and second >= SPLIT_SIDE_MIN and (start - top) / (floor - top) <= SPLIT_START_MAX


BALANCE_SHORT = 0.75   # a column that stops above this share of the frame beside one that runs to the foot
BALANCE_FULL = 0.9


def column_balance(info: dict, pages: list[dict], frame: dict, tonality: bool) -> list[dict]:
    """Columns of a two-column body (docx-spec Amendments 7): on a full page neither column stops a quarter of the
    frame short while the other runs to the foot, and the last page sets both columns to about the same depth
    instead of one column beside an empty one."""
    if not any(b.get("cols", 1) >= 2 for b in info["blocks"]):
        return []
    found = []
    top = frame["top"]
    for i, page in enumerate(pages, 1):
        floor, mid = page["h"] - frame["bottom"], page.get("w", 595.3) / 2
        body = [b for b in page.get("boxes", []) if b[1] >= top - 2 and b[3] <= floor + 2]
        left = [b for b in body if b[2] <= mid + 5]
        right = [b for b in body if b[0] >= mid - 5]
        depth = lambda side: (max(b[3] for b in side) - top) / (floor - top) if side else 0.0  # noqa: E731
        if i < len(pages):
            if left and right and max(depth(left), depth(right)) >= BALANCE_FULL and min(depth(left), depth(right)) < BALANCE_SHORT:
                short = "left" if depth(left) < depth(right) else "right"
                found.append(finding("columns.balance", "FAIL" if tonality else "ADVISORY", i,
                                     f"the {short} column on page {i} stops at {min(depth(left), depth(right)):.2f} of the frame while the other runs to the foot",
                                     "Let a list of five or six items in a column break after its first two items; keep only short blocks whole."))
        elif info["blocks"] and info["blocks"][-1].get("cols", 1) >= 2:
            start = min((b[1] for b in left + right), default=top)
            tall = lambda side: (max(b[3] for b in side) - start) / (floor - top) if side else 0.0  # noqa: E731
            longer, shorter = max(tall(left), tall(right)), min(tall(left), tall(right))
            if longer > 0.125 and shorter < 0.5 * longer:
                found.append(finding("columns.balance", "FAIL" if tonality else "ADVISORY", i,
                                     f"the last page sets one column {longer:.2f} of the frame deep beside one {shorter:.2f} deep",
                                     "End the column body with a continuous section break so the last page balances its columns."))
    return found


def paged(info: dict, pages: list[dict], tonality: bool, front: dict | None = None) -> tuple[list[dict], dict]:
    frame = info["frame"] or {"page_h": 841.9, "top": 56.7, "bottom": 56.7}
    top = frame["top"]
    found, fills = [], []
    n = len(pages)
    for i, page in enumerate(pages, 1):
        floor = page["h"] - frame["bottom"]
        body = [(y0, y1) for y0, y1 in page["ink"] if y1 > top - 2 and y0 < floor + 2]
        fill = round(max(0.0, min(1.0, (max((y1 for _, y1 in body), default=top) - top) / (floor - top))), 3)
        exempt = "last" if i == n else "cover" if info["cover"] and i == 1 else None
        fills.append({"page": i, "fill": fill, "exempt": exempt})
        if not exempt and fill < FILL_MIN:
            found.append(finding("fill.page", "FAIL", i, f"page {i} is filled to {fill:.2f} of its frame (floor {FILL_MIN})",
                                 "Let the next block move up: drop a forced break, keep a short section with its neighbour, or move a table under its text."))
    # A memo that spills less than a quarter of a page onto page 2 is a one-page memo set loosely (spec-v2
    # Amendments 7); more than that is a two-page memo, which the pack allows.
    if info.get("memo") and n == 2 and fills[-1]["fill"] < MEMO_SPILL:
        found.append(finding("memo.fit", "FAIL", 2, f"the memo runs onto a second page filled to {fills[-1]['fill']:.2f} of its frame",
                             "Set the memo on one page: the Memo pack's tight spacing, or shorten the text by the lines that spill."))
    # A second page filled under a third of its frame is a one-page document set loosely or a block left over;
    # a last page under an eighth holds a paragraph or two that the page before could carry (Amendments 6).
    if not info.get("memo") and n >= 2:
        last = fills[-1]["fill"]
        if n == 2 and last < SPILL_SECOND:
            found.append(finding("page.spill", "FAIL" if tonality else "ADVISORY", 2, f"page 2 of 2 is filled to {last:.2f} of its frame (at least {SPILL_SECOND:.2f})",
                                 "Set the document on one page (tight spacing for a source of about a page), or give page 2 a whole section."))
        elif last < SPILL_LAST:
            found.append(finding("page.spill", "FAIL" if tonality else "ADVISORY", n, f"the last page holds only {last:.2f} of its frame",
                                 "Keep the closing paragraph with the block before it, so the two share a page."))
    heads = [b for b in info["blocks"] if b["t"] == "h"]
    labels = [(what, str((front or {}).get(what))) for what in ("title", "subtitle") if (front or {}).get(what)]
    labels += [(f"h{h['level']}", h["raw"]) for h in heads]
    for what, raw in labels:
        for i, page in enumerate(pages, 1):
            splits = _wraps(raw, page["lines"])
            if splits:
                found.append(finding("heading.wrap", "FAIL", i, f"the {what} '{raw[:50]}' wraps inside a word on page {i} ({', '.join(splits)})",
                                     "Break the line between words: the converter sets cover and title lines at word boundaries; a heading too long for its column needs a shorter label."))
                break
    title = str((front or {}).get("title") or "")
    for i, page in enumerate(pages[:2], 1):
        cut = _set_over(norm(title), page["lines"]) if title else None
        if cut is not None and len(cut) + 1 > TITLE_LINES:
            found.append(finding("title.lines", "FAIL", i, f"the title takes {len(cut) + 1} lines (at most {TITLE_LINES})",
                                 "The converter sets a title in at most three lines; a longer title needs a shorter wording or a subtitle."))
            break
    body_pages = n - (1 if info["cover"] else 0)
    for i, page in enumerate(pages, 1):
        floor = page["h"] - frame["bottom"]
        for _, y0, _, t in [(None, ln[0], ln[1], ln[2]) for ln in page["lines"] if ln[0] > floor - 2]:
            m = re.fullmatch(r"(\d+)/(\d+)", t)
            if m and int(m.group(2)) not in (n, body_pages):
                found.append(finding("folio.total", "FAIL", i, f"the folio reads {m.group(1)} / {m.group(2)} in a document of {n} pages",
                                     "Print the page number alone, or a total that counts the pages the reader has."))
                break
        else:
            continue
        break
    for i, page in enumerate(pages[:-1], 1):
        floor = page["h"] - frame["bottom"]
        inside = [ln for ln in page["lines"] if ln[0] >= top - 2 and ln[1] <= floor + 2]
        if not inside:
            continue
        last = max(inside, key=lambda ln: ln[1])[2]
        for head in heads:
            h = head["text"]
            if last == h or (len(last) >= 4 and h.endswith(last)) or (last.endswith(h) and len(last) - len(h) <= 6 and len(h) >= 2):
                found.append(finding("heading.stranded", "FAIL", i, f"page {i} ends on the heading '{head['raw'][:50]}'",
                                     "The converter keeps a heading with its next paragraph; a heading over a long table or a picture needs a short lead sentence under it."))
                break
    lines = [(p, y0, y1, t) for p, page in enumerate(pages, 1) for y0, y1, t in page["lines"]]
    cursor = 0

    def find(target, max_page=None):
        nonlocal cursor
        for j in range(cursor, len(lines)):
            if max_page and lines[j][0] > max_page:
                return None
            if _starts(lines[j][3], target):
                cursor = j + 1
                return lines[j]
        return None

    body_h = frame["page_h"] - frame["top"] - frame["bottom"]
    image_pages = [p for p, page in enumerate(pages, 1) for _ in range(page["images"])]
    pictures = 0
    pending = None
    for block in info["blocks"]:
        if block["t"] == "h":
            find(block["text"])
        elif block["t"] == "tbl" and block["component"] in ("keyfigures", "callout", "sidebar"):
            # A component box is short by design; reading order inside it runs across cells, so each
            # paragraph is looked up from here without moving the cursor past the next block.
            hits = []
            for text in block.get("cells", []):
                if len(text) < 2:
                    continue
                hit = next((ln for ln in lines[cursor:] if _same(ln[3], text) and (not hits or ln[0] <= hits[0][0] + 1)), None)
                if hit:
                    hits.append(hit)
            spread = sorted({h[0] for h in hits})
            if len(spread) > 1:
                found.append(finding("table.split", "FAIL", spread[0], f"a {block['component']} box runs over pages {spread}",
                                     "A component box stays whole: its rows cannot split and it keeps with the heading above it."))
        elif block["t"] == "tbl" and block["component"] is None:
            prev = info["blocks"][info["blocks"].index(block) - 1] if info["blocks"].index(block) else None
            cap_hit = None
            if prev is not None and prev["t"] in ("cap", "p") and TABLE_CAPTION.match(prev["text"]):
                cap_hit = next((ln for ln in lines[max(0, cursor - 3):] if _same(ln[3], prev["text"])), None)
            got = []
            for row in block["rows"]:
                hit = find(row, got[-1][0] + 1 if got else None) if row else None
                if hit:
                    got.append(hit)
            spread = sorted({h[0] for h in got})
            if cap_hit:
                # The caption ends its page when no body line stands below it there.
                cp, cy1 = cap_hit[0], cap_hit[2]
                floor_y = pages[cp - 1]["h"] - frame["bottom"]
                if not any(ln[0] > cy1 + 1 and ln[1] <= floor_y and ln[2] not in prev["text"] for ln in pages[cp - 1]["lines"]):  # a wrapped caption line is not body
                    found.append(finding("table.split", "FAIL", cp, f"the caption '{prev['text'][:30]}' ends page {cp}; its table starts on the next page",
                                         "Keep the caption with its table (keep with next on the caption paragraph)."))
            height = sum(max(h[2] for h in got if h[0] == p) - min(h[1] for h in got if h[0] == p) for p in spread)
            if len(spread) > 1 and height <= FIT_SHARE * body_h and not long_split_ok(block, got, cap_hit, pages, frame, tonality):
                found.append(finding("table.split", "FAIL", spread[0], f"a table of {len(block['rows'])} rows (about {height:.0f} pt of a {body_h:.0f} pt frame) runs over pages {spread}",
                                     "Put a short lead sentence before it or move it under the next paragraph; never shrink its type to fit."))
        elif block["t"] == "img":
            pending = image_pages[pictures] if pictures < len(image_pages) else None
            pictures += 1
        elif block["t"] == "cap":
            hit = find(block["text"])
            if pending is not None and hit and hit[0] != pending:
                found.append(finding("figure.split", "FAIL", pending, f"a picture on page {pending} has its caption on page {hit[0]}",
                                     "Make the picture smaller in its source or give the section a lead sentence so both move together."))
            pending = None
    # Short lists and a heading with the table it opens (docx-spec Amendments 6), located by a cursor of their own.
    spots = []
    at, used = 0, set()
    for block in info["blocks"]:
        target = block["rows"][0] if block["t"] == "tbl" and block["rows"] and block["rows"][0] else block.get("text")
        hit = None
        if target and len(target) >= 2:
            # Lines on one baseline sort by height, so the head of the next column can stand a few lines back.
            for j in range(max(0, at - 4), len(lines)):
                if j not in used and _starts(lines[j][3], target):
                    hit, at = lines[j], max(at, j + 1)
                    used.add(j)
                    break
        spots.append(hit)
    k = 0
    blocks = info["blocks"]
    while k < len(blocks):
        if blocks[k]["t"] == "p" and blocks[k].get("list"):
            j = k
            while j < len(blocks) and blocks[j]["t"] == "p" and blocks[j].get("list"):
                j += 1
            items = [spots[i] for i in range(k, j) if spots[i] is not None]
            where = sorted({(h[0], _column(h, pages)) for h in items})
            # In a column a list of five or six may break once, two items or more on each side (Amendments 7).
            column_break = blocks[k].get("cols", 1) >= 2 and len(where) == 2 and j - k >= 5 and \
                min(sum(1 for h in items if (h[0], _column(h, pages)) == w) for w in where) >= 2
            if 2 <= j - k <= SHORT_LIST and len(where) > 1 and not column_break:
                found.append(finding("list.split", "FAIL" if tonality else "ADVISORY", where[0][0], f"a list of {j - k} items runs over {len(where)} pages or columns",
                                     "A list of up to six items keeps together: every item but the last keeps with the next, and its lead-in keeps with the list."))
            k = j
            continue
        if blocks[k]["t"] == "h" and k + 2 < len(blocks) and blocks[k + 1]["t"] == "p" and not blocks[k + 1].get("list"):
            nxt = next((i for i in range(k + 2, min(k + 5, len(blocks))) if blocks[i]["t"] == "tbl" and blocks[i]["component"] is None), None)
            # A short lead (about two lines) over a table of up to eight body rows, the chain the converter keeps.
            short = len(blocks[k + 1]["text"]) <= 200 and nxt is not None and len(blocks[nxt]["rows"]) <= 9
            # A heading in between opens its own section, and the table is that heading's, not this one's.
            if short and all(blocks[i]["t"] == "cap" or (blocks[i]["t"] != "h" and len(blocks[i].get("text", "")) <= 40) for i in range(k + 2, nxt)):
                if spots[k] and spots[nxt] and spots[k][0] != spots[nxt][0]:
                    found.append(finding("heading.apart", "FAIL" if tonality else "ADVISORY", spots[k][0],
                                         f"the heading '{blocks[k].get('raw', '')[:40]}' and its lead sentence end page {spots[k][0]}; the table they open starts page {spots[nxt][0]}",
                                         "Keep the heading, its lead sentence and the table together (keep with next), or move the sentence under the table."))
        k += 1
    # A heading in a column body stands with its first lines: never alone at the foot of a column while its text
    # opens the next column or page (docx-spec Amendments 7).
    for k, block in enumerate(blocks[:-1]):
        nxt = blocks[k + 1]
        if block["t"] != "h" or block.get("cols", 1) < 2 or nxt["t"] == "h" or not spots[k] or not spots[k + 1]:
            continue
        here, there = (spots[k][0], _column(spots[k], pages)), (spots[k + 1][0], _column(spots[k + 1], pages))
        if here != there:
            found.append(finding("heading.column", "FAIL" if tonality else "ADVISORY", here[0],
                                 f"the heading '{block.get('raw', '')[:40]}' ends a column on page {here[0]}; its text starts in the next column",
                                 "Keep the heading with its first lines; a source or note line under a page-wide table spans with the table."))
    found.extend(column_balance(info, pages, frame, tonality))
    # A floating sidebar that reaches past the next heading: the heading and its rule run beside the box.
    for k, block in enumerate(info["blocks"]):
        if block["t"] != "tbl" or block["component"] != "sidebar":
            continue
        nxt = next((b for b in info["blocks"][k + 1:] if b["t"] == "h"), None)
        if nxt is None:
            continue
        for i, page in enumerate(pages, 1):
            boxes = [b for b in page.get("boxes", []) if b[1] >= top - 2]  # the running header is not body
            cells = [c for c in block.get("cells", []) if len(c) >= 2]
            anchor = next((b for b in boxes if cells and _same(b[4], cells[0])), None)
            # the box's own lines share its left edge; body lines that open alike stand elsewhere
            mine = []
            if anchor:
                # the box: its title line, then every line in its column that follows without a gap (wrapped
                # lines included, which do not open a cell paragraph)
                mine = [anchor]
                for bx in sorted((b for b in boxes if b[1] > anchor[1] and b[0] >= anchor[0] - 24), key=lambda b: b[1]):
                    if bx[1] - mine[-1][3] > 20:
                        break
                    mine.append(bx)
            names = {nxt["text"], re.sub(r"^(?:\d+(?:\.\d+)*\.?|[□○■▪•-])", "", nxt["text"])}  # the numeral may stand apart
            head = next((b for b in boxes if any(_same(b[4], t) for t in names if len(t) >= 2)), None)
            if mine and head:
                x0, y0, y1 = min(b[0] for b in mine), min(b[1] for b in mine), max(b[3] for b in mine)
                if head[1] < y1 and head[3] > y0 and head[0] < x0:
                    found.append(finding("sidebar.overlap", "FAIL", i, f"the sidebar on page {i} runs beside the next heading '{nxt['raw'][:40]}'",
                                         "Give the sidebar more text beside it, or let it stand full width; the converter stops the float when the text before the next heading is shorter than the box."))
                break
    if tonality and info["cover"] and pages and pages[0].get("filled", 0) > 0.25:
        found.append(finding("cover.block", "FAIL", 1, f"filled shapes cover {pages[0]['filled']:.0%} of the cover page (at most 25 %)",
                             "A typographic cover: left-aligned title, white space, one rule at most; no colour block, no tiles."))
    kinds = [k for k, v in info["components"].items() if v]
    if n >= 4 and len(kinds) < 2:
        found.append(finding("component.variety", "FAIL" if tonality else "ADVISORY", None,
                             f"{n} pages use {len(kinds)} component kind(s): {', '.join(kinds) or 'none'}",
                             "Give the document a cover and the components its tonality allows: a callout for the decision, key figures with their basis, a sidebar for definitions."))
    body_fills = [f["fill"] for f in fills if not f["exempt"]]
    return found, {"pages": n, "fills": fills, "fill_median": round(statistics.median(body_fills), 3) if body_fills else None}
