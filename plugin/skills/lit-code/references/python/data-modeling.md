# Data Modeling

Which container to pick, how to shape data, and why frozen is the default. The guiding rule: data that crosses a trust boundary is parsed into a validated model once, and the rest of the program works with plain frozen value objects.

---

## Decision flow

```text
Fixed set of named constants?
  yes -> StrEnum / IntEnum
Branding a primitive (int, str, float)?
  yes -> NewType("X", base)
Interface or capability ("this thing can do X")?
  shape only, no shared code      -> Protocol
  shared method implementation    -> ABC
Does the data cross a trust boundary (user input, API, file, external DB)?
  yes -> pydantic.BaseModel (frozen=True)
Dict shape needed for JSON compatibility or **kwargs typing?
  yes -> TypedDict
Structured data with named fields?
  yes -> @dataclass(frozen=True, slots=True)
Tuple with positional meaning (coordinates, DB row)?
  yes -> NamedTuple
Otherwise a new type is probably unnecessary.
```

---

## Container reference

### `@dataclass`: internal value object

The default for structured data inside the codebase: no framework coupling, no validation cost.

```python
from dataclasses import dataclass
from typing import NewType

UserId = NewType("UserId", int)


@dataclass(frozen=True, slots=True)
class User:
    id: UserId
    name: str
    email: str


@dataclass(frozen=True, slots=True, kw_only=True)
class RetryPolicy:
    attempts: int = 3
    backoff_seconds: float = 0.5
```

Always `frozen=True, slots=True`. Frozen instances are hashable, safe to share across tasks and usable as dict keys, and `slots` reduces memory and blocks stray attributes. Produce a changed copy with `dataclasses.replace(user, name="Ada")`. Mutable classes appear only where mutation is the documented purpose, marked with `# noqa: MUTABLE_OK` and a docstring that says why.

Use `field(default_factory=tuple)` for collection defaults, and prefer immutable collection types (`tuple[str, ...]`, `frozenset[str]`, `Mapping[str, int]`) in frozen classes so the object is immutable all the way down.

### Pydantic `BaseModel`: guardian of the trust boundary

Choose Pydantic when data enters or leaves the system. It validates on construction, serializes to JSON and feeds the OpenAPI schema.

```python
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CreateUserRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    age: int = Field(ge=13, le=130)


class UserResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int
    name: str
    email: str
```

`extra="forbid"` rejects unknown keys, which turns client typos into errors. Parse external data with `Model.model_validate(raw)` (a dict) or `Model.model_validate_json(raw_bytes)` (faster, since it skips the intermediate dict). Serialize with `model.model_dump_json()`. Keep Pydantic out of internal-only data: validation has a cost, and a dataclass says "already trusted" more clearly.

`EmailStr` needs the `email-validator` package (`uv add "pydantic[email]"`).

### `TypedDict`: a dict that knows its shape

Pick it when the value must stay a `dict` at runtime: JSON blobs, `**kwargs`, third-party APIs.

```python
from typing import NotRequired, TypedDict


class Headers(TypedDict):
    content_type: str
    authorization: NotRequired[str]


def make_request(url: str, headers: Headers) -> None: ...


make_request("https://api.example.com", {"content_type": "application/json"})
```

### `Protocol`: structural interface

"Anything with method X", no inheritance required.

```python
from dataclasses import dataclass
from typing import Protocol


class Renderable(Protocol):
    def render(self) -> str: ...


@dataclass(frozen=True, slots=True)
class MarkdownDoc:
    content: str

    def render(self) -> str:
        return self.content


def publish(doc: Renderable) -> None:
    print(doc.render())   # MarkdownDoc qualifies without subclassing
```

Default to `Protocol` for interfaces, and reach for `ABC` only when subclasses share method bodies.

### `ABC`: interface with shared code

```python
from abc import ABC, abstractmethod


class BaseRepository(ABC):
    @abstractmethod
    async def get(self, id: int) -> Model | None: ...

    @abstractmethod
    async def save(self, model: Model) -> None: ...

    async def get_or_raise(self, id: int) -> Model:
        result = await self.get(id)
        if result is None:
            raise NotFoundError(entity=type(self).__name__, id=id)
        return result
```

### `NamedTuple`: positional and named (rare)

```python
from typing import NamedTuple


class Coordinate(NamedTuple):
    x: float
    y: float


x, y = Coordinate(1.0, 2.0)   # tuple unpacking works
```

Choose it when unpacking or indexing is part of the contract. For everything else `@dataclass(frozen=True, slots=True)` is the better fit.

---

## Quick lookup

| Situation | Use | Why |
|---|---|---|
| User input, API request or response | Pydantic `BaseModel` | validation, JSON Schema, serialization |
| Database row mapped to Python | SQLAlchemy `Mapped[]` model | ORM integration, async sessions |
| Internal value object | `@dataclass(frozen=True, slots=True)` | no overhead, no re-validation |
| Several outcomes from one function | union of frozen dataclasses | distinct types for `match` |
| Dict shape for JSON or `**kwargs` | `TypedDict` | remains a dict at runtime |
| Fixed constants | `StrEnum` / `IntEnum` | exhaustive `match`, no typos |
| Distinct primitive | `NewType("X", int)` | brand at type level, zero runtime cost |
| Contract or capability | `Protocol` | structural typing |
| Contract with shared code | `ABC` | when `Protocol` is not enough |
| Settings from the environment | `pydantic-settings` `BaseSettings` | env parsing, validation |

## Comparison matrix

| Feature | dataclass | Pydantic | TypedDict | Protocol | NamedTuple | NewType | Enum |
|---|---|---|---|---|---|---|---|
| Validation | no | yes | no | no | no | no | no |
| JSON serialization | manual | built in | native dict | none | manual | none | `.value` |
| Immutability | `frozen=True` | `frozen=True` | dict (mutable) | n/a | always | n/a | always |
| Runtime cost | near zero | validation | zero | zero | near zero | zero | near zero |
| `match` support | yes | yes | no | no | yes | no | yes |
| `slots` support | yes | no | no | no | no | no | no |

---

## Parse, then trust

Validate at the boundary. Past the boundary, a type is proof of validity.

```python
from typing import NewType

Email = NewType("Email", str)


# Weak: validates, then keeps passing a raw str
def process_email(email: str) -> None:
    if "@" not in email:
        raise InvalidEmailError(raw=email)
    ...  # every later function still sees an unchecked str


# Strong: one parsing function, typed result
def parse_email(raw: str) -> Email:
    local, sep, domain = raw.strip().partition("@")
    if not (local and sep and "." in domain):
        raise InvalidEmailError(raw=raw)
    return Email(f"{local}@{domain}".lower())


def send_welcome(email: Email) -> None: ...   # callers cannot pass an unparsed str
```

With Pydantic the parsing step is the model constructor: an `EmailStr` field arrives valid, and downstream code skips re-validation. Keep the parse function next to the type, return the typed value, and raise a typed error (`error-handling.md`).

---

## Settings and configuration

```python
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="APP_", env_file=".env", extra="ignore")

    database_url: SecretStr
    request_timeout_seconds: float = Field(default=30.0, gt=0)
    debug: bool = False
```

Load settings once at startup and pass them down as an argument. `SecretStr` keeps secrets out of logs and reprs. This is one of the places mutable-by-convention is acceptable, because tests override fields.

---

## Serialization notes

- Dataclasses serialize through `dataclasses.asdict` for simple cases, or wrap them in `pydantic.TypeAdapter(User).dump_json(user)` for speed and consistent datetime handling.
- Datetimes are timezone-aware (`datetime.now(UTC)`) in models; naive datetimes fail the `DTZ` ruff rules.
- Money uses `decimal.Decimal`, and floats stay out of currency code.
- `Mapping` and `Sequence` annotations in parameters accept more callers than `dict` and `list`.

## Sources

- [dataclasses](https://docs.python.org/3/library/dataclasses.html)
- [Pydantic v2](https://docs.pydantic.dev/latest/)
- [typing.Protocol](https://docs.python.org/3/library/typing.html#typing.Protocol)
- [typing.TypedDict](https://docs.python.org/3/library/typing.html#typing.TypedDict)
- Alexis King, [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)
