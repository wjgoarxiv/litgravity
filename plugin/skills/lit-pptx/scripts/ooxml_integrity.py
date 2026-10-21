#!/usr/bin/env python3
"""OOXML package integrity check for .pptx and .docx files.

Written for LitGravity's lit-pptx and lit-docx. It answers one question: will
the file open? It does not validate against the ECMA schemas. It checks the
package the way a reader meets it:

  zip        the archive opens, every member passes its CRC, no duplicate or
             escaping member names (absolute paths, "..")
  types      [Content_Types].xml parses and every part has a content type,
             by Override or by extension Default
  xml        every .xml and .rels part is well-formed
  values     no attribute carries a writer's placeholder number (NaN, Infinity,
             undefined), which PowerPoint and Word reject as corrupt
  rels       every internal relationship target exists in the package
  fonts      (pptx) every embedded font entry points at a font part
  reopen     python-pptx or python-docx opens the file

Usage:
    python3 ooxml_integrity.py <file.pptx|file.docx> [--json]

Exit 0 when every check passes, 1 otherwise.
"""

from __future__ import annotations

import json
import posixpath
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

CT_NS = "{http://schemas.openxmlformats.org/package/2006/content-types}"
REL_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"
P_NS = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
R_ID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def _rels_source_dir(rels_name: str) -> str:
    # "ppt/slides/_rels/slide1.xml.rels" describes "ppt/slides/slide1.xml",
    # whose relative targets resolve against "ppt/slides".
    folder = posixpath.dirname(posixpath.dirname(rels_name))
    return folder


def _resolve(base_dir: str, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join(base_dir, target)) if base_dir else posixpath.normpath(target)


def check_package(path: Path) -> dict:
    problems: list[str] = []
    warnings: list[str] = []
    checks: dict[str, bool] = {}

    try:
        archive = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError) as error:
        return {"file": str(path), "pass": False, "checks": {"zip": False}, "problems": [f"zip: {error}"], "warnings": []}

    with archive:
        names = archive.namelist()
        bad_member = archive.testzip()
        duplicates = sorted({n for n in names if names.count(n) > 1})
        escaping = [n for n in names if n.startswith("/") or ".." in n.split("/")]
        checks["zip"] = bad_member is None and not duplicates and not escaping
        if bad_member:
            problems.append(f"zip: CRC failure in {bad_member}")
        problems += [f"zip: duplicate member {n}" for n in duplicates]
        problems += [f"zip: member escapes the package root: {n}" for n in escaping]

        members = set(names)
        parts = {n for n in names if not n.endswith("/")}

        well_formed = True
        trees: dict[str, ET.Element] = {}
        for name in sorted(parts):
            if name.endswith(".xml") or name.endswith(".rels"):
                try:
                    trees[name] = ET.fromstring(archive.read(name))
                except ET.ParseError as error:
                    well_formed = False
                    problems.append(f"xml: {name} is not well-formed ({error})")
        checks["xml"] = well_formed

        bad_values = []
        for name, tree in trees.items():
            for element in tree.iter():
                for attr, value in element.attrib.items():
                    if value in ("NaN", "-NaN", "Infinity", "-Infinity", "undefined", "null"):
                        bad_values.append(f"values: {name} <{element.tag.split('}')[-1]} {attr.split('}')[-1]}=\"{value}\">")
        checks["values"] = not bad_values
        problems += sorted(set(bad_values))[:20]

        types_ok = "[Content_Types].xml" in trees
        if not types_ok:
            problems.append("types: [Content_Types].xml is missing or unreadable")
        else:
            root = trees["[Content_Types].xml"]
            defaults = {d.get("Extension", "").lower() for d in root.iter(f"{CT_NS}Default")}
            overrides = {o.get("PartName", "").lstrip("/") for o in root.iter(f"{CT_NS}Override")}
            for name in sorted(parts - {"[Content_Types].xml"}):
                ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
                if name not in overrides and ext not in defaults:
                    types_ok = False
                    problems.append(f"types: no content type for {name}")
            # An Override for an absent part is inert: readers resolve parts through
            # relationships, and pptxgenjs writes such entries in every deck it saves.
            # It is reported, never failed.
            for override in sorted(overrides):
                if override not in members:
                    warnings.append(f"types: override names an absent part {override}")
        checks["types"] = types_ok

        rels_ok = True
        rel_targets: dict[str, dict[str, str]] = {}
        for name, tree in trees.items():
            if not name.endswith(".rels"):
                continue
            base = _rels_source_dir(name)
            source = posixpath.join(base, posixpath.basename(name)[: -len(".rels")]) if base else posixpath.basename(name)[: -len(".rels")]
            targets: dict[str, str] = {}
            for rel in tree.iter(f"{REL_NS}Relationship"):
                if rel.get("TargetMode") == "External":
                    continue
                resolved = _resolve(base, rel.get("Target", ""))
                targets[rel.get("Id", "")] = resolved
                if resolved not in members:
                    rels_ok = False
                    problems.append(f"rels: {name} {rel.get('Id')} points at missing {resolved}")
            rel_targets[source] = targets
        checks["rels"] = rels_ok

        if path.suffix.lower() == ".pptx" and "ppt/presentation.xml" in trees:
            fonts_ok = True
            pres_rels = rel_targets.get("ppt/presentation.xml", {})
            for font in trees["ppt/presentation.xml"].iter(f"{P_NS}embeddedFont"):
                for slot in font:
                    rid = slot.get(R_ID)
                    if rid is None:
                        continue
                    target = pres_rels.get(rid)
                    if target is None or target not in members:
                        fonts_ok = False
                        problems.append(f"fonts: embedded font slot {rid} has no font part")
            checks["fonts"] = fonts_ok

    checks["reopen"] = _reopen(path, problems)
    return {"file": str(path), "pass": all(checks.values()), "checks": checks, "problems": problems, "warnings": warnings}


def _reopen(path: Path, problems: list[str]) -> bool:
    suffix = path.suffix.lower()
    try:
        if suffix == ".pptx":
            from pptx import Presentation

            Presentation(str(path))
        elif suffix == ".docx":
            from docx import Document

            Document(str(path))
        else:
            problems.append(f"reopen: unsupported suffix {suffix}")
            return False
    except ImportError as error:
        problems.append(f"reopen: reader library unavailable ({error})")
        return False
    except Exception as error:  # a reader rejecting the file is the finding itself
        problems.append(f"reopen: {type(error).__name__}: {error}")
        return False
    return True


def main(argv: list[str]) -> int:
    if not argv or argv[0] in {"-h", "--help"}:
        print(__doc__)
        return 2
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from office_runtime_bootstrap import ensure_runtime

    ensure_runtime(["pptx", "docx"])
    report = check_package(Path(argv[0]))
    if "--json" in argv:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(("PASS" if report["pass"] else "FAIL") + f"  OOXML integrity: {report['file']}")
        for problem in report["problems"]:
            print(f"  - {problem}")
        for warning in report["warnings"]:
            print(f"  ~ {warning}")
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
