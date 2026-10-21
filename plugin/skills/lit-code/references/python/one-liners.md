# One-Liner Scripts (PEP 723 and uv)

Self-contained Python scripts that declare their own dependencies and run with no environment setup. PEP 723 metadata plus `uv` removes the historical reason to write small tools in Bash or Go.

Every `.py` script, throwaway ones included, carries PEP 723 inline metadata and the usage comment block. No venv, no `requirements.txt`, no `setup.py`: the script is its own environment specification.

## Two patterns

### Pattern 1: inline `uv run`

```bash
uv run --with httpx2 --with rich python -c "
import httpx2
from rich import print
print(httpx2.get('https://api.github.com').json())
"
```

This fits a terminal one-shot that will not be saved. `--with PKG` repeats for more packages, and `--python 3.13` selects the interpreter. As soon as the snippet is worth keeping, move it into a file with Pattern 2.

### Pattern 2: PEP 723 script with a shebang (the standard)

A regular `.py` file with metadata in a comment block. `uv` reads the block, builds a cached disposable environment and runs the script.

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "httpx2[http2,brotli,zstd]",
#     "rich",
# ]
# ///

# ─── How to run ───
# 1. Install uv (if not installed):
#      curl -LsSf https://astral.sh/uv/install.sh | sh
# 2. Run directly (no venv, no pip install needed):
#      uv run my_script.py
# 3. Or make executable and run:
#      chmod +x my_script.py && ./my_script.py
# ──────────────────

from __future__ import annotations

import httpx2
from rich import print as rprint


def main() -> None:
    with httpx2.Client(http2=True, follow_redirects=True) as client:
        response = client.get("https://api.github.com")
        response.raise_for_status()
        rprint(response.json())


if __name__ == "__main__":
    main()
```

### Required elements, in order

1. **Shebang** `#!/usr/bin/env -S uv run --script`.
2. **PEP 723 block**: `# /// script` through `# ///`, with `requires-python` and `dependencies`.
3. **Usage comment block** explaining how to install uv and how to run the script.
4. **`from __future__ import annotations`** as the first import.
5. **`if __name__ == "__main__": main()`** as the entry guard.

### The usage block

```python
# ─── How to run ───
# 1. Install uv (if not installed):
#      curl -LsSf https://astral.sh/uv/install.sh | sh
# 2. Run directly (no venv, no pip install needed):
#      uv run <SCRIPT_NAME>.py [ARGS]
# 3. Or make executable and run:
#      chmod +x <SCRIPT_NAME>.py && ./<SCRIPT_NAME>.py
# ──────────────────
```

Replace `<SCRIPT_NAME>` with the real filename, describe arguments when the script takes any, and place the block right after the closing `# ///` line, before the imports. A colleague, a CI job or the author six months later should be able to run the script without opening any other document, because the comment block is the documentation.

## Scaffolding

`scripts/python/new-script.py` in this skill folder writes a script with all of the boilerplate filled in:

```bash
# to a temp directory (the default)
uv run "<skill-folder>/scripts/python/new-script.py" my_tool

# to a chosen path
uv run "<skill-folder>/scripts/python/new-script.py" my_tool --output ./scripts/my_tool.py

# with extra dependencies (repeat --deps once per package)
uv run "<skill-folder>/scripts/python/new-script.py" my_tool --deps polars --deps duckdb --deps rich
```

## Managing script metadata with uv

```bash
uv init --script my_tool.py --python 3.13   # create a script with an empty metadata block
uv add --script my_tool.py httpx2 rich       # add dependencies to the block
uv lock --script my_tool.py                  # write my_tool.py.lock next to the script
uv run --script my_tool.py                   # run
```

A lockfile beside the script pins transitive versions for scripts that outlive the day they were written. Add `exclude-newer = "2026-01-01T00:00:00Z"` under `[tool.uv]` in the metadata block when reproducibility matters more than freshness.

## Common dependency sets

| Use case | Dependencies line |
|---|---|
| API client | `"httpx2[http2,brotli,zstd]"` |
| Data processing | `"polars"`, `"duckdb"` |
| CLI tool | `"typer"`, `"rich"` |
| Web scraping | `"httpx2[http2,brotli,zstd]"`, `"selectolax"` |
| File watcher | `"watchfiles"` |
| Pretty JSON | `"rich"` |
| AI and LLM | `"pydantic-ai"`, `"httpx2[http2,brotli,zstd]"` |
| Time series and plotting | `"polars"`, `"matplotlib"` |

## Examples

### Fetch and print JSON

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "httpx2[http2,brotli,zstd]",
#     "rich",
# ]
# ///

# ─── How to run ───
# 1. Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh
# 2. Run: uv run fetch_json.py https://api.github.com/repos/pydantic/httpx2
# ──────────────────

from __future__ import annotations

import sys

import httpx2
from rich import print as rprint


def main() -> None:
    url = sys.argv[1] if len(sys.argv) > 1 else "https://api.github.com"
    with httpx2.Client(http2=True, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        rprint(response.json())


if __name__ == "__main__":
    main()
```

### CSV to Parquet

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "polars",
#     "typer",
#     "rich",
# ]
# ///

# ─── How to run ───
# 1. Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh
# 2. Run: uv run csv2parquet.py input.csv output.parquet
# ──────────────────

from __future__ import annotations

from pathlib import Path

import polars as pl
import typer
from rich import print as rprint


def main(input_path: Path, output_path: Path | None = None) -> None:
    """Convert a CSV file to Parquet."""
    out = output_path or input_path.with_suffix(".parquet")
    df = pl.read_csv(input_path)
    df.write_parquet(out)
    rprint(f"[green]done[/green] {input_path} -> {out} ({len(df)} rows)")


if __name__ == "__main__":
    typer.run(main)
```

### Quick latency benchmark

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "httpx2[http2,brotli,zstd]",
#     "rich",
#     "anyio",
# ]
# ///

# ─── How to run ───
# 1. Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh
# 2. Run: uv run bench.py https://api.example.com/health 50
# ──────────────────

from __future__ import annotations

import socket
import sys
import time

import anyio
import httpx2
from rich import print as rprint


async def main() -> None:
    url = sys.argv[1] if len(sys.argv) > 1 else "https://api.github.com"
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 20

    limits = httpx2.Limits(max_connections=200, max_keepalive_connections=40, keepalive_expiry=30.0)
    timeout = httpx2.Timeout(connect=5.0, read=30.0, write=10.0, pool=10.0)
    transport = httpx2.AsyncHTTPTransport(
        http2=True,
        retries=3,
        limits=limits,
        socket_options=[(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)],
    )

    async with httpx2.AsyncClient(transport=transport, timeout=timeout, follow_redirects=True) as client:
        for _ in range(3):   # warm-up
            await client.get(url)

        start = time.perf_counter()
        for _ in range(n):
            response = await client.get(url)
            response.raise_for_status()
        elapsed = time.perf_counter() - start

    avg_ms = elapsed / n * 1000
    rprint(f"[bold]{url}[/bold]: {avg_ms:.1f} ms average over {n} requests ({elapsed:.2f} s, {response.http_version})")


if __name__ == "__main__":
    anyio.run(main)
```

## Hard rules for scripts

A 40-line script follows the same rules as a service:

1. Type annotations everywhere; run `uv run --with basedpyright basedpyright my_tool.py` for scripts that outlive the day.
2. Argument parsing through `typer` (or `sys.argv` for one positional argument), never ad hoc string splitting.
3. Network calls go through the `httpx2` factory settings; file paths use `pathlib`.
4. Secrets arrive via environment variables (`os.environ["API_KEY"]` inside `main`), and the usage block names them.
5. Destructive scripts (delete, overwrite, migrate) default to a dry run and require `--apply`.
6. Exit with a non-zero code on failure (`raise SystemExit(1)` or `raise typer.Exit(1)`) and print errors to stderr.
7. At 250 pure lines, promote the script to a package with a `pyproject.toml` (`new-project.py`).

## Antipatterns

| Pattern | Replacement |
|---|---|
| `pip install httpx2 && python script.py` | `uv run script.py` |
| `requirements.txt` beside a script | PEP 723 inline metadata |
| `python -m venv .venv && ...` | `uv run --script` creates the environment |
| script without a usage comment | always include the "How to run" block |
| `import asyncio; asyncio.run(main())` | `import anyio; anyio.run(main)` |
| bare `httpx2.AsyncClient()` | full production defaults (`httpx2-optimization.md`) |
| `except Exception: pass` around a whole `main` | catch specific exceptions; let others show a traceback |
| hard-coded tokens | environment variables |

## Sources

- PEP 723, inline script metadata: <https://peps.python.org/pep-0723/>
- uv scripts guide: <https://docs.astral.sh/uv/guides/scripts/>
- Simon Willison on one-shot Python tools: <https://simonwillison.net/2024/Dec/19/one-shot-python-tools/>
