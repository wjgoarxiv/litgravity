"""Font preflight for the publisher PDF path (standard library only).

XeLaTeX fails deep inside fontspec with ``The font "Pretendard" cannot be found`` after pandoc has already run. This
module asks the machine which font families it has before that, and stops with a BLOCKED message that names each
missing family and how to install it. When the font list cannot be read (no ``fc-list``, no ``reg``), nothing is
blocked: XeLaTeX stays the judge. ``LITGRAVITY_SKIP_FONT_PREFLIGHT=1`` skips the check.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys

_AUTO = object()

_HINTS = {
    "pretendard": "install the Pretendard family (OFL) from https://github.com/orioncactus/pretendard/releases",
}

_REGISTRY_KEYS = (
    r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts",
    r"HKCU\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts",
)


def parse_registry_fonts(text: str) -> list[str]:
    """Font names from ``reg query`` output: ``    Times New Roman (TrueType)    REG_SZ    times.ttf``."""
    names = []
    for line in text.splitlines():
        match = re.match(r"^\s+(.+?)\s+REG_(?:SZ|EXPAND_SZ)\s", line)
        if match:
            names.append(re.sub(r"\s*\((?:TrueType|OpenType|Type 1)\)\s*$", "", match.group(1)))
    return names


def _run(command: list[str]) -> str | None:
    try:
        result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60, check=False)
    except (OSError, subprocess.SubprocessError):
        return None
    return result.stdout if result.returncode == 0 else None


def installed_fonts(platform: str | None = None) -> list[str] | None:
    """Font family names on this machine, or None when they cannot be listed."""
    if (platform or sys.platform) == "win32":
        names: list[str] = []
        seen = False
        for key in _REGISTRY_KEYS:
            out = _run(["reg", "query", key])
            if out is not None:
                seen = True
                names.extend(parse_registry_fonts(out))
        return names if seen else None
    out = _run(["fc-list", ":", "family"])
    if out is None:
        return None
    return [name.strip() for line in out.splitlines() for name in line.split(",") if name.strip()]


def font_available(family: str, fonts: list[str]) -> bool:
    wanted = family.strip().lower()
    return any(name.lower() == wanted or name.lower().startswith(wanted + " ") for name in fonts)


def require_fonts(families: list[str], fonts: object = _AUTO) -> None:
    """Stop with a BLOCKED message naming every family in ``families`` that the machine lacks."""
    if os.environ.get("LITGRAVITY_SKIP_FONT_PREFLIGHT") == "1":
        return
    available = installed_fonts() if fonts is _AUTO else fonts
    if available is None:
        return
    missing = [family for family in dict.fromkeys(families) if family and not font_available(family, available)]
    if not missing:
        return
    lines = ["BLOCKED: the PDF template needs fonts that are not installed, and XeLaTeX would stop on the first one."]
    for family in missing:
        hint = _HINTS.get(family.lower(), f'install the "{family}" font for this system')
        lines.append(f'  - missing font "{family}": {hint}')
    lines.append("Install them and rerun, or set LITGRAVITY_SKIP_FONT_PREFLIGHT=1 if XeLaTeX can reach the font another way.")
    raise SystemExit("\n".join(lines))
