# Python: language-server and checker setup

- **Server id:** `basedpyright`, launched as `basedpyright-langserver --stdio`
- **Extensions:** `.py .pyi`
- **Checkers agy can drive:** `pyright` or `basedpyright` (`--outputjson`), `ruff check`, `mypy`, and a stdlib syntax check
- **Normalised by `lsp/scripts/diagnostics.mjs`:** yes, all four; the stdlib parse is labelled syntax-only
- **Evidence command when nothing is normalised:** `python3 -m pytest -q`

## What this gives you in agy

Python gets type diagnostics from pyright or basedpyright and lint findings from ruff, all through the normaliser. Python has no one-shot go-to-definition command line, so identity questions end in labelled textual search plus reading the import chain.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- Python 3.9 or newer on PATH (`python3 --version`)
- `uv`, `pipx` or `pip` to install tools (`uv` is the lightest: macOS `brew install uv`, Windows `winget install astral-sh.uv`, Linux `curl -LsSf https://astral.sh/uv/install.sh | sh`)

## Install (the user runs these)

**macOS**

- `uv tool install basedpyright` (isolated, binary in `~/.local/bin`) or `brew install basedpyright`
- upstream checker instead: `npm install -g pyright` or `pip install pyright` (a wrapper that downloads the npm package)
- linter next to it: `uv tool install ruff` or `brew install ruff`

**Linux**

- `uv tool install basedpyright` or `pipx install basedpyright`
- upstream checker instead: `npm install -g pyright`
- linter next to it: `uv tool install ruff` or `pipx install ruff`

**Windows**

- `uv tool install basedpyright` (binary in `%USERPROFILE%\.local\bin`) or `pip install basedpyright`
- upstream checker instead: `npm install -g pyright`
- linter next to it: `uv tool install ruff` or `pip install ruff`

A project that pins its tools should list them in the dev dependencies (`uv add --dev basedpyright ruff`, then `uv run basedpyright`); the normaliser finds a project-local `.venv/bin` before PATH.

Confirm afterwards:

```sh
command -v basedpyright-langserver basedpyright pyright ruff; basedpyright --version
```

Type checkers and the linter serve different roles. Run a type checker and, when the project uses it, ruff alongside rather than instead.

## Project configuration

- `pyrightconfig.json` or `[tool.pyright]` / `[tool.basedpyright]` in `pyproject.toml`: `typeCheckingMode`, `venvPath`, `venv`, `include`, `exclude`
- `ruff.toml` or `[tool.ruff]` in `pyproject.toml` for lint rules
- `mypy.ini` or `[tool.mypy]` when the project type-checks with mypy

```json
{
  "venvPath": ".",
  "venv": ".venv",
  "typeCheckingMode": "standard",
  "include": ["src"]
}
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `pyright-langserver --stdio` | the upstream checker as a server |
| `ty server` | Astral's fast checker, still pre-1.0 |
| `pyrefly lsp` | Meta's checker, young project |
| `ruff server` | lint and format only; complements a type server |
| `pylsp` | plugin-based server (jedi, rope); weaker types |
| `mypy` | CLI-only checker the normaliser uses when pyright is absent |

## Troubleshooting

- **PATH:** `uv tool install` and `pipx` write to `~/.local/bin`; put that directory on PATH and open a new shell.
- **"Import could not be resolved":** the checker is not seeing the project virtual environment. Set `venvPath` and `venv`, or run `basedpyright --pythonpath .venv/bin/python`, before calling it a code defect.
- **Missing stubs:** install the `types-*` package (for example `types-requests`) in the project environment; the checker reports `reportMissingModuleSource` until then.
- **More errors than the editor shows:** basedpyright defaults to its `recommended` mode, which is stricter than pyright's `standard`. Set `typeCheckingMode` to match CI.
- **Syntax-only row:** the stdlib compile check is a parse result; cite it as one.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" src/app.py                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" src/app.py --via=checker           # force the checker path
node "<skill-dir>/../lsp/scripts/diagnostics.mjs" src/app.py               # normalised CLI diagnostics
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

`ruff` has no server mode that `verify-lsp.mjs` drives; its findings arrive through the checker path.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
