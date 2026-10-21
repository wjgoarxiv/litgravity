# FastAPI, SQLAlchemy 2.x Async, PostgreSQL, Pydantic v2

The reference web API stack: async from the socket to the database, typed end to end, with an OpenAPI schema generated from the same types.

## Project layout

```text
myapi/
├── pyproject.toml
├── alembic.ini
├── migrations/
│   └── env.py
├── src/
│   └── myapi/
│       ├── __init__.py
│       ├── main.py            # FastAPI app and lifespan
│       ├── config.py          # pydantic-settings
│       ├── db.py              # engine, session factory, dependency
│       ├── errors.py          # typed errors and the exception handler
│       ├── models.py          # SQLAlchemy declarative models
│       ├── schemas.py         # Pydantic request and response models
│       └── routers/
│           ├── __init__.py
│           └── users.py
└── tests/
    ├── conftest.py
    └── test_users.py
```

Use the `src/` layout so tests import the installed package rather than the working directory.

## Dependencies

```bash
uv add fastapi 'sqlalchemy[asyncio]>=2.0' asyncpg 'pydantic[email]>=2' pydantic-settings 'uvicorn[standard]' orjson
uv add --dev httpx pytest 'anyio[trio]' alembic
```

Starlette's test client and the `ASGITransport` pattern import the original `httpx`, so it sits in the dev group only. Application code that calls other services uses `httpx2` through the factory in `httpx2-optimization.md`.

`orjson` speeds up responses that return plain `dict` or `list` values. Responses typed with a Pydantic model already serialize through Pydantic's Rust core, and `orjson-stack.md` explains which route to choose for each endpoint, with flags and measurements. For SSE and NDJSON streams call `orjson.dumps(...)` per chunk inside `StreamingResponse`.

## Configuration (`config.py`)

```python
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="MYAPI_", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/myapi"
    debug: bool = False
    cors_origins: list[str] = Field(default_factory=list)


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

Every field has a development default, so `Settings()` type-checks cleanly and production overrides values through `MYAPI_*` environment variables. A required field with no default makes `basedpyright` report a missing argument at the call, and suppressing that report with a comment violates the project rules. Verify production values at startup (for example, refuse to boot when `debug` is true and the environment is `prod`). In tests, build an instance explicitly: `Settings(database_url="...", _env_file=None)`.

## Database (`db.py`)

```python
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from myapi.config import get_settings


def make_engine() -> AsyncEngine:
    settings = get_settings()
    return create_async_engine(
        settings.database_url,
        echo=settings.debug,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=10,
    )


def make_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    factory: async_sessionmaker[AsyncSession] = request.app.state.session_factory
    async with factory() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]
```

The engine and session factory live on `app.state`, created in the lifespan (see `main.py`), so tests can build an app with a different engine and no module-level globals leak between tests.

`expire_on_commit=False` is essential in async code. Without it, attribute access after `commit()` triggers a lazy refresh, which fails with `MissingGreenlet` outside a greenlet context.

## Models (`models.py`)

```python
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, MappedAsDataclass, mapped_column


class Base(MappedAsDataclass, DeclarativeBase):
    pass


class User(Base):
    """ORM row; mutable by design (SQLAlchemy tracks attribute changes)."""  # noqa: MUTABLE_OK

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        init=False,
    )
```

`MappedAsDataclass` turns models into dataclasses, so `User(email=..., name=...)` is a typed constructor. `init=False` keeps database-generated columns out of `__init__`. Timestamps use `DateTime(timezone=True)` so values come back timezone-aware.

## Schemas (`schemas.py`)

```python
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    email: EmailStr
    name: str = Field(min_length=1, max_length=100)


class UserRead(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)   # ORM object to model

    id: int
    email: EmailStr
    name: str
    created_at: datetime
```

Keep separate `*Create` (input) and `*Read` (output) models. ORM classes stay inside the service and data layers, so a column rename never changes the public API by accident.

## Typed errors (`errors.py`)

```python
from dataclasses import dataclass

from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base for application errors."""


@dataclass(frozen=True, slots=True)
class NotFoundError(AppError):
    entity: str
    id: int

    def __str__(self) -> str:
        return f"{self.entity} {self.id} not found"


@dataclass(frozen=True, slots=True)
class ConflictError(AppError):
    entity: str
    field: str

    def __str__(self) -> str:
        return f"{self.entity}.{self.field} already exists"


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    match exc:
        case NotFoundError():
            return JSONResponse({"error": "not_found", "detail": str(exc)}, status_code=404)
        case ConflictError():
            return JSONResponse({"error": "conflict", "detail": str(exc)}, status_code=409)
        case _:
            return JSONResponse({"error": "internal_error"}, status_code=500)
```

The final arm returns a generic 500, because `AppError` is an open base class. Switch the base to a sealed union alias if every handler should be exhaustive (`type AnyAppError = NotFoundError | ConflictError`). `error-handling.md` covers the wider pattern, including the frozen-exception caveat.

## Routers (`routers/users.py`)

```python
from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from myapi.db import SessionDep
from myapi.errors import ConflictError, NotFoundError
from myapi.models import User
from myapi.schemas import UserCreate, UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, session: SessionDep) -> User:
    user = User(email=payload.email, name=payload.name)
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ConflictError(entity="user", field="email") from None
    await session.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: int, session: SessionDep) -> User:
    user = await session.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise NotFoundError(entity="user", id=user_id)
    return user


@router.get("", response_model=list[UserRead])
async def list_users(session: SessionDep, limit: int = 100) -> list[User]:
    result = await session.scalars(select(User).order_by(User.id).limit(min(limit, 500)))
    return list(result)
```

`session.scalar(...)` and `session.scalars(...)` shorten the execute-then-extract steps. Cap `limit` on the server, order every paginated query, and translate database constraint errors into typed domain errors at this edge. Larger services insert a service layer between routers and sessions, taking `AsyncSession` in its constructor so the same logic is callable from CLIs and tests.

## Application (`main.py`)

```python
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from myapi.config import get_settings
from myapi.db import make_engine, make_session_factory
from myapi.errors import AppError, app_error_handler
from myapi.routers import users


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    engine = make_engine()
    app.state.session_factory = make_session_factory(engine)
    try:
        yield
    finally:
        await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="My API", debug=settings.debug, lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])
    app.add_exception_handler(AppError, app_error_handler)
    app.include_router(users.router)
    return app


app = create_app()
```

Run it:

```bash
uv run uvicorn myapi.main:app --host 0.0.0.0 --port 8000 --reload
```

Production runs several workers (`--workers N`) behind a process manager or a container orchestrator, a health endpoint (`/healthz` for liveness, `/readyz` that runs `SELECT 1`), and structured logs with a request ID middleware.

## Migrations (Alembic with async)

```bash
uv run alembic init -t async migrations
```

In `migrations/env.py`, set the metadata and the URL:

```python
from myapi.config import get_settings
from myapi.models import Base

target_metadata = Base.metadata
config.set_main_option("sqlalchemy.url", get_settings().database_url)
```

Generate and apply:

```bash
uv run alembic revision --autogenerate -m "create users"
uv run alembic upgrade head
```

Read each autogenerated revision before applying it. Autogenerate misses renames and some constraint changes, and it does not know about data migrations.

## Tests (`tests/test_users.py`)

```python
import pytest
from httpx import ASGITransport, AsyncClient

from myapi.main import create_app

pytestmark = pytest.mark.anyio


async def test_create_and_get_user() -> None:
    app = create_app()
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            created = await client.post("/users", json={"email": "alice@example.com", "name": "Alice"})
            assert created.status_code == 201

            fetched = await client.get(f"/users/{created.json()['id']}")
            assert fetched.status_code == 200
            assert fetched.json()["email"] == "alice@example.com"
```

`ASGITransport` does not run the lifespan on its own, so enter `app.router.lifespan_context(app)` (or use `asgi-lifespan`) when handlers need `app.state`. Back database tests with a real PostgreSQL container (`testcontainers` or `docker compose`) and run migrations against it, since SQLite breaks on `JSONB`, arrays and `tsvector`. Roll back a transaction per test for speed, and use `app.dependency_overrides[get_session]` to inject a session bound to that transaction.

If a container runtime is unavailable in the current session, run the unit tests, mark the database tests as skipped with a clear reason, and say so in the report.

## Pitfalls

| Pitfall | Fix |
|---|---|
| `MissingGreenlet` when touching attributes after commit | `expire_on_commit=False`; load relationships eagerly (`selectinload`) |
| Connection pool exhausted under load | size `pool_size` and `max_overflow` to the database limit divided by the worker count |
| Pydantic v1 syntax (`class Config: orm_mode = True`) | `model_config = ConfigDict(from_attributes=True)` |
| Returning ORM objects with no `response_model` | declare `response_model` so OpenAPI and serialization match |
| Blocking calls in `async def` handlers | use async drivers, or run the blocking call with `anyio.to_thread.run_sync` |
| Naive timestamps | `DateTime(timezone=True)` and `datetime.now(UTC)` |
| Session shared between requests | one session per request through the dependency |
| `lazy="select"` relationships in async code | eager loading options on the query |

## Sources

- FastAPI: <https://fastapi.tiangolo.com>
- SQLAlchemy 2.x asyncio: <https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html>
- SQLAlchemy dataclass mapping: <https://docs.sqlalchemy.org/en/20/orm/dataclasses.html>
- asyncpg: <https://magicstack.github.io/asyncpg/current/>
- Pydantic v2 migration guide: <https://docs.pydantic.dev/latest/migration/>
- Alembic with asyncio: <https://alembic.sqlalchemy.org/en/latest/cookbook.html#using-asyncio-with-alembic>
