# Python Programmer (lit-code, Python reference index)

Modern Python in a strict style: the type checker acts as the compiler, illegal states have no representation, input is parsed at the boundary, and every resource has an owner. Start here, then open only the reference file that matches the task.

## Philosophy

Treat `basedpyright` in its strictest mode as the compiler and `ruff` with every rule family selected as the style guide. Each function carries a contract in its signature. Data enters through a parsing step that returns a typed object or raises, and the rest of the program works with those objects. The checklist below is a set of project decisions; deviations need a reason written next to the code.

## Tooling

| Category | Use | Replace |
|---|---|---|
| Package manager | `uv` | pip, poetry, conda, pipenv |
| Type checker | `basedpyright` with `typeCheckingMode = "all"` | pyright alone, mypy |
| Lint and format | `ruff` with `select = ["ALL"]` | flake8, black, isort, autopep8 |
| Async runtime | `anyio` | direct `asyncio` use |
| Data | `polars`, `duckdb`, `numpy` | pandas |
| Web framework | FastAPI with Pydantic v2 | Flask, Django REST |
| ORM | SQLAlchemy 2.x async | Django ORM, Tortoise |
| HTTP client | [`httpx2`](https://github.com/pydantic/httpx2) | requests, aiohttp, httpx |
| Tests | `pytest` | unittest |
| CLI | `typer` with `rich` | argparse, click, fire |

## The iron list

1. **Frozen by default.** `@dataclass(frozen=True, slots=True)`, and `model_config = ConfigDict(frozen=True)` for Pydantic. Mutable types exist only where mutation is the documented purpose.
2. **`NewType` for distinct IDs.** `UserId = NewType("UserId", int)`. A raw `int` does not travel where a branded type exists.
3. **`match` for variants, `if` for booleans.** Discriminating on type (`isinstance`), enum member or literal variant uses `match/case`, and the final arm is `case unreachable: assert_never(unreachable)`. A bare `case _: pass` or `case _: raise ValueError` swallows new variants silently. `if` fits boolean expressions, range checks and predicates. Examples follow below.
4. **`Protocol` over ABC.** Interfaces are `typing.Protocol` classes. An ABC appears when subclasses share method bodies.
5. **Typed shapes in signatures.** Parameters and returns use `TypedDict`, a dataclass or a Pydantic model. Scratch dicts inside a function are fine.
6. **Parse, then trust.** Constructors return typed objects or raise. Unvalidated data stops at the boundary.
7. **Typed errors.** Error types are dataclasses or exception classes with typed fields. Use union returns when the caller sits one or two frames away and must handle each outcome (repository to service). Use exceptions when the error travels many layers to a boundary handler (service to HTTP handler).
8. **`Final` constants.** Module-level constants are annotated `Final`; a mutable module global signals a design problem.
9. **Explicit `None`.** A function that can return `None` says `-> X | None`.
10. **Context managers for resources.** Files, connections, clients and locks use `with` or `async with`.
11. **Structural types over `Any` and `object`.** Both erase information. Choose a `Protocol`, a `TypeVar`, an explicit union or a `TypedDict`.
12. **Redesign instead of `cast`.** A `cast()` call marks a type that needs a better model.
13. **Fix errors instead of `# type: ignore`.** The checker's report is the contract; change the code.
14. **Catch specific exceptions.** `except Exception` and `except BaseException` hide `KeyError`, `AttributeError` and `TypeError`. A top-level boundary (CLI entry point, HTTP handler) may catch broadly with `# noqa: BROAD_EXCEPT_OK`, logging and re-raising or converting to an exit code.

### Typing and safety

- `basedpyright` runs in `typeCheckingMode = "all"`. Public functions have full annotations; internal helpers annotate the return type and may infer parameter types.
- `ruff` uses `select = ["ALL"]`. Override single rules per project in `pyproject.toml` with a comment, and keep the strict baseline intact.
- New functions carry a docstring unless the name and signature say everything (`def full_name(first: str, last: str) -> str:`).
- Unions use PEP 604 syntax: `X | Y` and `X | None`. Generic functions and classes use PEP 695 syntax (`def first[T](items: Sequence[T]) -> T`) on Python 3.12 and newer.

### Why `object` has no place in annotations

`object` looks safe because it is the top type, yet it offers no attributes and no narrowing. `Any` at least admits that a boundary is untyped.

```python
# Avoid: no information survives
def process(data: object) -> object: ...
results: dict[str, object] = {}

# Structural typing
class Serializable(Protocol):
    def serialize(self) -> bytes: ...

def process(data: Serializable) -> ProcessResult: ...

# Generic pass-through
def first[T](items: Sequence[T]) -> T: ...

# Known variants
def parse(raw: str | bytes) -> Document: ...
```

### Why variants use `match`

An `if/elif` chain over types, enum members or literals compiles with no check that every variant is covered. Add a variant later and nothing flags the chain. A `match` that ends in `assert_never` makes the checker report the missing case.

```python
# Avoid: the else branch turns a new variant into a runtime failure
if isinstance(event, Click):
    handle_click(event.x, event.y)
elif isinstance(event, Scroll):
    handle_scroll(event.delta)
else:
    raise ValueError(f"Unknown: {event}")

# Avoid: a wildcard that discards unknown variants
match event:
    case Click(x, y): handle_click(x, y)
    case _: pass

# Exhaustive match
match event:
    case Click(x=x, y=y):
        handle_click(x, y)
    case Scroll(delta=delta):
        handle_scroll(delta)
    case unreachable:
        assert_never(unreachable)

# Exhaustive enum match
match status:
    case Status.PENDING: start_review()
    case Status.ACTIVE:  continue_processing()
    case Status.CLOSED:  archive()
    case unreachable:    assert_never(unreachable)
```

Plain conditions stay plain:

```python
if age >= 18:
    grant_access()
else:
    deny_access()
```

### Why broad `except` is a defect

`except Exception` also catches `KeyError`, `TypeError`, `AttributeError` and `ValueError` raised by your own bugs, and the traceback that would have named the cause disappears. Name the exception you expect.

```python
# Avoid: swallows defects
try:
    result = api.fetch(url)
except Exception as e:
    logger.error(e)
    return None

# Specific handling
try:
    result = api.fetch(url)
except httpx2.HTTPStatusError as e:
    logger.error("API %d: %s", e.response.status_code, e.request.url)
    return None
except httpx2.ConnectError:
    raise ServiceUnavailableError(service="api") from None

# Top-level boundary: the single place a broad catch fits
def main() -> int:  # noqa: BROAD_EXCEPT_OK
    try:
        return run()
    except Exception:
        logger.exception("unhandled error")
        return 1
```

### Async

- Import `anyio`; leave `import asyncio` to library glue that cannot avoid it (`# noqa: ANYIO_OK` with a reason).
- Background work lives in an `anyio.create_task_group()`, so tasks cannot outlive their scope or lose exceptions.
- Concurrency limits use `anyio.CapacityLimiter`.
- Load `async-anyio.md` for the full pattern set.

### Data modeling: which container

Every model field carries a type annotation, and public APIs expose no untyped dicts. Tabular data uses `polars` and `duckdb`.

| Situation | Use |
|---|---|
| User input, API request or response | Pydantic `BaseModel` with `frozen=True` |
| Internal value object without I/O | `@dataclass(frozen=True, slots=True)` |
| Function with several outcomes | union of frozen dataclasses plus `match` |
| Dict shape for JSON compatibility or `**kwargs` | `TypedDict` |
| Fixed constants | `StrEnum` or `IntEnum` |
| Distinct primitive (UserId versus MovieId) | `NewType` |
| Capability or contract | `Protocol` |
| Contract with shared implementation | `ABC` |
| ORM model | SQLAlchemy `Mapped[]` (mutable by nature, `# noqa: MUTABLE_OK`) |
| Configuration from environment | `pydantic-settings` `BaseSettings` |

The rule of thumb: data that crosses a trust boundary becomes a Pydantic model, and everything else is a dataclass. `data-modeling.md` has the decision flow and comparison matrix.

### Where `frozen=True` does not apply

- ORM models, because SQLAlchemy mutates attributes. Mark with `# noqa: MUTABLE_OK`.
- Builders and accumulators (counters, buffers, state machines) that exist to change. The docstring says why.
- `BaseSettings`, which tests override field by field.

Any `# noqa: MUTABLE_OK` comes with a class docstring that names the reason for mutation.

### Libraries

Defaults, unless `pyproject.toml` picks something else:

| Domain | Library | Reason |
|---|---|---|
| CLI | `typer` | typed CLIs from function signatures |
| Terminal output | `rich` | tables, progress, tracebacks, markdown |
| HTTP client | [`httpx2`](https://github.com/pydantic/httpx2) | HTTP/2, brotli and zstd; install `httpx2[http2,brotli,zstd]`; see `httpx2-optimization.md` |
| Validation | `pydantic` v2 | fast native validator, JSON Schema output |
| Web API | `fastapi` | async, Pydantic-native, OpenAPI |
| ORM | `sqlalchemy` 2.x async | `Mapped[]` types, async sessions |
| PostgreSQL driver | `asyncpg` through SQLAlchemy | fastest PostgreSQL driver |
| AI agents | `pydantic-ai` | typed dependencies, structured output |
| TUI | `textual` | CSS layout, widgets, Rich rendering |
| Logging | `rich.logging.RichHandler` | readable locally; switch to `structlog` in production |

## `pyproject.toml`

Scaffold a project with the strict defaults already in place:

```bash
uv run "<skill-folder>/scripts/python/new-project.py" myproject
uv run "<skill-folder>/scripts/python/new-project.py" myproject --path ./workspace
uv run "<skill-folder>/scripts/python/new-project.py" myproject --lib   # publishable library
```

The script runs `uv init`, then adds `basedpyright` with `typeCheckingMode = "all"`, `ruff` with `select = ["ALL"]` and a strict pytest block. It works on macOS, Linux and Windows. For manual setup run `uv init --app myproject` and follow `pyproject-strict.md`.

## PEP 723 for every script

Each `.py` script, even a throwaway, carries PEP 723 inline metadata and a `# ─── How to run ───` comment block. The script is its own environment spec, so no venv or `requirements.txt` accompanies it, and a script without the usage block is incomplete.

Scaffold one with:

```bash
uv run "<skill-folder>/scripts/python/new-script.py" <name> --deps "httpx2[http2,brotli,zstd]"
```

The default output goes to a temp directory; `--output <path>` picks another location. `one-liners.md` has patterns, examples and antipatterns.

## `uv` command cheat sheet

| Task | Command |
|---|---|
| New application or library | `uv init --app <name>` / `uv init --lib <name>` |
| Pin the interpreter | `uv python pin 3.13` (writes `.python-version`) |
| Add or remove a dependency | `uv add <pkg>` / `uv add --dev <pkg>` / `uv remove <pkg>` |
| Install exactly what the lockfile says | `uv sync --frozen` (CI) or `uv sync` (local) |
| Run inside the project environment | `uv run pytest`, `uv run basedpyright` |
| Run a tool without installing it | `uvx ruff check .` |
| Refresh the lockfile | `uv lock --upgrade-package <pkg>` |

Commit `uv.lock` and `.python-version`. Python 3.12 is the floor for the PEP 695 syntax used in this reference; 3.13 is the default for new projects.

## Which reference to open

Open on demand, one at a time.

| Need | Open |
|---|---|
| Complete `pyproject.toml` | `pyproject-strict.md` |
| `NewType`, `Final`, enums, narrowing | `type-patterns.md` |
| Container choice, frozen models, parse-then-trust | `data-modeling.md` |
| Typed errors, union returns, exhaustive match | `error-handling.md` |
| anyio patterns | `async-anyio.md` |
| polars and duckdb | `data-processing.md` |
| FastAPI with SQLAlchemy | `fastapi-stack.md` |
| Library decision tree | `libraries.md` |
| Network code (always) | `httpx2-optimization.md` |
| JSON on a hot path, FastAPI response speed | `orjson-stack.md` |
| PEP 723 scripts | `one-liners.md` |
| PydanticAI agents | `pydantic-ai.md` |
| Textual interfaces | `textual-tui.md` |

## `httpx2` for all network requests

Every outgoing HTTP call uses [`httpx2`](https://github.com/pydantic/httpx2) with the `http2`, `brotli` and `zstd` extras. `requests`, `aiohttp` and the original `httpx` stay out of the code.

All optimizations are on from the first line: HTTP/2, a tuned pool (200 connections, 40 keep-alive, 30 second expiry), split timeouts (5/30/10/10), transport retries (3), `TCP_NODELAY`, redirect following and event hooks for observability. A bare `httpx2.AsyncClient()` counts as a lint violation. For any network code, open `httpx2-optimization.md` and copy the factory from it unchanged.

## No-excuse audit

`scripts/python/check-no-excuse-rules.py` reports the violations below; run it after every edit session.

| Rule ID | Finds | Opt-out |
|---|---|---|
| `cast-any` | `cast(Any, ...)` | none; redesign the types |
| `type-ignore` | `# type: ignore` | none; fix the type |
| `pyright-ignore` | `# pyright: ignore` | none; fix the type |
| `bare-except` | `except:` with no class | none; name the exception |
| `silent-except` | `except X: pass` or `except X: ...` | none; handle or re-raise |
| `no-asyncio` | `import asyncio` | `# noqa: ANYIO_OK` |
| `no-pandas` | `import pandas` | `# noqa: PANDAS_OK` |
| `mutable-dataclass` | `@dataclass` without `frozen=True` | `# noqa: MUTABLE_OK` |
| `missing-slots` | `@dataclass` without `slots=True` | `# noqa: SLOTS_OK` |
| `raw-dict-return` | `-> dict` return annotation | `# noqa: DICT_OK` |
| `missing-assert-never` | `match` without an `assert_never` arm | `# noqa: MATCH_OK` |
| `generic-exception` | `raise ValueError("...")` or `raise TypeError("...")` with a bare string | `# noqa: GENERIC_ERR_OK` |
| `no-object` | `object` in a parameter, return or generic argument | `# noqa: OBJECT_OK` |
| `if-elif-on-variant` | `isinstance` or enum-equality chains that belong in `match` | `# noqa: IF_VARIANT_OK` |
| `oversized-module` | file past 250 pure lines | `# noqa: SIZE_OK` |
| `broad-except` | `except Exception` or `except BaseException` | `# noqa: BROAD_EXCEPT_OK` |

Fix every finding before calling the work done. `basedpyright` and `ruff` cover the remainder.

## Tests

Tests follow the same rules with a short list of relaxations, already set in the per-file ignores of `pyproject.toml`:

| In tests | Reason |
|---|---|
| `assert` statements | pytest's mechanism (`S101` ignored) |
| magic numbers | test data (`PLR2004` ignored) |
| `_private` access | internals under test (`SLF001` ignored) |
| missing docstrings | test names document intent (`D` ignored) |
| unused arguments | pytest fixtures (`ARG` ignored) |

Frozen dataclasses, typed errors and exhaustive matches still apply. A fixture class that needs mutable state uses `# noqa: MUTABLE_OK`.

## Existing codebases

When a file breaks these rules, write the new lines in the strict style and leave the surrounding code alone for that change. Mixing feature work with style migration makes reviews harder and bugs likelier. The `lit-burnoff` skill handles branch-wide cleanup with characterization tests first.

## Verification checklist

1. `uv run ruff format --check .` and `uv run ruff check .` exit 0.
2. `uv run basedpyright` reports 0 errors, 0 warnings.
3. `uv run pytest -q` passes, with coverage settings from `pyproject-strict.md`.
4. `python3 "<skill-folder>/scripts/python/check-no-excuse-rules.py" <changed files>` exits 0.
5. Each script has PEP 723 metadata and a usage block; each module stays under 250 pure lines.
6. In headless sessions, run `uv --version` first; if `run_command` is refused, report the exact commands for the user to run and stop.

## Activation

Load this index whenever you write or modify a `.py` file. One-off scripts get the strict treatment as well, which is what PEP 723 with `uv run` is for: production hygiene with throwaway ergonomics.
