#!/usr/bin/env python3
"""embed_fonts.py — embed bundled fonts into a .pptx so it renders on machines
that do not have the fonts installed (self-contained deck).

python-pptx has no font-embedding API, so this post-processes the OOXML package
directly: it adds /ppt/fonts/*.fntdata parts, a fntdata content-type default,
presentation relationships, and a <p:embeddedFontLst> in ppt/presentation.xml.

Only families with a bundled OTF (fonts/pretendard, fonts/a2z) are embedded; unknown families (fonts a learned
template names but this skill does not bundle) are warned
about and skipped — never corrupting the file.

Usage:
    python3 scripts/embed_fonts.py <in.pptx> [<out.pptx>]   # in-place if out omitted
"""
import os as _os
import sys as _sys

_sys.dont_write_bytecode = True  # the installed skill directory stays read-only
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from office_runtime_bootstrap import ensure_runtime  # noqa: E402

ensure_runtime(["pptx"])

import os
import re
import sys
import shutil
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FONT_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font"

# A2Z english weight word -> bundled file
A2Z_WEIGHTS = {
    "Thin", "ExtraLight", "Light", "Regular", "Medium",
    "SemiBold", "Bold", "ExtraBold", "Black",
}


def _pretendard(weight):
    p = os.path.join(ROOT, "fonts", "pretendard", f"Pretendard-{weight}.otf")
    return p if os.path.exists(p) else None


def _a2z(weight):
    p = os.path.join(ROOT, "fonts", "a2z", f"A2Z-{weight}.otf")
    return p if os.path.exists(p) else None


def resolve_family(typeface):
    """Return {slot: otf_path} for a typeface, or {} if no bundled file.

    slot is one of regular/bold/italic/boldItalic (we only use regular/bold).
    """
    tf = typeface.strip()
    if tf == "Pretendard":
        slots = {}
        if _pretendard("Regular"):
            slots["regular"] = _pretendard("Regular")
        if _pretendard("Bold"):
            slots["bold"] = _pretendard("Bold")
        return slots
    # Per-weight families: "에이투지체 7 Bold", "에이투지체 4 Regular", ...
    last = tf.split()[-1] if tf.split() else ""
    if ("에이투지체" in tf or tf.startswith("A2Z")) and last in A2Z_WEIGHTS:
        f = _a2z(last)
        return {"regular": f} if f else {}
    return {}


def scan_typefaces(z):
    faces = set()
    for n in z.namelist():
        if n.startswith("ppt/slides/slide") and n.endswith(".xml"):
            xml = z.read(n).decode("utf-8", "ignore")
            faces.update(re.findall(r'typeface="([^"]+)"', xml))
    return faces


def embed(in_path, out_path=None):
    out_path = out_path or in_path
    with zipfile.ZipFile(in_path) as z:
        names = z.namelist()
        data = {n: z.read(n) for n in names}
        faces = scan_typefaces(z)

    # Build embed plan: family -> {slot: otf_path}
    plan = {}
    skipped = []
    for tf in sorted(faces):
        slots = resolve_family(tf)
        if slots:
            plan[tf] = slots
        else:
            skipped.append(tf)

    if not plan:
        print(f"[embed_fonts] no bundled fonts matched typefaces: {sorted(faces)}")
        if in_path != out_path:
            shutil.copyfile(in_path, out_path)
        return {"embedded": [], "skipped": skipped}

    # Assign part names + relationship ids.
    rels_xml = data["ppt/_rels/presentation.xml.rels"].decode("utf-8")
    existing_ids = [int(m) for m in re.findall(r'Id="rId(\d+)"', rels_xml)]
    next_id = (max(existing_ids) + 1) if existing_ids else 1

    font_parts = []   # (part_name, bytes)
    new_rels = []     # (rId, target)
    embedded_lst = []  # xml fragments
    part_idx = 1
    embedded_report = []

    for tf, slots in plan.items():
        slot_xml = []
        for slot in ("regular", "bold", "italic", "boldItalic"):
            if slot not in slots:
                continue
            part_name = f"ppt/fonts/font{part_idx}.fntdata"
            part_idx += 1
            with open(slots[slot], "rb") as fh:
                font_parts.append((part_name, fh.read()))
            rid = f"rId{next_id}"
            next_id += 1
            new_rels.append((rid, "fonts/" + os.path.basename(part_name)))
            slot_xml.append(f'<p:{slot} r:id="{rid}"/>')
            embedded_report.append(f"{tf} [{slot}] <- {os.path.basename(slots[slot])}")
        embedded_lst.append(
            f'<p:embeddedFont><p:font typeface="{tf}"/>' + "".join(slot_xml) + "</p:embeddedFont>"
        )

    # 1) [Content_Types].xml — add fntdata default
    ct = data["[Content_Types].xml"].decode("utf-8")
    if 'Extension="fntdata"' not in ct:
        ct = ct.replace(
            "</Types>",
            '<Default Extension="fntdata" ContentType="application/x-fontdata"/></Types>',
        )
    data["[Content_Types].xml"] = ct.encode("utf-8")

    # 2) presentation rels — add font relationships
    rel_frag = "".join(
        f'<Relationship Id="{rid}" Type="{FONT_REL_TYPE}" Target="{tgt}"/>'
        for rid, tgt in new_rels
    )
    rels_xml = rels_xml.replace("</Relationships>", rel_frag + "</Relationships>")
    data["ppt/_rels/presentation.xml.rels"] = rels_xml.encode("utf-8")

    # 3) presentation.xml — flags + <p:embeddedFontLst>
    pres = data["ppt/presentation.xml"].decode("utf-8")
    # embedTrueTypeFonts + saveSubsetFonts on the root element
    def _set_attr(xml, attr, value):
        if re.search(rf'\b{attr}="[^"]*"', xml):
            return re.sub(rf'\b{attr}="[^"]*"', f'{attr}="{value}"', xml, count=1)
        # insert into the <p:presentation ...> opening tag
        return re.sub(r"(<p:presentation\b)", rf'\1 {attr}="{value}"', xml, count=1)

    pres = _set_attr(pres, "embedTrueTypeFonts", "1")
    pres = _set_attr(pres, "saveSubsetFonts", "0")
    lst = "<p:embeddedFontLst>" + "".join(embedded_lst) + "</p:embeddedFontLst>"
    # embeddedFontLst must precede custShowLst/defaultTextStyle (schema order).
    if "<p:defaultTextStyle" in pres:
        pres = pres.replace("<p:defaultTextStyle", lst + "<p:defaultTextStyle", 1)
    else:
        pres = pres.replace("</p:presentation>", lst + "</p:presentation>", 1)
    data["ppt/presentation.xml"] = pres.encode("utf-8")

    # 4) write the new package (font parts last)
    tmp_out = out_path + ".tmp"
    with zipfile.ZipFile(tmp_out, "w", zipfile.ZIP_DEFLATED) as zout:
        for n, b in data.items():
            zout.writestr(n, b)
        for part_name, b in font_parts:
            zout.writestr(part_name, b)
    os.replace(tmp_out, out_path)

    if skipped:
        print(f"[embed_fonts] WARNING — no bundled font, skipped: {skipped}")
    print("[embed_fonts] embedded:")
    for line in embedded_report:
        print("  " + line)

    _verify(out_path)
    return {"embedded": embedded_report, "skipped": skipped}


def _verify(pptx_path):
    """Integrity gate: the package check in scripts/ooxml_integrity.py
    (zip, content types, well-formed XML, relationship targets, embedded font
    parts) plus a python-pptx reopen."""
    from pathlib import Path
    from ooxml_integrity import check_package

    report = check_package(Path(pptx_path))
    if not report["pass"]:
        raise RuntimeError(
            "OOXML integrity failed after embedding:\n  " + "\n  ".join(report["problems"])
        )
    print("[embed_fonts] integrity OK (package structure + python-pptx reopen)")


def main(argv):
    if not argv:
        print(__doc__)
        return 1
    in_path = argv[0]
    out_path = argv[1] if len(argv) > 1 else None
    embed(in_path, out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
