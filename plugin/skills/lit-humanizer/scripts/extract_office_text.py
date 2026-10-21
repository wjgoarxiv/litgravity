#!/usr/bin/env python3
"""Extract visible paragraph text from a DOCX or PPTX package for the lit-humanizer detector.

Python 3.11 or newer, standard library only (zipfile + ElementTree). Reads a regular file path or, with
``--stdin .docx|.pptx``, the package bytes from stdin. Exit 0 with text on stdout, 2 on usage or a
package it cannot read. Symbolic links are refused. XML size is bounded per member and per package.
"""

from __future__ import annotations

import re
import sys
import zipfile
from io import BytesIO
from pathlib import Path
from xml.etree.ElementTree import Element, ParseError, fromstring

WORD_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
DRAWING_NS = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
MAX_XML_BYTES = 32 * 1024 * 1024
MAX_PACKAGE_XML_BYTES = 128 * 1024 * 1024


def paragraph_text(element: Element, text_tag: str, tab_tag: str, break_tag: str) -> str:
    """Return visible text for one Word or DrawingML paragraph."""
    pieces: list[str] = []
    for node in element.iter():
        if node.tag == text_tag and node.text:
            pieces.append(node.text)
        elif node.tag == tab_tag:
            pieces.append("\t")
        elif node.tag == break_tag:
            pieces.append(" ")
    return "".join(pieces).strip()


def xml_text(archive: zipfile.ZipFile, member: str, namespace: str) -> list[str]:
    """Read bounded XML and collect paragraph text in document order."""
    info = archive.getinfo(member)
    if info.file_size > MAX_XML_BYTES:
        raise ValueError(f"refusing oversized Office XML member: {member}")
    root = fromstring(archive.read(member))
    return [
        value
        for paragraph in root.iter(f"{namespace}p")
        if (value := paragraph_text(paragraph, f"{namespace}t", f"{namespace}tab", f"{namespace}br"))
    ]


def extract_archive(archive: zipfile.ZipFile, suffix: str) -> list[str]:
    """Extract paragraph text from a DOCX or PPTX package using stdlib ZIP/XML."""
    with archive:
        members = archive.namelist()
        total_xml = sum(info.file_size for info in archive.infolist() if info.filename.endswith(".xml"))
        if total_xml > MAX_PACKAGE_XML_BYTES:
            raise ValueError("refusing Office package with oversized aggregate XML")
        if suffix.lower() == ".docx":
            return xml_text(archive, "word/document.xml", WORD_NS)
        if suffix.lower() == ".pptx":
            slide_names = [name for name in members if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)]
            slide_names.sort(key=lambda name: int(re.search(r"slide(\d+)", name).group(1)))
            return [line for name in slide_names for line in xml_text(archive, name, DRAWING_NS)]
    raise ValueError("expected a .docx or .pptx file")


def extract_document(path: Path) -> list[str]:
    if path.is_symlink():
        raise ValueError("refusing a symbolic link")
    if not path.is_file():
        raise ValueError("not a regular file")
    return extract_archive(zipfile.ZipFile(path), path.suffix)


def extract_document_bytes(data: bytes, suffix: str) -> list[str]:
    return extract_archive(zipfile.ZipFile(BytesIO(data)), suffix)


def main() -> int:
    stdin_mode = len(sys.argv) == 3 and sys.argv[1] == "--stdin"
    if stdin_mode:
        suffix = sys.argv[2].lower()
        if suffix not in {".docx", ".pptx"}:
            print("Expected .docx or .pptx", file=sys.stderr)
            return 2
    elif len(sys.argv) == 2:
        path = Path(sys.argv[1])
        suffix = path.suffix
    else:
        print("Usage: python3 extract_office_text.py FILE.docx|FILE.pptx", file=sys.stderr)
        return 2
    try:
        if stdin_mode:
            data = sys.stdin.buffer.read(MAX_PACKAGE_XML_BYTES + 1)
            if len(data) > MAX_PACKAGE_XML_BYTES:
                raise ValueError("refusing oversized Office package")
            text = extract_document_bytes(data, suffix)
        else:
            text = extract_document(path)
    except (OSError, zipfile.BadZipFile, KeyError, ParseError, ValueError) as error:
        print(f"Office text extraction failed: {error}", file=sys.stderr)
        return 2
    sys.stdout.write("\n".join(text))
    if text:
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
