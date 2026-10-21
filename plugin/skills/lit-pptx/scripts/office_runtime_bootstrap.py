"""Run a lit-pptx or lit-docx helper inside the LitGravity office runtime.

The helpers are invoked as ``python3 <installed skill>/scripts/<helper>.py``.
Host Python usually lacks python-pptx, python-docx and the rest, so each helper
calls ``ensure_runtime()`` before its third-party imports. The runtime is
ensured through ``office-runtime.mjs python`` (first use installs the pinned
lockfile into a LitGravity-owned virtual environment) and the helper re-executes
itself under that interpreter with the same arguments.
"""

from __future__ import annotations

import importlib.util
import os
import subprocess
import sys

_REEXEC_MARK = "LITGRAVITY_OFFICE_REEXEC"
_RUNTIME = os.path.join(os.path.dirname(os.path.abspath(__file__)), "office-runtime.mjs")


def _missing(modules: list[str]) -> list[str]:
    return [name for name in modules if importlib.util.find_spec(name) is None]


def reexec(interpreter: str, script: str, argv: list[str], env: dict, platform: str | None = None) -> int:
    """Run ``script`` under ``interpreter``; POSIX replaces this process, Windows waits and returns the exit code.

    ``os.execve`` does not replace the process on Windows: the parent exits 0 at once while the child is still running,
    so a caller would read success before the output exists. There the child runs to the end and its exit code comes back.
    """
    if (platform or sys.platform) == "win32":
        return subprocess.call([interpreter, script, *argv], env=env)
    os.execve(interpreter, [interpreter, script, *argv], env)
    return 0  # not reached; execve only returns by raising


def ensure_runtime(modules: list[str]) -> None:
    """Re-execute under the pinned runtime interpreter unless already inside it.

    Host packages are not trusted to match the pinned versions, so the runtime is
    used even when the imports would succeed on the host. The host is a fallback
    only when the runtime cannot be prepared (offline, no node) and the host
    already has every module; that is said on stderr.
    """
    if os.environ.get(_REEXEC_MARK) == "1":
        missing = _missing(modules)
        if missing:
            raise SystemExit(
                "BLOCKED: the LitGravity office runtime is active but still lacks "
                + ", ".join(missing)
                + ". Run `node " + _RUNTIME + " status` and reinstall LitGravity if a pinned package is missing."
            )
        return
    node = os.environ.get("LITGRAVITY_NODE", "node")
    try:
        result = subprocess.run([node, _RUNTIME, "python"], stdout=subprocess.PIPE, stderr=None, text=True, encoding="utf-8", check=False)
        interpreter = result.stdout.strip() if result.returncode == 0 else ""
    except FileNotFoundError:
        interpreter = ""
    if not interpreter:
        missing = _missing(modules)
        if not missing:
            print("LitGravity office runtime unavailable; continuing with the host Python packages.", file=sys.stderr)
            return
        raise SystemExit(
            "BLOCKED: the LitGravity office runtime could not be prepared and the host Python lacks "
            + ", ".join(missing)
            + " (see the message above)."
        )
    env = dict(os.environ, **{_REEXEC_MARK: "1", "PYTHONDONTWRITEBYTECODE": "1"})
    script = os.path.abspath(sys.argv[0])
    sys.exit(reexec(interpreter, script, sys.argv[1:], env))
