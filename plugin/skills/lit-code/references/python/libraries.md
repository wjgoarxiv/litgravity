# Library Defaults: Decision Tree

For each domain: the default choice, the reason, and a canonical snippet. These defaults hold unless the project's `pyproject.toml` already picks something else; an existing dependency beats a new one.

Before adding a package, run `uv add <package>` and read the version `uv` resolves. A refused network call in a headless session is a reason to keep the current pins and say which check was skipped.

## CLI: typer

`typer` builds a command-line interface from type-annotated function signatures. `argparse` needs several times the code, `click` ignores annotations, and `fire` infers too much to stay predictable at scale.

```python
import typer
from rich import print as rprint

app = typer.Typer(no_args_is_help=True)


@app.command()
def greet(name: str, count: int = 1, shout: bool = False) -> None:
    """Print a greeting `count` times."""
    message = f"HELLO, {name.upper()}!" if shout else f"Hello, {name}!"
    for _ in range(count):
        rprint(message)


if __name__ == "__main__":
    app()
```

A single-function script can call `typer.run(main)`. Subcommands use `@app.command()`. Return an exit code with `raise typer.Exit(code=2)`, and read secrets from the environment through `typer.Option(envvar="API_KEY")`.

## Terminal output: rich

`rich` renders tables, progress bars, syntax highlighting and tracebacks. Use it for structured output. Plain `print` suits simple machine-readable lines, and diagnostics go through `rich.console.Console(stderr=True)` so stdout stays clean for pipes.

```python
from rich.console import Console
from rich.table import Table
from rich.traceback import install

console = Console()

table = Table(title="Users")
table.add_column("ID", style="cyan")
table.add_column("Name", style="magenta")
table.add_row("1", "Alice")
console.print(table)

install(show_locals=True)   # rich tracebacks; call once at process start
```

Turn `show_locals` off for code that handles secrets, because locals appear in the traceback output.

## HTTP client: [httpx2](https://github.com/pydantic/httpx2)

The next-generation HTTP client under Pydantic stewardship: sync and async in one library, native HTTP/2, brotli and zstd decoding, real type information. It replaces `requests` (sync only), `aiohttp` (async only) and the original `httpx`.

Install `httpx2[http2,brotli,zstd]` with all three extras. A bare `httpx2.AsyncClient()` or `httpx2.Client()` is a defect, and clients come from the factory in `httpx2-optimization.md`, which switches on every optimization:

```python
import socket

import httpx2

_LIMITS = httpx2.Limits(max_connections=200, max_keepalive_connections=40, keepalive_expiry=30.0)
_TIMEOUT = httpx2.Timeout(connect=5.0, read=30.0, write=10.0, pool=10.0)
_SOCKET_OPTS: list[tuple[int, int, int]] = [(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)]

# async: the common case
transport = httpx2.AsyncHTTPTransport(http2=True, retries=3, limits=_LIMITS, socket_options=_SOCKET_OPTS)
async with httpx2.AsyncClient(transport=transport, timeout=_TIMEOUT, follow_redirects=True) as client:
    response = await client.get("https://api.example.com/users")
    response.raise_for_status()
    users = response.json()

# sync
transport = httpx2.HTTPTransport(http2=True, retries=3, limits=_LIMITS, socket_options=_SOCKET_OPTS)
with httpx2.Client(transport=transport, timeout=_TIMEOUT, follow_redirects=True) as client:
    response = client.get("https://api.example.com/users")
    response.raise_for_status()
```

Open `httpx2-optimization.md` whenever you write network code. It holds `create_client()` and `create_async_client()`, event hooks and the reasoning behind each value.

## JSON: stdlib `json`, or `orjson` on hot paths

The standard module serves configs and cold paths. Use `orjson` when JSON sits on a hot path: cache layers, queue payloads, streaming responses, structured logs and FastAPI endpoints that return raw `dict` or `list` values.

```python
import orjson

raw: bytes = orjson.dumps(payload, option=orjson.OPT_NAIVE_UTC | orjson.OPT_UTC_Z)   # bytes, not str
```

With Pydantic v2, `model.model_dump_json()` runs in pydantic-core (Rust) and beats an `orjson` bridge for model-shaped data. Use it for Pydantic models and use `orjson` for everything else. For FastAPI, `FastAPI(default_response_class=ORJSONResponse)` speeds up raw `dict` and `list` returns, and Pydantic-typed returns bypass it on purpose. Details: `orjson-stack.md`.

## Validation: pydantic v2

The Rust core makes v2 many times faster than v1, and it is the boundary validator for the whole stack: HTTP models (FastAPI uses it natively), configuration (`pydantic-settings`) and anything that enters the program from outside.

```python
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class User(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int = Field(ge=1)
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)
    age: int | None = Field(default=None, ge=0, le=150)

    @field_validator("name")
    @classmethod
    def name_has_no_digits(cls, v: str) -> str:
        if any(c.isdigit() for c in v):
            msg = "name cannot contain digits"
            raise ValueError(msg)
        return v


user = User.model_validate({"id": 1, "email": "a@b.com", "name": "Alice"})
print(user.model_dump_json(indent=2))
```

`ValueError` inside a validator is Pydantic's protocol, and Pydantic wraps it in a `ValidationError` that callers catch at the boundary. Internal records without validation needs stay `@dataclass(frozen=True, slots=True)`.

## Async: anyio

The full reference is `async-anyio.md`. Summary:

```python
import anyio


async def fetch(url: str) -> str:
    await anyio.sleep(0.1)
    return url


async def main() -> None:
    async with anyio.create_task_group() as tg:
        for url in ("a", "b", "c"):
            tg.start_soon(fetch, url)


anyio.run(main)
```

Project code imports `anyio`. Third-party libraries are free to use asyncio internally.

## Web framework: fastapi

A type-hint-driven HTTP framework that turns Pydantic models into OpenAPI schemas.

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class CreateUser(BaseModel):
    name: str
    email: str


class User(BaseModel):
    id: int
    name: str
    email: str


@app.post("/users", response_model=User)
async def create_user(payload: CreateUser) -> User:
    return User(id=1, **payload.model_dump())
```

Full stack with a database: `fastapi-stack.md`.

## ORM: sqlalchemy 2.x async

SQLAlchemy 2.x has a real async API. Use the `MappedAsDataclass` declarative style with annotations.

```python
from sqlalchemy import String
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, MappedAsDataclass, mapped_column


class Base(MappedAsDataclass, DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)


engine = create_async_engine("postgresql+asyncpg://localhost/myapp")
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)
```

Integration with FastAPI is in `fastapi-stack.md`. The module-level engine above is acceptable in a script; applications create the engine in their lifespan.

## Database: PostgreSQL with asyncpg

New applications start on PostgreSQL. SQLite is fine for quick local tests and unsuitable for production. `asyncpg` is the fastest Python PostgreSQL driver and plugs into SQLAlchemy 2.x async: `postgresql+asyncpg://user:pass@host:5432/db`.

Migrations use Alembic with the async template:

```bash
uv add alembic
uv run alembic init -t async migrations
```

## TUI: textual

Textual builds rich, mouse-aware terminal applications on the Rich rendering engine. See `textual-tui.md`.

## AI agents: pydantic-ai

The agent framework from the Pydantic team: strict types, first-class structured outputs, model-agnostic. See `pydantic-ai.md`.

## DataFrames: polars and numpy

Polars is far faster than pandas on typical workloads, has a real type system and supports lazy evaluation. numpy stays in the toolbox for arrays. See `data-processing.md`.

## Analytical SQL: duckdb

DuckDB queries CSV, Parquet and JSON files in place, runs joins and large aggregations quickly, and exchanges data with Polars through Arrow. See `data-processing.md`.

## Tests: pytest

Use pytest for tests, with these conventions:

- Files are named `test_*.py` and functions `test_*`.
- Fixtures use `@pytest.fixture`, and async fixtures work through the anyio plugin.
- Parametrize with `@pytest.mark.parametrize`.
- Mark async tests with `@pytest.mark.anyio`, provided by anyio's pytest plugin.

```python
import anyio
import pytest


@pytest.fixture
def sample_user() -> dict[str, str]:
    return {"name": "Alice", "email": "a@b.com"}


@pytest.mark.parametrize(("count", "expected"), [(1, "Hello"), (2, "Hello, Hello")])
def test_greet(count: int, expected: str) -> None:
    assert ", ".join(["Hello"] * count) == expected


@pytest.mark.anyio
async def test_async_fetch() -> None:
    await anyio.sleep(0)
```

`pyproject.toml`:

```toml
[tool.pytest.ini_options]
minversion = "8.0"
testpaths = ["tests"]
addopts = ["-ra", "--strict-config", "--strict-markers"]
```

Useful companions: `pytest-cov` for coverage, `hypothesis` for property tests, `pytest-randomly` to shuffle order, `freezegun` or `time-machine` for clocks, and `respx`-style transport mocks (`httpx2.MockTransport`) for HTTP.

## Settings: pydantic-settings

Loads environment variables and `.env` files into a Pydantic model, replacing scattered `os.environ.get(...)` calls.

```python
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="MYAPP_")

    database_url: SecretStr = SecretStr("postgresql+asyncpg://localhost/myapp")
    api_key: SecretStr = Field(default=SecretStr(""), min_length=0)
    debug: bool = False


settings = Settings()
```

Give fields development defaults so `Settings()` type-checks, and validate production-critical values at startup (an empty `api_key` stops the process). `SecretStr` keeps values out of logs and reprs.

## Logging: stdlib logging with a rich handler

```python
import logging

from rich.logging import RichHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(rich_tracebacks=True, show_path=False)],
)
log = logging.getLogger(__name__)
log.info("ready")
```

Switch to `structlog` for structured production logs, with `orjson.dumps` as its serializer (`orjson-stack.md`). Reach for the library before writing a logging framework by hand.

## Other defaults

| Need | Choice |
|---|---|
| Dates and times | stdlib `datetime` with `zoneinfo`; `datetime.now(UTC)` |
| Paths | `pathlib.Path`; `anyio.Path` in async code |
| Retries with backoff | `tenacity`, or the small loop in `httpx2-optimization.md` |
| Caching | `functools.cache` / `lru_cache` for pure functions, `cachetools` for TTLs, Redis for shared caches |
| Redis | `redis` (`redis.asyncio`) |
| Background jobs | `arq` or `taskiq` for async; Celery when its ecosystem is required |
| Templating | `jinja2` |
| YAML and TOML | `pyyaml` (safe_load only), stdlib `tomllib` |
| Dependency injection | FastAPI `Depends`, or plain constructor arguments |
| Profiling | `py-spy` for sampling, `cProfile` with `snakeviz`, `scalene` for CPU and memory |
| Security checks | `bandit` through ruff's `S` rules, `pip-audit` for dependencies |

## Choosing an unfamiliar dependency

1. Is it maintained, with a release in the last twelve months?
2. Does it ship type information that `basedpyright` accepts in strict mode?
3. Does it fit the async model (anyio-friendly, no blocking calls in `async def`)?
4. Does it overlap a package already in `pyproject.toml`?
5. What does `uv tree --package <name>` pull in transitively?
6. Is its license compatible with the project's distribution model?

Record the reason for each new direct dependency in the change description.
