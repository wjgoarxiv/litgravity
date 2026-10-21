# Strict `pyproject.toml` (basedpyright, ruff, uv)

A strict but workable configuration for modern Python projects. Copy it, then add the project's own dependencies and metadata.

## Bootstrap

```bash
# application
uv init --app myproject
cd myproject

# library (publishable to PyPI)
uv init --lib mylibrary
cd mylibrary

# development tools
uv add --dev basedpyright ruff pytest pytest-cov
```

`uv init` creates `pyproject.toml`, `.python-version` and a `src/` layout. Replace its `[tool.*]` sections with the block below and keep the `[build-system]` table that `--lib` writes. `scripts/python/new-project.py` automates all of this.

## The complete file

```toml
[project]
name = "myproject"
version = "0.1.0"
description = "..."
readme = "README.md"
requires-python = ">=3.13"
dependencies = []

[dependency-groups]
dev = [
    "basedpyright>=1.21",
    "ruff>=0.8",
    "pytest>=8",
    "pytest-cov>=5",
]

# ─────────────────────────────────────────────────────────────────
# basedpyright: typeCheckingMode = "all" turns every report flag into an error
# Docs: https://docs.basedpyright.com/latest/configuration/config-files/
# ─────────────────────────────────────────────────────────────────
[tool.basedpyright]
typeCheckingMode = "all"
pythonVersion = "3.13"
pythonPlatform = "All"                          # basedpyright default, explicit for clarity
include = ["src", "tests"]
exclude = ["**/__pycache__", "**/.venv", "**/build", "**/dist"]

# Most of these are already errors under "all"; listing them documents intent.
reportUnusedCallResult = "warning"              # ignored return values
reportUnnecessaryTypeIgnoreComment = "error"    # stale ignore comments must go
reportUnusedVariable = "error"
reportMissingParameterType = "error"
reportMissingReturnType = "error"
reportPrivateUsage = "error"

# Gradual adoption on an old codebase:
# baselineFile = "./.basedpyright/baseline.json"

# ─────────────────────────────────────────────────────────────────
# ruff: select = ["ALL"] enables every rule, then a short ignore list
# removes formatter conflicts and low-value noise.
# Docs: https://docs.astral.sh/ruff/linter/#rule-selection
# ─────────────────────────────────────────────────────────────────
[tool.ruff]
target-version = "py313"
line-length = 88                                # 100 or 120 are fine when set deliberately
src = ["src", "tests"]

[tool.ruff.lint]
select = ["ALL"]
ignore = [
    # formatter conflicts (ruff documents these)
    "COM812",   # missing trailing comma
    "ISC001",   # implicit string concatenation
    # docstring convention conflicts (pick D211 over D203, D212 over D213)
    "D203",
    "D213",
    # project-specific noise
    "CPY001",   # missing copyright notice
    "FBT001",   # boolean positional argument in definition
    "FBT002",   # boolean positional default in definition
    "TD002",    # missing TODO author
    "TD003",    # missing TODO link
    "FIX002",   # TODO comments are allowed
]
fixable = ["ALL"]
unfixable = []

[tool.ruff.lint.per-file-ignores]
"tests/**/*.py" = [
    "S101",     # assert is how pytest works
    "ARG",      # fixtures look like unused arguments
    "PLR2004",  # magic numbers in test data
    "SLF001",   # tests inspect private members
    "D",        # test names serve as documentation
]
"scripts/**/*.py" = [
    "T201",     # print is fine in scripts
    "INP001",   # implicit namespace package
]

[tool.ruff.lint.pydocstyle]
convention = "google"                           # or "numpy" / "pep257"

[tool.ruff.lint.flake8-bugbear]
# typer and FastAPI use calls as parameter defaults; without this, B008 fires on every route.
extend-immutable-calls = [
    "typer.Argument",
    "typer.Option",
    "fastapi.Depends",
    "fastapi.Query",
    "fastapi.Path",
    "fastapi.Body",
    "fastapi.Header",
    "fastapi.Cookie",
    "fastapi.File",
    "fastapi.Form",
]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
docstring-code-format = true
docstring-code-line-length = "dynamic"

# ─────────────────────────────────────────────────────────────────
# pytest
# ─────────────────────────────────────────────────────────────────
[tool.pytest.ini_options]
minversion = "8.0"
testpaths = ["tests"]
addopts = ["-ra", "--strict-config", "--strict-markers"]
filterwarnings = ["error"]

# ─────────────────────────────────────────────────────────────────
# coverage
# ─────────────────────────────────────────────────────────────────
[tool.coverage.run]
source = ["src"]
branch = true

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "if typing.TYPE_CHECKING:",
    "raise NotImplementedError",
    "@(abc\\.)?abstractmethod",
]
```

## Reasoning behind the settings

### basedpyright `typeCheckingMode = "all"`

basedpyright's modes, from strictest:

| Mode | Behavior |
|---|---|
| `"all"` | every diagnostic is an `error` |
| `"recommended"` | the same rules with less severe ones at `warning`; `failOnWarnings = true` keeps CI failing |
| `"strict"` | pyright's strict mode |
| `"standard"` | default |
| `"basic"`, `"off"` | looser, disabled |

`"all"` includes rules that stock pyright lacks, such as `reportImplicitOverride`, `reportImplicitStringConcatenation`, `reportIncompatibleUnannotatedOverride` and `reportUnannotatedClassAttribute`, so no opt-in list is needed.

`pythonPlatform = "All"` is basedpyright's default, and it reports imports that exist on only one operating system.

When a codebase is old, record a baseline (`uv run basedpyright --writebaseline`) and commit it. New code must be clean, and the baseline shrinks as old code is touched. Remove baseline entries in the commit that fixes them.

### ruff `select = ["ALL"]`

Ruff's documentation advises using `ALL` with discretion, since new rules turn on with each upgrade. For this stack that is the intent: a new rule counts as an error until someone justifies ignoring it. Pin ruff in the lockfile and upgrade on purpose, reading the diff of new findings.

The ignore list stays short:

| Rule | Reason |
|---|---|
| `COM812`, `ISC001` | conflict with `ruff format` |
| `D203` against `D211`, `D213` against `D212` | mutually exclusive docstring conventions; choose the modern pair |
| `CPY001` | most projects need no copyright header per file |
| `FBT001`, `FBT002` | boolean flags are idiomatic for CLIs built with typer |
| `TD002`, `TD003`, `FIX002` | TODOs without author or ticket links are acceptable in internal code |

`ANN101` and `ANN102` were removed in ruff 0.8.0; keep them out of `ignore`, since ruff errors on unknown rule codes. Ruff also warns when a selected rule conflicts with the formatter, which is a signal to add it to `ignore`.

Per-file ignores for `tests/**` follow common practice in open-source repositories. Per-line suppressions use `# noqa: RULE` with the specific code and a short reason; blanket `# noqa` is itself reported (`PGH004`).

### pytest strictness

`--strict-markers` rejects unregistered markers, `--strict-config` rejects unknown config keys, and `filterwarnings = ["error"]` turns warnings into failures so deprecations surface early. Register custom markers under `markers = [...]`.

## Library additions

A publishable library also declares:

```toml
[project]
classifiers = ["Typing :: Typed"]
license = "MIT"
authors = [{ name = "Your Name", email = "you@example.com" }]

[project.urls]
Homepage = "https://example.com"

[project.scripts]
mytool = "mylibrary.cli:app"
```

and ships an empty `src/mylibrary/py.typed` file so downstream type checkers use the inline annotations. Publish with `uv build` and `uv publish` from CI with a trusted publisher, and leave tokens out of the repository.

## CI gate

```bash
uv sync --frozen
uv run ruff format --check
uv run ruff check
uv run basedpyright
uv run pytest --cov
```

Run the checks in that order, cheapest first. A `Makefile` or `justfile` target named `ci` can wrap the five lines so humans and CI invoke the same command. Cache `~/.cache/uv` in CI for fast installs.

For local work, `uv run ruff check --fix` applies safe fixes and `uv run ruff format` rewrites formatting. Review the diff before committing, because `--fix` can change behaviour-neutral code in many files at once.

## What the combination enforces

With `scripts/python/check-no-excuse-rules.py` added, the setup enforces:

| Requirement | Mechanism |
|---|---|
| Exhaustive matching | basedpyright `all` mode plus `assert_never` |
| No `Any` | basedpyright `all` mode plus the script's `cast-any` rule |
| Ignored return values | `reportUnusedCallResult` |
| Immutable data | the script's `mutable-dataclass` and `missing-slots` rules |
| No null surprises | strict `None` analysis |
| Constants stay constant | `Final` reassignment is a type error |
| Unused variables | `reportUnusedVariable = "error"` |
| Stale suppressions | `reportUnnecessaryTypeIgnoreComment` and ruff's `RUF100` |

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `basedpyright` reports thousands of errors on an old repo | write a baseline first, then fix by directory |
| `Import "x" could not be resolved` | run `uv sync`, and check that `.venv` is the environment basedpyright uses (`venvPath = "."`, `venv = ".venv"`) |
| Missing stubs for a third-party package | install the `types-*` package as a dev dependency, or pin a version that ships `py.typed` |
| ruff reports `unknown rule` | the config references a removed code; delete it from `ignore` |
| `B008` on every FastAPI route | add the `extend-immutable-calls` block shown above |
| tests fail only under `filterwarnings = ["error"]` | fix or explicitly filter the specific warning with a comment |

## Sources

- basedpyright type-check settings: <https://docs.basedpyright.com/latest/configuration/config-files/#type-check-diagnostics-settings>
- basedpyright `"all"` and `"recommended"`: <https://docs.basedpyright.com/latest/configuration/config-files/#recommended-and-all>
- basedpyright defaults: <https://docs.basedpyright.com/latest/benefits-over-pyright/better-defaults/>
- ruff rule selection: <https://docs.astral.sh/ruff/linter/#rule-selection>
- ruff 0.8.0 removal of ANN101 and ANN102: <https://github.com/astral-sh/ruff/pull/14384>
- PEP 735, dependency groups: <https://peps.python.org/pep-0735/>
- uv project guide: <https://docs.astral.sh/uv/guides/projects/>
