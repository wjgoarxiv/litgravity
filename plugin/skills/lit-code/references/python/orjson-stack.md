# orjson: When to Adopt It and How to Integrate It

`orjson` is a Rust-backed JSON library for Python. Public benchmarks show it serializing several times faster than the standard `json` module and deserializing 1.5 to 4 times faster, with native support for `datetime`, `date`, `UUID`, dataclasses and `numpy` arrays. The standard library rejects those types or needs a custom encoder for them.

Not every project benefits. Section 1 decides whether to adopt it, and the later sections give production patterns for projects that do.

---

## 1. Decision tree

```text
Is JSON encoding or decoding on a hot path?
  no  -> the standard json module is fine. Stop here.
  yes -> continue

Is the project FastAPI?
  yes -> Is the response fully described by a Pydantic v2 model?
           yes -> return the model and let FastAPI serialize it through pydantic-core.
                  orjson adds nothing on that route.
           no  -> endpoints returning dicts, lists or arbitrary structures benefit from
                  ORJSONResponse.
  no  -> continue

Serializing Pydantic v2 models repeatedly?
  yes -> use model.model_dump_json() (pydantic-core, Rust). It stays close to orjson
         speed and honours aliases, computed fields and validators.
  no  -> continue

Serializing dicts, lists, dataclasses, datetime or UUID?
  yes -> orjson.
  no  -> the standard json module.
```

With Pydantic v2, Pydantic-shaped data no longer needs orjson. The remaining gains sit in code that moves dicts, lists, dataclasses and numpy data through caches, queues, logs and untyped endpoints.

---

## 2. Install

```toml
# pyproject.toml
dependencies = [
    "orjson>=3.10",
]
```

Wheels exist for current CPython versions on macOS, Linux (glibc and musl), Windows and ARM64, so installation needs no compiler.

---

## 3. Basic use

```python
from datetime import UTC, datetime

import orjson

raw: bytes = orjson.dumps({"hello": "world", "ts": datetime.now(UTC)})
data = orjson.loads(raw)
```

Two facts to internalize:

1. `orjson.dumps` returns `bytes`. The standard `json.dumps` returns `str`. Bytes suit sockets, binary files and HTTP bodies, and skipping the encode step is part of the speedup. Decode only when a `str` is required (`raw.decode()`).
2. Formatting is limited. `OPT_INDENT_2` is the only indentation option. Use the standard library when another layout matters.

`orjson.loads` accepts `bytes`, `bytearray`, `memoryview` and `str`. Passing bytes directly avoids a decode step.

---

## 4. Option flags

```python
orjson.dumps(
    payload,
    option=(
        orjson.OPT_NAIVE_UTC            # treat naive datetimes as UTC
        | orjson.OPT_UTC_Z              # render UTC as "Z" rather than "+00:00"
        | orjson.OPT_NON_STR_KEYS       # allow int, UUID and datetime dict keys
        | orjson.OPT_SERIALIZE_NUMPY    # numpy arrays and scalars natively
        # | orjson.OPT_SORT_KEYS        # deterministic output, slower
        # | orjson.OPT_INDENT_2         # human-readable output, slower
    ),
)
```

Notes on specific flags:

- `OPT_NAIVE_UTC | OPT_UTC_Z` produces RFC 3339 timestamps that every parser accepts. Without `OPT_NAIVE_UTC`, a naive `datetime` serializes without an offset, and the receiver has to guess the zone. Timezone-aware datetimes remain the better habit (`datetime.now(UTC)`).
- Dataclasses, `datetime`, `date`, `time` and `UUID` serialize natively in current releases. The older `OPT_SERIALIZE_DATACLASS` and `OPT_SERIALIZE_UUID` flags are deprecated no-ops, so leave them out of new code.
- `OPT_PASSTHROUGH_DATACLASS`, `OPT_PASSTHROUGH_DATETIME` and `OPT_PASSTHROUGH_SUBCLASS` route those types through the `default=` callable instead.
- `OPT_STRICT_INTEGER` limits integers to 53 bits (the range JavaScript clients can round-trip). Without it, orjson encodes 64-bit integers and raises `JSONEncodeError` beyond 64 bits. Send larger values as strings.
- `OPT_APPEND_NEWLINE` adds a trailing newline, handy for NDJSON.

Flags are opt-in because orjson defaults to strict JSON.

---

## 5. orjson with FastAPI

### 5.1 `ORJSONResponse`

```python
from fastapi import FastAPI
from fastapi.responses import ORJSONResponse

app = FastAPI(default_response_class=ORJSONResponse)


@app.get("/items")
async def get_items() -> dict[str, list[dict[str, int]]]:
    return {"items": [{"id": i, "qty": i * 2} for i in range(1000)]}
```

`default_response_class=ORJSONResponse` swaps the response encoder for orjson. Request parsing still goes through Pydantic. FastAPI's own documentation increasingly steers typed endpoints towards Pydantic serialization, so read the installed release's notes for deprecation warnings on `ORJSONResponse` and be ready to drop the class on endpoints that return models.

### 5.2 Pydantic v2 versus orjson

With a recent FastAPI on Pydantic v2:

- An endpoint annotated with a Pydantic return type or `response_model` is serialized with `model_dump_json()` in pydantic-core. A default `ORJSONResponse` does not change that path.
- An endpoint returning raw `dict`, `list` or other Python objects uses the response class, so `ORJSONResponse` saves real time there.

Community benchmarks (the discussion linked in the sources) found `model_dump_json()` roughly 10 to 15 percent faster than `ORJSONResponse` over `model_dump()` for model-shaped bodies. Mixed APIs keep `ORJSONResponse` as the default and let typed endpoints use Pydantic's path. Measure your own payloads before changing a global setting.

### 5.3 Recommended setup

```python
app = FastAPI(
    default_response_class=ORJSONResponse,   # helps dict and list returns
    # Pydantic-typed returns keep using pydantic-core serialization
)
```

Return the model, and skip wrapping it manually:

```python
# Extra hop: model to dict to orjson
@app.get("/users/{id}", response_class=ORJSONResponse)
async def get_user_slow(id: int) -> ORJSONResponse:
    user = await fetch_user(id)
    return ORJSONResponse(content=user.model_dump())


# Let FastAPI serialize the model
@app.get("/users/{id}")
async def get_user(id: int) -> User:
    return await fetch_user(id)
```

### 5.4 Streaming

`ORJSONResponse` builds the whole body in memory. For SSE, NDJSON or chunked JSON, use `StreamingResponse` and encode each chunk:

```python
import orjson
from fastapi.responses import StreamingResponse


async def ndjson_stream() -> AsyncIterator[bytes]:
    async for row in fetch_rows():
        yield orjson.dumps(row, option=orjson.OPT_APPEND_NEWLINE)


@app.get("/export")
async def export() -> StreamingResponse:
    return StreamingResponse(ndjson_stream(), media_type="application/x-ndjson")
```

Per-chunk encoding in a tight loop is where orjson pays off, with no buffering of the full result.

---

## 6. orjson with Pydantic v2 outside FastAPI

```python
from datetime import UTC, datetime

import orjson
from pydantic import BaseModel


class User(BaseModel):
    id: int
    email: str
    created: datetime


user = User(id=1, email="a@b.com", created=datetime.now(UTC))

# A: Pydantic's own Rust serializer (default choice)
raw: bytes = user.model_dump_json().encode()

# B: orjson at the container level, with a bridge for the models inside it
raw = orjson.dumps(
    {"user": user, "count": 1},
    default=lambda obj: obj.model_dump(mode="json") if isinstance(obj, BaseModel) else None,
)
```

For one model, option A is as fast and supports aliases, computed fields and `json_schema_extra`. Option B fits dicts or lists that contain models next to other types. Pydantic's `TypeAdapter(list[User]).dump_json(users)` serializes a list of models in one call without any bridge.

### A shared `default=` callback

```python
from decimal import Decimal

import orjson
from pydantic import BaseModel


def json_default(obj: BaseModel | Decimal | set[str]) -> dict[str, object] | str | list[str]:
    match obj:
        case BaseModel():
            return obj.model_dump(mode="json")
        case Decimal():
            return str(obj)
        case set():
            return sorted(obj)
        case unreachable:
            assert_never(unreachable)


def dumps(payload: JsonValue) -> bytes:
    return orjson.dumps(payload, default=json_default, option=orjson.OPT_NAIVE_UTC | orjson.OPT_UTC_Z)
```

The callback runs for each value of an unsupported type and should raise `TypeError` (as `assert_never` does at runtime) for types it cannot handle, which orjson reports as a `JSONEncodeError`. Keep the union in the signature in sync with the cases, so the type checker covers the callback too. One module-level `dumps` function keeps options consistent across the project.

---

## 7. Caches, queues and logs

These paths have no Pydantic in the loop, which makes them the clearest wins.

### Redis cache

```python
import orjson
import redis.asyncio as redis

r = redis.from_url("redis://localhost")


async def set_cache(key: str, value: JsonValue) -> None:
    await r.set(key, orjson.dumps(value), ex=3600)


async def get_cache(key: str) -> JsonValue | None:
    raw = await r.get(key)
    return orjson.loads(raw) if raw else None
```

The serialize step becomes several times cheaper for typical cache payloads, and the savings scale with the request rate. Prefix keys with a schema version (`user:v2:42`), so a payload format change never reads stale entries.

### Task queues (Celery, RQ, dramatiq)

```python
from kombu.serialization import register

import orjson


def _dumps(obj: JsonValue) -> str:
    return orjson.dumps(obj, option=orjson.OPT_NAIVE_UTC | orjson.OPT_UTC_Z).decode()


def _loads(s: str | bytes) -> JsonValue:
    return orjson.loads(s)


register("orjson", _dumps, _loads, content_type="application/x-orjson", content_encoding="utf-8")
```

Set the broker's `task_serializer`, `result_serializer` and `accept_content` to the new name. Both ends of the queue must agree on the format before the change reaches production.

### Structured logging

```python
import orjson
import structlog

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(serializer=lambda obj, **kw: orjson.dumps(obj).decode()),
    ],
)
```

`JSONRenderer` accepts any callable that returns text, and `orjson.dumps(...).decode()` fits. Logging at info level on busy paths gets noticeably cheaper per line. Redact secrets before they reach the renderer.

---

## 8. Gotchas

### `dumps` returns bytes

```python
log.info("payload: " + orjson.dumps(data))             # TypeError: str + bytes
log.info("payload: %s", orjson.dumps(data).decode())   # correct
```

### Custom encoders use `default=`

orjson has no `cls=` argument. Port the `default()` method of a custom `JSONEncoder` into a function and pass it as `default=`.

### Subclasses of builtin containers

```python
class StrictDict(dict[str, str]): ...


d = StrictDict({"k": "v"})
json.dumps(d)       # works: the standard module walks subclasses
orjson.dumps(d)     # TypeError by design
orjson.dumps(d, default=dict, option=orjson.OPT_PASSTHROUGH_SUBCLASS)   # route through default=
```

### Large integers

Stdlib `json` writes integers of any size, and orjson stops at 64 bits. JavaScript clients lose precision above 2^53, so send identifiers that large as strings and use `OPT_STRICT_INTEGER` in APIs consumed by browsers.

### Naive datetimes

Always set `OPT_NAIVE_UTC` for application payloads, or keep datetimes timezone-aware throughout (ruff's `DTZ` rules enforce this).

### NaN and Infinity

orjson serializes `float("nan")` as `null`, where the standard module emits a bare `NaN` that other parsers reject. Decide on a representation (drop the field, send a string) before data reaches the encoder.

### Strict parsing

`orjson.loads` rejects comments, trailing commas, single quotes and bare `NaN`. Inputs from hand-written files may need the standard library or a cleaning step.

---

## 9. Benchmarks

Indicative ratios from orjson's published suite and the FastAPI community benchmarks, for modern x86-64 on recent CPython. Rerun on your hardware with `pytest-benchmark` or `timeit` for your payload shapes before making decisions:

| Payload | stdlib `json` | `orjson` | `model_dump_json()` |
|---|---|---|---|
| Small dict (about 100 fields) | 1.0x | about 8x | n/a |
| List of 10,000 dicts | 1.0x | about 11x | n/a |
| Pydantic model, 20 fields | 1.0x (after `model_dump()`) | about 5x with the `default=` bridge | about 6x |
| Datetime-heavy payload | 1.0x (after manual ISO conversion) | about 9x | about 6x |
| numpy array, 1M floats | needs manual `tolist()` | much faster than `json` plus `tolist()` | n/a |

Conclusions that hold across versions:

- Dicts, lists and datetimes encode much faster with orjson.
- Pydantic models are already fast through `model_dump_json()`.
- numpy data is where orjson has no real competitor in the standard stack.

On mixed-payload FastAPI services, measured end-to-end gains tend to show up as a modest reduction in tail latency. The change costs one line (`default_response_class=ORJSONResponse`), so a before-and-after load test is cheap insurance.

A minimal measurement:

```python
import json
import timeit

import orjson

payload = {"items": [{"id": i, "name": f"item-{i}"} for i in range(10_000)]}
print("json   ", timeit.timeit(lambda: json.dumps(payload), number=50))
print("orjson ", timeit.timeit(lambda: orjson.dumps(payload), number=50))
```

---

## 10. When orjson is the wrong choice

- JSON is not a bottleneck and the project is small.
- The code relies on stdlib `json` features: `cls=` encoders, lax acceptance of `NaN`, comments in input, arbitrary indentation.
- The target platform has no wheels (MicroPython, unusual architectures).
- The only JSON work is serializing Pydantic models, where `model_dump_json()` already wins.

When none of those apply, adding a dependency that speeds up serialization several times at no code cost is an easy decision.

## Sources

- orjson: https://github.com/ijl/orjson
- Pydantic serialization: https://docs.pydantic.dev/latest/concepts/serialization/
- FastAPI custom responses: https://fastapi.tiangolo.com/advanced/custom-response/
- FastAPI orjson versus Pydantic v2 discussion: https://github.com/fastapi/fastapi/discussions/11728
- structlog `JSONRenderer`: https://www.structlog.org/en/stable/api.html#structlog.processors.JSONRenderer
