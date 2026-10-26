#!/usr/bin/env python3
"""layout_inventory.py — geometry inventory of a .pptx for the lit-pptx QA gate.

For every text shape, picture and table on every slide it reports:

  off_slide       a text or table box leaves the canvas
  picture_bleed   a picture runs past the canvas edge (recorded, usually decoration)
  frame_overflow  the laid-out text needs more height than its frame gives it
                  (or, for wrap="none", more width), so it spills out
  slide_overflow  the spilled text or a grown table runs past the canvas edge
  overlaps        other content shapes whose boxes intersect this one

Without --issues-only every text shape also carries its text and every table its
cell text, so the inventory doubles as a reader for a deck made elsewhere.

Text is laid out without a renderer. Glyph advances come from the bundled
Pretendard / A2Z files (Pillow), the frame insets, margins, line spacing,
paragraph spacing, character spacing, explicit breaks and autofit settings
come from the OOXML. Korean wraps at spaces like Latin text, which is the
conservative choice: it never predicts fewer lines than a renderer draws.
Group shapes are flattened through their child transforms.

Usage:
    python3 layout_inventory.py deck.pptx [out.json] [--issues-only]

Prints JSON (or writes it to out.json). Exit 0 always: this is an inventory;
qa_deck.py decides what fails.
"""

from __future__ import annotations

import os as _os
import sys as _sys

_sys.dont_write_bytecode = True  # the installed skill directory stays read-only
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "..", "..", "lib"))
from office_runtime_bootstrap import ensure_runtime  # noqa: E402

ensure_runtime(["pptx", "PIL"])

import json  # noqa: E402
import sys  # noqa: E402
from functools import lru_cache  # noqa: E402
from pathlib import Path  # noqa: E402

from PIL import ImageFont  # noqa: E402
from pptx import Presentation  # noqa: E402
from pptx.enum.shapes import MSO_SHAPE_TYPE  # noqa: E402
from pptx.oxml.ns import qn  # noqa: E402

EMU_PER_IN = 914400.0
PT_PER_IN = 72.0
SKILL_ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = SKILL_ROOT / "fonts"

# A frame may miss by a hairline without a renderer drawing anything outside it.
FRAME_TOLERANCE_IN = 0.04
EDGE_TOLERANCE_IN = 0.02
OVERLAP_TOLERANCE_IN = 0.06
# PowerPoint's single line spacing is about 1.2 x the font size.
SINGLE_LINE = 1.2
DEFAULT_SIZE_PT = 18.0
DEFAULT_INSETS = {"lIns": 91440, "rIns": 91440, "tIns": 45720, "bIns": 45720}
A2Z_WEIGHTS = ("Thin", "ExtraLight", "Light", "Regular", "Medium", "SemiBold", "Bold", "ExtraBold", "Black")


def font_file(typeface: str, bold: bool) -> Path:
    face = (typeface or "").strip()
    last = face.split()[-1] if face.split() else ""
    if ("에이투지체" in face or face.startswith("A2Z")) and last in A2Z_WEIGHTS:
        candidate = FONT_DIR / "a2z" / f"A2Z-{last}.otf"
        if candidate.exists():
            return candidate
    # Pretendard metrics stand in for every other family: the bundled templates use
    # Pretendard, and an unknown family is measured with the closest thing on hand.
    return FONT_DIR / "pretendard" / ("Pretendard-Bold.otf" if bold else "Pretendard-Regular.otf")


@lru_cache(maxsize=64)
def _font(path: str, size_px: int):
    return ImageFont.truetype(path, size_px)


def text_width_pt(text: str, typeface: str, bold: bool, size_pt: float, spacing_pt: float) -> float:
    if not text:
        return 0.0
    # Measure at 10x the point size in pixels for sub-point precision, then scale back.
    scale = 10
    font = _font(str(font_file(typeface, bold)), max(1, round(size_pt * scale)))
    width = font.getlength(text) / scale
    return width + spacing_pt * len(text)


def _attr_int(element, name, default=None):
    if element is None:
        return default
    value = element.get(name)
    try:
        return int(value) if value is not None else default
    except ValueError:
        # A non-numeric value (a writer's "NaN") is the integrity check's finding;
        # here it measures as the default.
        return default


class Run:
    __slots__ = ("text", "size", "bold", "face", "spacing")

    def __init__(self, text, size, bold, face, spacing):
        self.text, self.size, self.bold, self.face, self.spacing = text, size, bold, face, spacing


def paragraph_runs(paragraph, fallback_size):
    """Yield lists of Runs, one list per visual line segment split by <a:br/>."""
    segments = [[]]
    for child in paragraph._p:
        tag = child.tag
        if tag == qn("a:br"):
            segments.append([])
            continue
        if tag not in (qn("a:r"), qn("a:fld")):
            continue
        rpr = child.find(qn("a:rPr"))
        size = _attr_int(rpr, "sz")
        size_pt = size / 100.0 if size else fallback_size
        bold = rpr is not None and rpr.get("b") in ("1", "true")
        spacing = (_attr_int(rpr, "spc", 0) or 0) / 100.0
        face = ""
        if rpr is not None:
            for tag_name in ("a:ea", "a:latin"):
                font_el = rpr.find(qn(tag_name))
                if font_el is not None and font_el.get("typeface"):
                    face = font_el.get("typeface")
                    break
        text_el = child.find(qn("a:t"))
        text = text_el.text if text_el is not None and text_el.text else ""
        segments[-1].append(Run(text, size_pt, bold, face, spacing))
    return segments


def _line_height(ppr, size_pt):
    lnspc = ppr.find(qn("a:lnSpc")) if ppr is not None else None
    if lnspc is not None:
        pct = lnspc.find(qn("a:spcPct"))
        pts = lnspc.find(qn("a:spcPts"))
        if pct is not None:
            return size_pt * SINGLE_LINE * int(pct.get("val")) / 100000.0
        if pts is not None:
            return int(pts.get("val")) / 100.0
    return size_pt * SINGLE_LINE


def _para_space(ppr, tag, size_pt):
    el = ppr.find(qn(tag)) if ppr is not None else None
    if el is None:
        return 0.0
    pct = el.find(qn("a:spcPct"))
    pts = el.find(qn("a:spcPts"))
    if pts is not None:
        return int(pts.get("val")) / 100.0
    if pct is not None:
        return size_pt * SINGLE_LINE * int(pct.get("val")) / 100000.0
    return 0.0


def wrap_segment(runs, width_pt, wrap):
    """Return (line_count, widest_line_pt) for one break-delimited segment."""
    tokens = []  # (text, run) pieces split at spaces, spaces kept on the left token
    for run in runs:
        piece = ""
        for ch in run.text:
            piece += ch
            if ch == " ":
                tokens.append((piece, run))
                piece = ""
        if piece:
            tokens.append((piece, run))
    if not tokens:
        return 1, 0.0
    measure = lambda text, run: text_width_pt(text, run.face, run.bold, run.size, run.spacing)  # noqa: E731
    if wrap == "none":
        return 1, sum(measure(t, r) for t, r in tokens)
    lines, current, widest = 1, 0.0, 0.0
    for text, run in tokens:
        word = measure(text.rstrip(" "), run)
        full = measure(text, run)
        if current > 0 and current + word > width_pt:
            widest = max(widest, current)
            lines += 1
            current = 0.0
        if current == 0 and word > width_pt:
            # A word longer than the line breaks mid-word, as renderers do.
            extra = int(word // max(width_pt, 1.0))
            lines += extra
            current = word - extra * width_pt
            widest = max(widest, width_pt)
            continue
        current += full
    widest = max(widest, current)
    return lines, widest


def layout_text(shape, width_in):
    """Return dict(needed_h_in, needed_w_in, autofit, wrap) for a shape's text frame."""
    body = shape.text_frame._txBody
    body_pr = body.find(qn("a:bodyPr"))
    insets = {k: _attr_int(body_pr, k, v) for k, v in DEFAULT_INSETS.items()}
    wrap = body_pr.get("wrap", "square") if body_pr is not None else "square"
    autofit = "none"
    font_scale = 1.0
    spacing_reduction = 0.0
    if body_pr is not None:
        if body_pr.find(qn("a:spAutoFit")) is not None:
            autofit = "shape"
        norm = body_pr.find(qn("a:normAutofit"))
        if norm is not None:
            autofit = "shrink"
            font_scale = _attr_int(norm, "fontScale", 100000) / 100000.0
            spacing_reduction = _attr_int(norm, "lnSpcReduction", 0) / 100000.0
    inner_w_pt = (width_in * EMU_PER_IN - insets["lIns"] - insets["rIns"]) / EMU_PER_IN * PT_PER_IN
    total_pt = 0.0
    widest_pt = 0.0
    last_size_pt = DEFAULT_SIZE_PT
    for paragraph in shape.text_frame.paragraphs:
        ppr = paragraph._p.find(qn("a:pPr"))
        margin_pt = (_attr_int(ppr, "marL", 0) or 0) / EMU_PER_IN * PT_PER_IN
        indent_pt = (_attr_int(ppr, "indent", 0) or 0) / EMU_PER_IN * PT_PER_IN
        end = paragraph._p.find(qn("a:endParaRPr"))
        fallback = (_attr_int(end, "sz") or DEFAULT_SIZE_PT * 100) / 100.0
        segments = paragraph_runs(paragraph, fallback)
        sizes = [r.size for seg in segments for r in seg if r.text] or [fallback]
        size_pt = max(sizes) * font_scale
        for seg in segments:
            for run in seg:
                run.size *= font_scale
        line_h = _line_height(ppr, size_pt) * (1.0 - spacing_reduction)
        avail = max(inner_w_pt - margin_pt - max(indent_pt, 0.0), 1.0)
        lines = 0
        for seg in segments:
            count, widest = wrap_segment(seg, avail, wrap)
            lines += count
            widest_pt = max(widest_pt, widest + margin_pt + max(indent_pt, 0.0))
        last_size_pt = size_pt
        total_pt += lines * line_h + _para_space(ppr, "a:spcBef", size_pt) + _para_space(ppr, "a:spcAft", size_pt)
    needed_h_in = total_pt / PT_PER_IN + (insets["tIns"] + insets["bIns"]) / EMU_PER_IN
    needed_w_in = widest_pt / PT_PER_IN + (insets["lIns"] + insets["rIns"]) / EMU_PER_IN
    anchor = body_pr.get("anchor", "t") if body_pr is not None else "t"
    # The leading under the last line is spacing, not ink: text whose only excess is
    # that leading draws inside its frame.
    slack_in = (SINGLE_LINE - 1.0) * last_size_pt / PT_PER_IN
    return {"needed_h_in": needed_h_in, "needed_w_in": needed_w_in, "autofit": autofit, "wrap": wrap, "anchor": anchor, "slack_in": slack_in}


def table_height_in(shape):
    table = shape.table
    total = 0.0
    for r_idx, row in enumerate(table.rows):
        row_h = row.height / EMU_PER_IN
        for c_idx, cell in enumerate(row.cells):
            if cell.is_spanned:
                continue
            width = sum(table.columns[c].width for c in range(c_idx, c_idx + max(cell.span_width, 1))) / EMU_PER_IN
            tc_pr = cell._tc.find(qn("a:tcPr"))
            ins_l = _attr_int(tc_pr, "marL", 91440) / EMU_PER_IN
            ins_r = _attr_int(tc_pr, "marR", 91440) / EMU_PER_IN
            ins_t = _attr_int(tc_pr, "marT", 45720) / EMU_PER_IN
            ins_b = _attr_int(tc_pr, "marB", 45720) / EMU_PER_IN
            inner_pt = max((width - ins_l - ins_r) * PT_PER_IN, 1.0)
            text_pt = 0.0
            for paragraph in cell.text_frame.paragraphs:
                ppr = paragraph._p.find(qn("a:pPr"))
                segments = paragraph_runs(paragraph, DEFAULT_SIZE_PT)
                sizes = [r.size for seg in segments for r in seg if r.text] or [DEFAULT_SIZE_PT]
                line_h = _line_height(ppr, max(sizes))
                lines = sum(wrap_segment(seg, inner_pt, "square")[0] for seg in segments)
                text_pt += lines * line_h
            row_h = max(row_h, text_pt / PT_PER_IN + ins_t + ins_b)
        total += row_h
    return total


def _kind(shape):
    if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
        return "picture"
    if getattr(shape, "has_table", False) and shape.has_table:
        return "table"
    if getattr(shape, "has_text_frame", False) and shape.has_text_frame and shape.text_frame.text.strip():
        return "text"
    return None


def flatten(shapes, transform=(0.0, 0.0, 1.0, 1.0)):
    """Yield (shape, box_in) with group transforms applied. box = (left, top, width, height)."""
    ox, oy, sx, sy = transform
    for shape in shapes:
        if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
            xfrm = shape._element.grpSpPr.find(qn("a:xfrm"))
            off, ext = xfrm.find(qn("a:off")), xfrm.find(qn("a:ext"))
            ch_off, ch_ext = xfrm.find(qn("a:chOff")), xfrm.find(qn("a:chExt"))
            gx = ox + int(off.get("x")) / EMU_PER_IN * sx
            gy = oy + int(off.get("y")) / EMU_PER_IN * sy
            cw = int(ch_ext.get("cx")) or 1
            ch = int(ch_ext.get("cy")) or 1
            nsx = sx * int(ext.get("cx")) / cw
            nsy = sy * int(ext.get("cy")) / ch
            child = (gx - int(ch_off.get("x")) / EMU_PER_IN * nsx, gy - int(ch_off.get("y")) / EMU_PER_IN * nsy, nsx, nsy)
            yield from flatten(shape.shapes, child)
            continue
        if shape.left is None or shape.width is None:
            continue
        box = (
            ox + shape.left / EMU_PER_IN * sx,
            oy + shape.top / EMU_PER_IN * sy,
            shape.width / EMU_PER_IN * sx,
            shape.height / EMU_PER_IN * sy,
        )
        yield shape, box


def _intersect(a, b):
    w = min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0])
    h = min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1])
    return w, h


def inventory(path: Path, issues_only: bool = False) -> dict:
    prs = Presentation(str(path))
    page_w = prs.slide_width / EMU_PER_IN
    page_h = prs.slide_height / EMU_PER_IN
    slides = []
    summary = {"shapes": 0, "off_slide": 0, "frame_overflow": 0, "slide_overflow": 0, "picture_bleed": 0, "overlap_shapes": 0}
    for number, slide in enumerate(prs.slides, start=1):
        entries = []
        for shape, box in flatten(slide.shapes):
            kind = _kind(shape)
            if kind is None:
                continue
            left, top, width, height = box
            issues = {}
            if kind != "picture" and (left < -EDGE_TOLERANCE_IN or top < -EDGE_TOLERANCE_IN or left + width > page_w + EDGE_TOLERANCE_IN or top + height > page_h + EDGE_TOLERANCE_IN):
                issues["off_slide"] = {
                    "left_in": round(-left, 3) if left < 0 else 0,
                    "top_in": round(-top, 3) if top < 0 else 0,
                    "right_in": round(left + width - page_w, 3) if left + width > page_w else 0,
                    "bottom_in": round(top + height - page_h, 3) if top + height > page_h else 0,
                }
            elif kind == "picture" and (left < -EDGE_TOLERANCE_IN or top < -EDGE_TOLERANCE_IN or left + width > page_w + EDGE_TOLERANCE_IN or top + height > page_h + EDGE_TOLERANCE_IN):
                # A picture past the edge is usually a deliberate bleed (a template's decorative
                # circle). It is recorded; qa_deck.py fails it only when the picture is declared
                # evidence, through its figure checks.
                issues["picture_bleed"] = True
            if kind == "text":
                laid = layout_text(shape, width)
                excess_h = laid["needed_h_in"] - height
                excess_w = laid["needed_w_in"] - width if laid["wrap"] == "none" else 0.0
                if laid["autofit"] == "shape":
                    # The frame grows to fit, so only the grown frame's edge matters.
                    grown_bottom = top + max(height, laid["needed_h_in"])
                    if grown_bottom > page_h + EDGE_TOLERANCE_IN:
                        issues["slide_overflow"] = {"bottom_in": round(grown_bottom - page_h, 3)}
                elif excess_h > max(FRAME_TOLERANCE_IN, laid["slack_in"]) or excess_w > FRAME_TOLERANCE_IN:
                    issues["frame_overflow"] = {
                        "needed_h_in": round(laid["needed_h_in"], 3),
                        "frame_h_in": round(height, 3),
                        "needed_w_in": round(laid["needed_w_in"], 3) if laid["wrap"] == "none" else None,
                        "frame_w_in": round(width, 3),
                        "autofit": laid["autofit"],
                    }
                    spill_top = top - max(excess_h, 0) / 2 if laid["anchor"] == "ctr" else top - max(excess_h, 0) if laid["anchor"] == "b" else top
                    spill_bottom = spill_top + max(height, laid["needed_h_in"])
                    if spill_bottom > page_h + EDGE_TOLERANCE_IN or spill_top < -EDGE_TOLERANCE_IN:
                        issues["slide_overflow"] = {"bottom_in": round(max(spill_bottom - page_h, 0), 3), "top_in": round(max(-spill_top, 0), 3)}
            elif kind == "table":
                grown = table_height_in(shape)
                if top + grown > page_h + EDGE_TOLERANCE_IN:
                    issues["slide_overflow"] = {"bottom_in": round(top + grown - page_h, 3), "table_h_in": round(grown, 3)}
            entry = {"name": shape.name, "id": shape.shape_id, "kind": kind, "box_in": [round(v, 3) for v in box], "issues": issues}
            if kind == "text":
                entry["text"] = shape.text_frame.text
            elif kind == "table":
                entry["rows"] = [[cell.text for cell in row.cells] for row in shape.table.rows]
            entries.append(entry)

        for i, a in enumerate(entries):
            for b in entries[i + 1:]:
                w, h = _intersect(a["box_in"], b["box_in"])
                if w > OVERLAP_TOLERANCE_IN and h > OVERLAP_TOLERANCE_IN:
                    a["issues"].setdefault("overlaps", []).append(b["name"])
                    b["issues"].setdefault("overlaps", []).append(a["name"])

        for entry in entries:
            summary["shapes"] += 1
            for key in ("off_slide", "frame_overflow", "slide_overflow", "picture_bleed"):
                if key in entry["issues"]:
                    summary[key] += 1
            if "overlaps" in entry["issues"]:
                summary["overlap_shapes"] += 1
        kept = [e for e in entries if e["issues"]] if issues_only else entries
        slides.append({"slide": number, "shapes": kept})
    return {"file": str(path), "slide_size_in": [round(page_w, 3), round(page_h, 3)], "summary": summary, "slides": slides}


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    if not args:
        print(__doc__)
        return 2
    report = inventory(Path(args[0]), issues_only="--issues-only" in argv)
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if len(args) > 1:
        Path(args[1]).write_text(text + "\n", encoding="utf-8")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
