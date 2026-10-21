# Type Patterns

How to use Python's type system so that mistakes surface when `basedpyright` runs instead of in production. Each pattern below pairs a short rule with a runnable example and a note on when to skip it.

---

## `NewType`: distinct primitives

The runtime type stays the same while the checker treats the names as different types, so swapped arguments fail the type check.

```python
from typing import NewType

UserId = NewType("UserId", int)
MovieId = NewType("MovieId", int)
Email = NewType("Email", str)
Seconds = NewType("Seconds", float)
Milliseconds = NewType("Milliseconds", float)


def get_user(user_id: UserId) -> User: ...
def get_movie(movie_id: MovieId) -> Movie: ...
def sleep(duration: Seconds) -> None: ...


uid = UserId(42)
mid = MovieId(42)

get_user(uid)                # accepted
get_user(mid)                # error: MovieId is not UserId
get_user(42)                 # error: int is not UserId
sleep(Milliseconds(100.0))   # error: Milliseconds is not Seconds
```

Use `NewType` for identifiers, indices, keys and unit-bearing numbers: any pair where a swap is a bug. Skip it for short-lived local arithmetic where the extra name adds noise with no safety gain.

`NewType` performs no validation. Pair it with a parsing function (`parse_email`, see `data-modeling.md`) so the only way to obtain an `Email` is to pass through the check. In Pydantic models, annotate the field with the `NewType` and add `Field(...)` constraints on the base type; Pydantic validates the base type and the checker enforces the brand.

---

## `Final`: constants

A module-level constant declares its intent, and reassigning it is a type error.

```python
from typing import Final

MAX_RETRIES: Final = 3
API_BASE_URL: Final = "https://api.example.com"
DEFAULT_TIMEOUT: Final = 30.0

MAX_RETRIES = 5   # error: cannot assign to a Final name
```

A value that changes at runtime belongs in a function parameter or a configuration field. `Final` also marks attributes that must not be overridden: `class Client: base_url: Final = "..."`. `typing.final` (lowercase) seals classes and methods against subclassing or overriding.

---

## Type aliases: name complex types

When a union or generic appears twice, give it a name.

```python
# Python 3.12 and newer
type JsonValue = str | int | float | bool | None | list[JsonValue] | dict[str, JsonValue]
type Headers = dict[str, str]
type Middleware = Callable[[Request], Awaitable[Response]]

# Python 3.11 and older
from typing import TypeAlias

JsonValue: TypeAlias = str | int | float | bool | None | list["JsonValue"] | dict[str, "JsonValue"]
```

The `type` statement evaluates lazily, so recursive aliases need no quotes. Generic aliases take parameters: `type Pair[T] = tuple[T, T]`.

---

## `StrEnum` and `IntEnum`: closed sets

Any fixed collection of known values becomes an enum, so string literals stop spreading through the code.

```python
from enum import IntEnum, StrEnum, unique


@unique
class Role(StrEnum):
    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"


@unique
class HttpStatus(IntEnum):
    OK = 200
    NOT_FOUND = 404
    INTERNAL_ERROR = 500


def check_role(role: Role) -> bool: ...   # accepts Role members only
```

Use `StrEnum` for values that serialize as strings (APIs, databases) and `IntEnum` for numeric codes. Plain `Enum` suits pure labels. `@unique` rejects accidental aliases. Switch on enums with an exhaustive `match` (see `error-handling.md`), and convert untrusted input with `Role(raw)`, which raises `ValueError` for unknown values; catch that at the boundary and turn it into a typed error.

`Literal["a", "b"]` is the lighter option for a small closed set that never needs members, iteration or methods, for instance a function parameter such as `mode: Literal["r", "w"]`.

---

## Narrowing: let the checker follow the logic

`isinstance`, `is None`, truthiness checks and `match` narrow types automatically. Narrowing replaces `cast`.

```python
def process(value: str | int | None) -> str:
    if value is None:
        return "nothing"
    # checker: str | int

    if isinstance(value, str):
        return value.upper()
    # checker: int

    return str(value * 2)
```

### `TypeGuard` for custom narrowing

```python
from typing import TypeGuard


def is_valid_email(value: str) -> TypeGuard[Email]:
    return "@" in value and "." in value.split("@")[1]


def send(addr: str) -> None:
    if not is_valid_email(addr):
        raise InvalidEmailError(raw=addr)
    # checker: addr is Email
    deliver(addr)
```

`TypeGuard` narrows only the positive branch.

### `TypeIs` (Python 3.13 and newer)

`TypeIs` narrows both branches, which matches how `isinstance` behaves, and is the better default when the guard is an exact type test.

```python
from typing import TypeIs


def is_str(value: str | int) -> TypeIs[str]:
    return isinstance(value, str)


def handle(v: str | int) -> None:
    if is_str(v):
        print(v.upper())   # checker: str
    else:
        print(v + 1)       # checker: int
```

`typing_extensions.TypeIs` backports it to older interpreters.

---

## Generics with PEP 695 syntax

Python 3.12 gives generics a concise form, with the variance inferred.

```python
from collections.abc import Callable, Sequence


def first[T](items: Sequence[T]) -> T:
    return items[0]


class Box[T]:
    def __init__(self, value: T) -> None:
        self._value = value

    def map[U](self, fn: Callable[[T], U]) -> "Box[U]":
        return Box(fn(self._value))
```

Bound a type variable when it needs behaviour: `def longest[S: Sized](a: S, b: S) -> S`. Constrain it to a fixed list with `[T: (int, str)]`. Use `ParamSpec` (`def retry[**P, R](fn: Callable[P, R]) -> Callable[P, R]`) to type decorators without losing the wrapped signature.

---

## `Protocol` for structural interfaces

A `Protocol` states which methods a parameter needs, and any class with those methods qualifies without inheriting from anything.

```python
from typing import Protocol


class SupportsClose(Protocol):
    def close(self) -> None: ...


def shutdown_all(resources: Sequence[SupportsClose]) -> None:
    for r in resources:
        r.close()
```

Add `@runtime_checkable` only when an `isinstance` test is truly needed; it checks method names but not signatures. `data-modeling.md` covers the choice between `Protocol` and `ABC`.

---

## Union syntax

Write `X | Y` and `X | None`. `Union[X, Y]` and `Optional[X]` are the older spellings, and `ruff`'s `UP` rules rewrite them.

```python
# Older spelling
from typing import Optional, Union

def f(x: Optional[int]) -> Union[str, int]: ...

# Current spelling
def f(x: int | None) -> str | int: ...
```

---

## Other patterns worth knowing

| Need | Tool |
|---|---|
| Method returning its own class | `typing.Self` |
| Keyword-only, validated options | `@dataclass(frozen=True, slots=True, kw_only=True)` |
| Override check on subclass methods | `typing.override` (3.12) |
| Required and optional keys in a dict shape | `TypedDict` with `NotRequired` / `Required` |
| Read-only dict view in a signature | `collections.abc.Mapping` |
| Unpacked kwargs typing | `**kwargs: Unpack[MyTypedDict]` |
| Opaque marker for sentinel values | a private `Enum` with one member, matched with `is` |

## Review checklist

1. IDs and unit-bearing numbers use `NewType`.
2. Module constants are `Final`.
3. Closed sets are enums or `Literal`, and every switch over them is exhaustive.
4. No `Any`, `object`, `cast` or `# type: ignore`.
5. Unions use `|`; generics use PEP 695 on 3.12 and newer.
6. Narrowing comes from `isinstance`, `is None`, `match` or a `TypeIs` function.

## Sources

- typing: [NewType](https://docs.python.org/3/library/typing.html#newtype)
- typing: [Final](https://docs.python.org/3/library/typing.html#typing.Final)
- typing: [TypeGuard](https://docs.python.org/3/library/typing.html#typing.TypeGuard)
- PEP 604: [Union syntax X | Y](https://peps.python.org/pep-0604/)
- PEP 695: [Type parameter syntax](https://peps.python.org/pep-0695/)
- PEP 742: [TypeIs](https://peps.python.org/pep-0742/)
