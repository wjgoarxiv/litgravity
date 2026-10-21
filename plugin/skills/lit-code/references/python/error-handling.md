# Error Handling

Typed errors, exhaustive matching, union returns and resource safety. The aim: a reader can see from signatures which failures exist, a caller cannot forget one, and a log line always says what went wrong.

---

## Typed errors with fields

An error type carries structured data, so callers can match on it and handlers can build precise responses.

```python
from dataclasses import dataclass
from typing import NewType

UserId = NewType("UserId", int)


@dataclass(frozen=True, slots=True)
class UserNotFoundError(Exception):
    user_id: UserId

    def __str__(self) -> str:
        return f"user {self.user_id} not found"


@dataclass(frozen=True, slots=True)
class PermissionDeniedError(Exception):
    user_id: UserId
    required_role: str

    def __str__(self) -> str:
        return f"user {self.user_id} needs role {self.required_role}"
```

`__str__` is required on dataclass exceptions. `@dataclass` generates its own `__init__`, so `self.args` stays empty and `str(e)` returns an empty string, which blanks out logs and monitoring.

```python
# Bare strings carry nothing a handler can branch on
raise ValueError("user not found")

# Typed errors
raise UserNotFoundError(user_id=uid)
raise PermissionDeniedError(user_id=uid, required_role="admin")
```

### Frozen exception classes in practice

Exception objects have attributes that Python and libraries assign after construction (`__traceback__`, `__cause__`, `__context__`, notes). `contextlib` assigns `__traceback__` from Python code in some re-raise paths, and a frozen dataclass rejects that assignment with `FrozenInstanceError`. Raising and catching in plain code works. Before settling on `frozen=True` for an exception class, run a smoke test that raises it inside a `with` block backed by `@contextmanager`, inside an `anyio` task group and through `pytest.raises`. When any of them fails, drop `frozen=True` on exception classes only, keep the fields read-only by convention, and mark the class `# noqa: MUTABLE_OK` with a docstring line explaining why.

### Chaining

Use `raise NewError(...) from err` to keep the cause when translating between layers, and `from None` when the original is an implementation detail that would confuse the reader. Add context to an existing exception with `err.add_note("while loading profile 42")` (Python 3.11 and newer).

---

## Union returns for expected failures

A failure that callers anticipate (missing record, validation error, denied permission) is part of the function's result. Return a union so the type checker forces each caller to handle it. Reserve exceptions for the unexpected: network loss, corrupted data, out-of-memory.

### Outcome types

```python
@dataclass(frozen=True, slots=True)
class User:
    id: UserId
    name: str


@dataclass(frozen=True, slots=True)
class UserNotFound:
    id: UserId


@dataclass(frozen=True, slots=True)
class PermissionDenied:
    id: UserId
    reason: str


type GetUserResult = User | UserNotFound | PermissionDenied
```

### Exhaustive handling

```python
from typing import assert_never


def handle_result(result: GetUserResult) -> str:
    match result:
        case User(name=name):
            return f"Found: {name}"
        case UserNotFound(id=uid):
            return f"No user with id {uid}"
        case PermissionDenied(reason=reason):
            return f"Denied: {reason}"
        case unreachable:
            assert_never(unreachable)
```

`assert_never` in the last arm makes the checker report any variant added to `GetUserResult` that this function forgot.

### Choosing between union and exception

Rule of thumb: when the caller is one or two frames away and must act on the outcome, return a union. When the error travels through many layers to a boundary, raise a typed exception.

| Scenario | Pattern | Reason |
|---|---|---|
| Repository to service | union return (`User \| UserNotFound`) | the caller is adjacent and has to decide |
| Input parsing at a boundary | typed exception | it travels up to the HTTP or CLI handler |
| Infrastructure failure (network, disk) | exception | no local recovery, so it propagates |
| Service to service, deep internal | typed exception | union plumbing through many layers is worse than raising |
| HTTP handler to response | catch and convert | boundary code translates errors into status codes |

Unions are the safest option and cost boilerplate when each of several callers must `match`. If a result would pass unchanged through three or more layers, switch to a typed exception.

---

## Exhaustive `match`: every match ends in `assert_never`

```python
from enum import StrEnum
from typing import assert_never


class Status(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    DELETED = "deleted"


def describe(status: Status) -> str:
    match status:
        case Status.PENDING:
            return "waiting"
        case Status.ACTIVE:
            return "live"
        case Status.DELETED:
            return "gone"
        case unreachable:
            assert_never(unreachable)
```

When a new member joins the enum, `basedpyright` lists every `match` that needs an arm. A wildcard arm that returns a default value hides that signal, so skip it.

---

## Translating errors at the boundary

One function turns domain errors into transport responses, and every handler uses it.

```python
from fastapi import Request
from fastapi.responses import JSONResponse


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    match exc:
        case NotFoundError():
            return JSONResponse({"error": "not_found", "detail": str(exc)}, status_code=404)
        case ConflictError():
            return JSONResponse({"error": "conflict", "detail": str(exc)}, status_code=409)
        case unreachable:
            assert_never(unreachable)
```

Register it with `app.add_exception_handler(AppError, app_error_handler)`. Internal failures (unexpected exception types) become a generic 500 whose body says nothing about the cause; the traceback goes to the log with the request ID. See `fastapi-stack.md` for the full wiring.

---

## Context managers for resources

Anything with `.close()`, `.shutdown()`, `.disconnect()` or `.release()` lives inside a `with` block.

```python
from pathlib import Path

# Forgotten close() leaks the handle
f = open("data.txt")
data = f.read()
f.close()

# The context manager closes on every path
data = Path("data.txt").read_text()
```

### Async resources

```python
import httpx2


async def fetch_users() -> list[User]:
    async with make_client() as client:       # factory from httpx2-optimization.md
        response = await client.get("https://api.example.com/users")
        response.raise_for_status()
        return [User(**u) for u in response.json()]
```

### Custom context manager

```python
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager


@asynccontextmanager
async def managed_connection(url: str) -> AsyncIterator[Connection]:
    conn = await connect(url)
    try:
        yield conn
    finally:
        await conn.close()


async with managed_connection("postgres://...") as conn:
    await conn.execute("SELECT 1")
# closed here on every path
```

`contextlib.ExitStack` and `AsyncExitStack` manage a variable number of resources. `contextlib.suppress(FileNotFoundError)` replaces `try/except/pass` for one expected, specific exception.

---

## Exception hierarchy

Keep hierarchies shallow and specific.

```python
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
    value: str

    def __str__(self) -> str:
        return f"{self.entity}.{self.field} = {self.value!r} already exists"
```

Callers catch `AppError` at the boundary, or a specific subtype where they can respond usefully. When a library raises its own exception (database driver, HTTP client), catch the specific class at the adapter that wraps the library and re-raise as a domain error with `from err`.

---

## Exception groups and task groups

`anyio` task groups raise an `ExceptionGroup` when several child tasks fail. Handle them with `except*`:

```python
try:
    async with anyio.create_task_group() as tg:
        tg.start_soon(fetch_a)
        tg.start_soon(fetch_b)
except* httpx2.HTTPStatusError as group:
    for exc in group.exceptions:
        logger.error("upstream %d", exc.response.status_code)
except* TimeoutError:
    raise UpstreamTimeoutError() from None
```

`except*` matches each member of the group by type, and unmatched members continue to propagate. See `async-anyio.md`.

---

## Logging errors

- Log once, at the boundary that handles the error. Intermediate layers translate or let it pass.
- Use `logger.exception("message")` inside an `except` block to include the traceback.
- Pass identifiers as structured fields (`extra={"user_id": uid}` or the `structlog` binding), keeping tokens, passwords and full payloads out of logs.
- Format with lazy `%s` arguments: `logger.error("API %d", status)`.

## Antipatterns

| Pattern | Problem | Replacement |
|---|---|---|
| `raise ValueError("user not found")` | callers must parse a string | typed error with fields |
| `except Exception: pass` | hides every defect | catch the specific exception |
| `return None` for "not found" without `\| None` in the signature | callers crash later | union return or explicit `X \| None` |
| `case _: pass` in a `match` | swallows new variants | `case unreachable: assert_never(unreachable)` |
| `raise` of a new exception without `from` | loses the cause | `raise New(...) from err` |
| logging and re-raising at every layer | duplicate log lines | log at the boundary only |

## Sources

- [typing.assert_never](https://docs.python.org/3/library/typing.html#typing.assert_never)
- [contextlib](https://docs.python.org/3/library/contextlib.html)
- [match statement](https://docs.python.org/3/reference/compound_stmts.html#the-match-statement)
- [Exception groups and except*](https://docs.python.org/3/tutorial/errors.html#raising-and-handling-multiple-unrelated-exceptions)
