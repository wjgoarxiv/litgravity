#!/usr/bin/env python3
"""
learn_template.py — Template learning: ingest a user's existing .pptx and emit
an enrolled template (template.yaml + capabilities.yaml + layout-mapping.yaml)
that this toolkit can render with.

Philosophy (brand-docs "off-brand by construction"): the generated template only
references fonts / colors / assets that actually exist in the source .pptx, and a
closed-set verification step asserts this before the template is accepted.

Usage:
    python3 scripts/learn_template.py <source.pptx> --name <TEMPLATE-NAME> [--out .lit-pptx/templates]

The default output directory is .lit-pptx/templates under the working directory,
which compile-deck.js searches before the bundled templates. Never write into the
installed skill directory.
"""

import os as _os
import sys as _sys

_sys.dont_write_bytecode = True  # the installed skill directory stays read-only
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "..", "..", "lib"))
from office_runtime_bootstrap import ensure_runtime  # noqa: E402

ensure_runtime(["defusedxml"])

import argparse
import sys
import zipfile
from pathlib import Path

from defusedxml import ElementTree as DET  # XXE / billion-laughs safe

A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
EMU = 914400.0

# ── security limits for untrusted input ──────────────────────────────────────
MAX_FILES = 5000
MAX_UNCOMPRESSED = 500 * 1024 * 1024  # 500 MB
MAX_RATIO = 200  # per-file compression ratio guard (zip-bomb)


class LearnError(Exception):
    pass


def _safe_open_zip(path: Path) -> zipfile.ZipFile:
    if path.suffix.lower() != ".pptx":
        raise LearnError(f"not a .pptx file: {path.name}")
    if not path.is_file():
        raise LearnError(f"file not found: {path}")
    try:
        zf = zipfile.ZipFile(path)
    except zipfile.BadZipFile as e:
        raise LearnError(f"malformed/not a zip: {e}")
    infos = zf.infolist()
    if len(infos) > MAX_FILES:
        raise LearnError(f"zip-bomb guard: too many entries ({len(infos)} > {MAX_FILES})")
    total = 0
    for i in infos:
        total += i.file_size
        if total > MAX_UNCOMPRESSED:
            raise LearnError(f"zip-bomb guard: uncompressed size exceeds {MAX_UNCOMPRESSED} bytes")
        if i.compress_size > 0 and (i.file_size / i.compress_size) > MAX_RATIO:
            raise LearnError(f"zip-bomb guard: entry {i.filename!r} ratio > {MAX_RATIO}")
    # must look like a pptx
    names = set(zf.namelist())
    if "ppt/presentation.xml" not in names:
        raise LearnError("not a PowerPoint package (no ppt/presentation.xml)")
    return zf


def _xml(zf, name):
    if name not in zf.namelist():
        return None
    return DET.fromstring(zf.read(name))


def _hex_from_clr(el):
    """Return 6-char hex from an a:srgbClr/a:sysClr child element, or None."""
    if el is None:
        return None
    s = el.find(f"{A}srgbClr")
    if s is not None and s.get("val"):
        return s.get("val").upper()
    sysc = el.find(f"{A}sysClr")
    if sysc is not None and sysc.get("lastClr"):
        return sysc.get("lastClr").upper()
    return None


def extract(zf):
    """Return a dict of discovered brand facts."""
    facts = {"dimensions": {}, "palette": {}, "fonts": {}, "used_fonts": set(),
             "assets": [], "regions": {}}

    # dimensions
    pres = _xml(zf, "ppt/presentation.xml")
    if pres is not None:
        sldsz = pres.find(f"{P}sldSz")
        if sldsz is not None:
            cx = int(sldsz.get("cx", 0)) / EMU
            cy = int(sldsz.get("cy", 0)) / EMU
            facts["dimensions"] = {"width": round(cx, 3), "height": round(cy, 3),
                                   "unit": "inches",
                                   "format": "16:9" if abs(cx / cy - 16 / 9) < 0.05 else
                                             ("4:3" if abs(cx / cy - 4 / 3) < 0.05 else "custom")}

    # theme: palette + font scheme
    theme = _xml(zf, "ppt/theme/theme1.xml")
    if theme is not None:
        clr = theme.find(f".//{A}clrScheme")
        if clr is not None:
            name_map = {"dk1": "ink", "lt1": "paper", "dk2": "ink_alt", "lt2": "paper_alt",
                        "accent1": "accent1", "accent2": "accent2", "accent3": "accent3",
                        "accent4": "accent4", "accent5": "accent5", "accent6": "accent6",
                        "hlink": "link", "folHlink": "link_visited"}
            for child in clr:
                tag = child.tag.replace(A, "")
                key = name_map.get(tag)
                hx = _hex_from_clr(child)
                if key and hx:
                    facts["palette"][key] = f"#{hx}"
        fs = theme.find(f".//{A}fontScheme")
        if fs is not None:
            def font_of(which):
                el = fs.find(f"{A}{which}")
                if el is None:
                    return {}
                out = {}
                latin = el.find(f"{A}latin")
                ea = el.find(f"{A}ea")
                if latin is not None and latin.get("typeface"):
                    out["latin"] = latin.get("typeface")
                if ea is not None and ea.get("typeface"):
                    out["ea"] = ea.get("typeface")
                return out
            facts["fonts"]["major"] = font_of("majorFont")
            facts["fonts"]["minor"] = font_of("minorFont")

    # fonts actually used in slides (authoritative for closed-set)
    for n in zf.namelist():
        if n.startswith("ppt/slides/slide") and n.endswith(".xml"):
            try:
                root = DET.fromstring(zf.read(n))
            except Exception:
                continue
            for el in root.iter():
                tf = el.get("typeface") if el.tag.endswith("}latin") or el.tag.endswith("}ea") else None
                if tf:
                    facts["used_fonts"].add(tf)

    # media assets
    for n in zf.namelist():
        if n.startswith("ppt/media/"):
            facts["assets"].append(Path(n).name)

    return facts


def _resolve_fonts(facts):
    """Pick title/body/light family names from discovered fonts (closed-set)."""
    used = facts["used_fonts"]
    major = (facts["fonts"].get("major") or {})
    minor = (facts["fonts"].get("minor") or {})
    # Prefer an actually-used font; else theme scheme; else a safe sans fallback.
    title = major.get("ea") or major.get("latin")
    body = minor.get("ea") or minor.get("latin")
    if used:
        # if the theme font isn't actually used, fall back to a used one
        if title not in used:
            title = sorted(used)[0]
        if body not in used:
            body = sorted(used)[0]
    title = title or "Arial"
    body = body or title
    return {"title": title, "body": body, "light": body}


def _palette(facts):
    p = dict(facts["palette"])
    ink = p.get("ink", "#000000")
    paper = p.get("paper", "#FFFFFF")
    return {
        "ink": ink, "paper": paper,
        "ink_muted": p.get("ink", "#444444"),
        "line": p.get("paper_alt", "#CCCCCC"),
        "header_fill": p.get("paper_alt", "#EEEEEE"),
        "accent_red": p.get("accent2", "#CC0000"),
        "accent_green": p.get("accent6", "#2E7D32"),
        "accent_amber": p.get("accent4", "#D79921"),
        "metric": p.get("accent1", ink),
        "source_blue": p.get("link", "#1155CC"),
    }


def _regions(facts):
    """Best-fit region geometry from dimensions (placeholder-aware fallback)."""
    w = facts["dimensions"].get("width", 10.0)
    h = facts["dimensions"].get("height", 7.5)
    mx = round(w * 0.06, 3)            # side margin ~6%
    cw = round(w - 2 * mx, 3)          # content width
    title_y = round(h * 0.06, 3)
    body_y = round(h * 0.18, 3)
    return {
        "cover": {"title": (mx, round(h * 0.40, 3), cw, 1.0),
                  "metadata": (mx, round(h * 0.56, 3), cw, 0.5),
                  "date_line": (mx, round(h * 0.66, 3), cw, 0.4)},
        "body": {"title": (mx, title_y, cw, 0.56),
                 "body": (mx, body_y, cw, None),
                 "image": (round(w * 0.54, 3), round(h * 0.18, 3), round(w * 0.40, 3), round(h * 0.42, 3))},
        "closing": {"title": (0.0, round(h * 0.43, 3), w, 0.95)},
    }


# ── YAML emit (matches the toolkit's minimal parser style) ───────────────────
def _yaml(obj, indent=0):
    pad = "  " * indent
    out = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, dict):
                if not v:
                    out.append(f"{pad}{k}: {{}}")
                else:
                    out.append(f"{pad}{k}:")
                    out.append(_yaml(v, indent + 1))
            elif isinstance(v, list):
                if not v:
                    out.append(f"{pad}{k}: []")
                else:
                    out.append(f"{pad}{k}:")
                    for item in v:
                        out.append(f"{pad}  - {_scalar(item)}")
            else:
                out.append(f"{pad}{k}: {_scalar(v)}")
    return "\n".join(out)


def _scalar(v):
    if isinstance(v, str):
        # quote hex colors, font names with spaces, and anything risky
        if v.startswith("#") or " " in v or v == "":
            return f'"{v}"'
        return v
    if isinstance(v, bool):
        return "true" if v else "false"
    return str(v)


def _font_role(font, size, color, align="left", bold=False, **extra):
    r = {"font": font, "size": size, "char_spacing": -0.3, "align": align,
         "bold": bold, "color": color}
    r.update(extra)
    return r


def build_template(facts, name):
    fonts = _resolve_fonts(facts)
    pal = _palette(facts)
    dims = facts["dimensions"] or {"width": 10.0, "height": 7.5, "unit": "inches", "format": "4:3"}
    ink = pal["ink"]

    template = {
        "name": name,
        "version": "1.0.0",
        "label": f"Learned from source ({name})",
        "description": f"Auto-generated enrolled template learned from a source .pptx. Fonts/colors are closed-set (only what the source contains).",
        "fonts": fonts,
        "dimensions": dims,
        "palette": pal,
        "decoration_assets": {},
        "global_typography": {
            "char_spacing": -0.3,
            "bold_rule": "Learned template — title font used for emphasis.",
            "bullet_font": fonts["body"],
            "bullet_char": "•",
            "bullet_color": ink.lstrip("#"),
            "section_accent": ink.lstrip("#"),
        },
    }

    fr = {
        "cover_title": _font_role(fonts["title"], 36, ink, "center", False, line_spacing=1.15),
        "cover_metadata": _font_role(fonts["body"], 13, pal["ink_muted"], "center"),
        "cover_date": _font_role(fonts["body"], 10, pal["ink_muted"], "center"),
        "section_title": _font_role(fonts["title"], 24, ink, "left"),
        "section_header": _font_role(fonts["title"], 15, ink, "left", False,
                                     space_after=6, bullet_type="bullet", bullet_char="•",
                                     bullet_font=fonts["body"], marL=0.25, indent=-0.25),
        "body_text": _font_role(fonts["body"], 12, ink, "left", False, line_spacing=1.3),
        "body_text_toc": _font_role(fonts["body"], 20, ink, "left", False, space_after=8),
        "numbered_item": _font_role(fonts["body"], 12, ink, "left", False,
                                    space_after=4, bullet_type="number",
                                    number_type="arabicParenBoth", marL=0.5, indent=-0.3125),
        "table_header": _font_role(fonts["title"], 11, ink, "left", False, fill=pal["header_fill"]),
        "table_data": _font_role(fonts["body"], 11, ink, "left"),
        "closing_title": _font_role(fonts["title"], 36, ink, "center", False, line_spacing=1.0),
        "disclaimer": _font_role(fonts["light"], 8, pal["ink_muted"], "left"),
        "kpi_value": _font_role(fonts["title"], 28, pal["metric"], "left"),
        "kpi_label": _font_role(fonts["body"], 9, pal["ink_muted"], "left"),
        "figure_caption": _font_role(fonts["body"], 9, pal["source_blue"], "center"),
        "table_caption": _font_role(fonts["body"], 9, pal["source_blue"], "center"),
    }

    capabilities = {
        "supported_layouts": ["cover", "content", "main", "summary", "closing"],
        "supported_blocks": {
            "cover": ["title"],
            "content": ["title", "body", "image", "notes", "kpi-table", "figure-caption", "table-caption"],
            "main": ["title", "body", "main-box", "kpi-table", "image", "figure-caption", "table-caption"],
            "summary": ["title", "summary-group", "image", "kpi-table", "figure-caption", "table-caption"],
            "closing": ["title"],
        },
        "supported_body_items": ["bullet", "numbered", "section"],
        "font_roles": fr,
        "constraints": {"max_columns_per_table": 6, "body_text_stays_black": False,
                        "no_bold_on_bold_fonts": False},
    }

    reg = _regions(facts)
    cov, body, clo = reg["cover"], reg["body"], reg["closing"]

    def box(t, role=None, **extra):
        x, y, w, hh = t
        d = {"x": x, "y": y, "w": w}
        if hh is not None:
            d["h"] = hh
        if role:
            d["font_role"] = role
        d.update(extra)
        return d

    content_regions = {
        "title": box(body["title"], "section_title", valign="middle", autofit="none"),
        "body": box(body["body"], "body_text", autofit="resize"),
        "table": {"x": body["body"][0], "y": body["body"][1], "w": body["body"][2],
                  "font_role_header": "table_header", "font_role_data": "table_data"},
        "image": box(body["image"]),
        "figure_caption": box((body["image"][0], round(body["image"][1] + body["image"][3] + 0.1, 3),
                               body["image"][2], 0.42), "figure_caption", align="center"),
    }
    main_regions = dict(content_regions)
    main_regions["main_box"] = {"x": body["title"][0], "y": round(dims["height"] * 0.78, 3),
                                "w": body["body"][2], "h": 0.95, "border": {"width": 1}}
    summary_regions = {
        "title": box(body["title"], "section_title", valign="middle", autofit="shrink"),
        "group_top": {"x": body["title"][0], "y": body["body"][1], "w": round(body["body"][2] * 0.47, 3),
                      "h": 2.5, "heading_role": "section_header", "sub_item_role": "numbered_item",
                      "autofit": "resize"},
        "group_bottom": {"x": body["title"][0], "y": round(body["body"][1] + 2.8, 3),
                         "w": round(body["body"][2] * 0.47, 3), "h": 2.5,
                         "heading_role": "section_header", "sub_item_role": "numbered_item",
                         "autofit": "resize"},
        "image": box(body["image"]),
    }

    mapping = {
        "layouts": {
            "cover": {"layout_source": "none", "decorations": "cover", "regions": {
                "title": box(cov["title"], "cover_title", valign="middle", autofit="none"),
                "metadata": box(cov["metadata"], "cover_metadata", valign="middle", autofit="resize"),
                "date_line": box(cov["date_line"], "cover_date", valign="middle", autofit="none"),
            }},
            "content": {"layout_source": "none", "decorations": "body", "regions": content_regions},
            "main": {"layout_source": "none", "decorations": "body", "regions": main_regions},
            "summary": {"layout_source": "none", "decorations": "body", "regions": summary_regions},
            "closing": {"layout_source": "none", "decorations": "closing", "regions": {
                "title": box(clo["title"], "closing_title", align="center", valign="middle", autofit="shrink"),
            }},
        },
        "decorations": {"cover": {"elements": []}, "body": {"elements": []}, "closing": {"elements": []}},
    }
    return template, capabilities, mapping


def closed_set_verify(facts, template, capabilities):
    """Assert generated fonts/colors only reference what the source contains."""
    problems = []
    source_fonts = set(facts["used_fonts"])
    for m in (facts["fonts"].get("major") or {}).values():
        source_fonts.add(m)
    for m in (facts["fonts"].get("minor") or {}).values():
        source_fonts.add(m)
    # allow the generic fallback only when the source had no fonts at all
    fallback_ok = not facts["used_fonts"]
    for role, d in capabilities["font_roles"].items():
        f = d["font"]
        if f not in source_fonts and not (fallback_ok and f in ("Arial",)):
            problems.append(f"font '{f}' (role {role}) not in source font set")
    source_colors = {v.upper() for v in facts["palette"].values()}
    # palette is derived from source theme; flag any non-source, non-neutral hex
    neutral = {"#000000", "#FFFFFF", "#444444", "#CCCCCC", "#EEEEEE"}
    for k, v in template["palette"].items():
        if v.upper() not in source_colors and v.upper() not in neutral:
            problems.append(f"palette '{k}'={v} not in source theme colors")
    return problems


def main():
    ap = argparse.ArgumentParser(description="Learn an enrolled template from a source .pptx")
    ap.add_argument("source")
    ap.add_argument("--name", required=True)
    ap.add_argument("--out", default=".lit-pptx/templates")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    src = Path(args.source)
    try:
        zf = _safe_open_zip(src)
    except LearnError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(2)

    facts = extract(zf)
    template, capabilities, mapping = build_template(facts, args.name)

    problems = closed_set_verify(facts, template, capabilities)
    if problems:
        print("CLOSED-SET VERIFICATION FAILED:", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        sys.exit(3)

    out_dir = Path(args.out) / args.name
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "template.yaml").write_text(_yaml(template) + "\n", encoding="utf-8")
    (out_dir / "capabilities.yaml").write_text(_yaml(capabilities) + "\n", encoding="utf-8")
    (out_dir / "layout-mapping.yaml").write_text(_yaml(mapping) + "\n", encoding="utf-8")

    if not args.quiet:
        d = facts["dimensions"]
        print(f"Learned template '{args.name}' -> {out_dir}")
        print(f"  dimensions: {d.get('width')}x{d.get('height')} {d.get('unit')} ({d.get('format')})")
        print(f"  fonts: title={template['fonts']['title']!r} body={template['fonts']['body']!r}")
        print(f"  palette: ink={template['palette']['ink']} paper={template['palette']['paper']} "
              f"accent_red={template['palette']['accent_red']}")
        print(f"  source fonts used: {sorted(facts['used_fonts']) or '(none)'}")
        print(f"  assets in source: {len(facts['assets'])}")
        print("  closed-set verification: PASS")


if __name__ == "__main__":
    main()
