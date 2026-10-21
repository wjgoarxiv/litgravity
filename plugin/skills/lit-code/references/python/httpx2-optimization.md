# httpx2: Production Defaults

[pydantic/httpx2](https://github.com/pydantic/httpx2) is the next-generation HTTP client for Python 3 and the continuation of HTTPX under Pydantic stewardship.

Every network request in this stack goes through `httpx2`, and every optimization below is on from the first line of code. The configuration is the baseline for the whole project, so a bare `httpx2.AsyncClient()` counts as a defect, the way a lint violation would.

Package and API names in this page come from the project's documentation at the time of writing. Check the installed version (`uv pip show httpx2`) and run a one-request smoke test (section 7) before copying the factory into a new codebase; if a keyword differs in the installed release, `help(httpx2.AsyncHTTPTransport)` shows the current signature.

---

## 1. Installation: all extras

```toml
# pyproject.toml
dependencies = [
    "httpx2[http2,brotli,zstd]",
]
```

| Extra | Enables | Reason |
|---|---|---|
| `http2` | HTTP/2 multiplexing through `h2` | one TCP connection carries concurrent requests and avoids head-of-line blocking |
| `brotli` | Brotli content decoding (`br`) | payloads about 20 percent smaller than gzip for text and JSON |
| `zstd` | Zstandard content decoding | quick decompression at ratios close to brotli; part of the standard library from Python 3.14 |
| `socks` | SOCKS5 proxies through `socksio` | add only when traffic goes through a SOCKS proxy |

The three core extras (`http2,brotli,zstd`) always go together. Leaving one out forfeits performance with no compensating benefit.

---

## 2. The standard values

```python
import socket

import httpx2

LIMITS = httpx2.Limits(
    max_connections=200,            # library default 100 limits fan-out
    max_keepalive_connections=40,   # library default 20 forces reconnects
    keepalive_expiry=30.0,          # library default 5s drops warm connections quickly
)

TIMEOUT = httpx2.Timeout(
    connect=5.0,    # TCP and TLS handshake budget
    read=30.0,      # wait for the next response chunk
    write=10.0,     # time to send a request chunk
    pool=10.0,      # wait for a free pooled connection
)

SOCKET_OPTIONS: list[tuple[int, int, int]] = [
    (socket.IPPROTO_TCP, socket.TCP_NODELAY, 1),   # disable Nagle's coalescing delay
]
```

### Reason for each setting

| Setting | Library default | Standard value | Reason |
|---|---|---|---|
| `http2` | `False` | `True` | multiplexing helps every modern API; clients fall back to HTTP/1.1 when ALPN does not offer h2 |
| `max_connections` | 100 | 200 | headroom for fan-out and pool-exhaustion protection |
| `max_keepalive_connections` | 20 | 40 | fewer TLS handshakes between bursts |
| `keepalive_expiry` | 5.0 s | 30.0 s | five seconds drops connections between bursts |
| `Timeout(5.0)` uniform | 5.0 for every phase | split values | connect deserves a short budget, reads a longer one |
| `read` timeout | 5.0 s | 30.0 s | slow APIs and large bodies need room |
| `pool` timeout | 5.0 s | 10.0 s | hitting it signals that `max_connections` needs a review |
| `TCP_NODELAY` | off | on | removes the Nagle delay for small request bodies |
| `retries` | 0 | 3 | the transport retries `ConnectError` and `ConnectTimeout` only, which is safe for any method |
| `follow_redirects` | `False` | `True` | many APIs redirect; set `False` for requests that forward credentials |

---

## 3. Factory functions

Create clients only through these factories. Copy the module into the project (for example `myapp/http.py`) and import from it.

```python
"""httpx2 client factory: create_async_client() and create_client()."""

from __future__ import annotations

import socket
import typing

import httpx2

_LIMITS = httpx2.Limits(
    max_connections=200,
    max_keepalive_connections=40,
    keepalive_expiry=30.0,
)

_TIMEOUT = httpx2.Timeout(connect=5.0, read=30.0, write=10.0, pool=10.0)

_SOCKET_OPTIONS: list[tuple[int, int, int]] = [
    (socket.IPPROTO_TCP, socket.TCP_NODELAY, 1),
]


def create_async_client(
    *,
    base_url: str = "",
    http2: bool = True,
    retries: int = 3,
    limits: httpx2.Limits = _LIMITS,
    timeout: httpx2.Timeout = _TIMEOUT,
    headers: dict[str, str] | None = None,
    event_hooks: dict[str, list[typing.Callable[..., typing.Any]]] | None = None,
    **kwargs: typing.Any,
) -> httpx2.AsyncClient:
    transport = httpx2.AsyncHTTPTransport(
        http2=http2,
        retries=retries,
        limits=limits,
        socket_options=_SOCKET_OPTIONS,
    )
    return httpx2.AsyncClient(
        transport=transport,
        timeout=timeout,
        base_url=base_url,
        headers=headers or {},
        event_hooks=event_hooks or {},
        follow_redirects=True,
        **kwargs,
    )


def create_client(
    *,
    base_url: str = "",
    http2: bool = True,
    retries: int = 3,
    limits: httpx2.Limits = _LIMITS,
    timeout: httpx2.Timeout = _TIMEOUT,
    headers: dict[str, str] | None = None,
    event_hooks: dict[str, list[typing.Callable[..., typing.Any]]] | None = None,
    **kwargs: typing.Any,
) -> httpx2.Client:
    transport = httpx2.HTTPTransport(
        http2=http2,
        retries=retries,
        limits=limits,
        socket_options=_SOCKET_OPTIONS,
    )
    return httpx2.Client(
        transport=transport,
        timeout=timeout,
        base_url=base_url,
        headers=headers or {},
        event_hooks=event_hooks or {},
        follow_redirects=True,
        **kwargs,
    )
```

Usage:

```python
# async: the common case
async with create_async_client(base_url="https://api.example.com") as client:
    response = await client.get("/users")
    response.raise_for_status()

# sync
with create_client() as client:
    response = client.get("https://api.example.com/health")
```

A bare `httpx2.AsyncClient()` leaves HTTP/2, retries and TCP_NODELAY off, keeps connections warm for only five seconds, and applies one uniform timeout. The factories remove all of those.

### Lifecycle

- Create one client per upstream and share it across tasks. A client owns a connection pool, and opening one per request throws away HTTP/2 multiplexing and TLS reuse.
- In a FastAPI app, create the client in the lifespan, store it on `app.state`, and `await client.aclose()` on shutdown (an `async with` around the `yield` does both).
- In a script, wrap the work in `async with create_async_client() as client:`.
- Treat the module that holds the factories as the only place that constructs clients; the no-excuse checks and code review then have a single file to inspect.

---

## 4. Overrides for special cases

The factory defaults serve most callers. Override only with a reason written in a comment.

| Scenario | Override |
|---|---|
| LLM or other long streaming endpoints | `timeout=httpx2.Timeout(connect=10.0, read=None, write=10.0, pool=10.0)`; reads wait for the next chunk |
| Single-host API with low concurrency | `limits=httpx2.Limits(max_connections=50, max_keepalive_connections=20, keepalive_expiry=60.0)` |
| Short-lived one-off requests | `keepalive_expiry=5.0` |
| Unix domain sockets | `httpx2.AsyncHTTPTransport(uds="/path/to/socket", ...)` |
| mutual TLS | pass `verify=ssl_ctx` after `ctx.load_cert_chain(certfile=...)` |
| SOCKS proxy | install `httpx2[socks]` and set `proxy="socks5://..."` |
| per-request override | `await client.get(url, timeout=httpx2.Timeout(60.0))` |
| credentials must stay on the original host | pass `follow_redirects=False` on that call |

### Retries beyond connection errors

Transport retries cover failures before a request is sent. For retrying on 429 or 5xx responses, wrap the call in a small loop with exponential backoff and jitter, honour `Retry-After`, retry only idempotent methods (or requests carrying an idempotency key), and stop after a fixed count:

```python
async def get_json_with_retry(client: httpx2.AsyncClient, url: str, attempts: int = 4) -> JsonValue:
    for attempt in range(attempts):
        response = await client.get(url)
        if response.status_code not in {429, 502, 503, 504} or attempt == attempts - 1:
            response.raise_for_status()
            return response.json()
        delay = float(response.headers.get("Retry-After", 2**attempt * 0.25))
        await anyio.sleep(min(delay, 10.0))
    raise AssertionError("unreachable")   # the loop always returns or raises
```

---

## 5. Event hooks: wire observability

Each production client logs its requests.

```python
import logging
import time

import httpx2

logger = logging.getLogger(__name__)


async def log_request(request: httpx2.Request) -> None:
    request.extensions["request_start"] = time.perf_counter()


async def log_response(response: httpx2.Response) -> None:
    start = response.request.extensions.get("request_start", 0.0)
    logger.info(
        "HTTP %s %s -> %d (%.3fs, %s)",
        response.request.method,
        response.request.url,
        response.status_code,
        time.perf_counter() - start,
        response.http_version,
    )


# Sync variants for httpx2.Client
def log_request_sync(request: httpx2.Request) -> None:
    request.extensions["request_start"] = time.perf_counter()


def log_response_sync(response: httpx2.Response) -> None:
    start = response.request.extensions.get("request_start", 0.0)
    logger.info(
        "HTTP %s %s -> %d (%.3fs, %s)",
        response.request.method,
        response.request.url,
        response.status_code,
        time.perf_counter() - start,
        response.http_version,
    )
```

Register them with `event_hooks={"request": [log_request], "response": [log_response]}`. Automatic status checking:

```python
async def raise_on_error(response: httpx2.Response) -> None:
    response.raise_for_status()
```

Logged URLs contain query strings, so redact tokens (`request.url.copy_with(query=None)`) when secrets travel in parameters. Keep request and response bodies out of the default log. In hooks, read a streamed response with `await response.aread()` before touching `.text` or `.json()`.

---

## 6. Typed responses

Parse every response at the boundary:

```python
class User(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: int
    name: str


async def get_user(client: httpx2.AsyncClient, user_id: int) -> User:
    response = await client.get(f"/users/{user_id}")
    response.raise_for_status()
    return User.model_validate_json(response.content)
```

`model_validate_json(response.content)` skips the intermediate dict that `response.json()` builds. Translate `httpx2.HTTPStatusError` and `httpx2.TransportError` into domain errors at the adapter that wraps the upstream (see `error-handling.md`), so callers never import the HTTP library's exceptions.

For streams use `async with client.stream("GET", url) as response:` and `async for line in response.aiter_lines():`. For uploads, pass `content=` an async iterator and avoid reading the file into memory.

---

## 7. Verification script

Run it against a real endpoint to confirm that the optimizations are active. It measures and leaves the policy decision alone.

```python
"""Compare bare httpx2 defaults against the standard configuration."""

from __future__ import annotations

import socket
import time

import anyio
import httpx2

TARGET_URL = "https://api.example.com/health"
ITERATIONS = 30


async def bench(label: str, client: httpx2.AsyncClient, url: str, n: int) -> float:
    for _ in range(3):   # warm-up
        await client.get(url)
    start = time.perf_counter()
    for _ in range(n):
        response = await client.get(url)
        response.raise_for_status()
    elapsed = time.perf_counter() - start
    avg_ms = elapsed / n * 1000
    print(f"  {label}: {avg_ms:.1f} ms average ({n} requests in {elapsed:.2f} s)")
    return avg_ms


async def main() -> None:
    results: dict[str, float] = {}

    async with httpx2.AsyncClient() as client:
        results["bare-defaults"] = await bench("bare-defaults", client, TARGET_URL, ITERATIONS)

    limits = httpx2.Limits(max_connections=200, max_keepalive_connections=40, keepalive_expiry=30.0)
    timeout = httpx2.Timeout(connect=5.0, read=30.0, write=10.0, pool=10.0)
    transport = httpx2.AsyncHTTPTransport(
        http2=True,
        retries=3,
        limits=limits,
        socket_options=[(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)],
    )
    async with httpx2.AsyncClient(transport=transport, timeout=timeout, follow_redirects=True) as client:
        results["standard"] = await bench("standard", client, TARGET_URL, ITERATIONS)

    baseline = results["bare-defaults"]
    print("\nComparison")
    for label, avg in results.items():
        print(f"  {label}: {avg:.1f} ms ({(avg - baseline) / baseline * 100:+.1f}% against bare defaults)")


if __name__ == "__main__":
    anyio.run(main)
```

Point it at endpoints you are allowed to hit repeatedly. Report the numbers as measured on that network; the ratio varies with latency, server HTTP/2 support and payload size. Print `response.http_version` once to confirm that `HTTP/2` was negotiated.

---

## 8. Testing code that uses the client

```python
def handler(request: httpx2.Request) -> httpx2.Response:
    assert request.url.path == "/users/1"
    return httpx2.Response(200, json={"id": 1, "name": "Ada"})


async def test_get_user_parses_response() -> None:
    transport = httpx2.MockTransport(handler)
    async with httpx2.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await get_user(client, 1)
    assert user.name == "Ada"
```

`MockTransport` runs handlers in process, so tests need no network and exercise request building, response parsing and error mapping. Accept `httpx2.AsyncClient` as a parameter in adapters (dependency injection) to make this swap trivial. Keep a few contract tests against a staging endpoint behind a marker (`@pytest.mark.network`) that CI skips by default.

---

## 9. Reference: all knobs

### `httpx2.AsyncClient` and `httpx2.Client`

| Parameter | Type | Library default | Standard value |
|---|---|---|---|
| `http1` | `bool` | `True` | `True` |
| `http2` | `bool` | `False` | `True` |
| `verify` | `ssl.SSLContext \| str \| bool` | `True` | `True` |
| `cert` | `CertTypes \| None` | `None` | `None` |
| `proxy` | `str \| Proxy \| None` | `None` | `None` |
| `mounts` | `dict[str, Transport]` | `None` | `None` |
| `timeout` | `Timeout \| float \| None` | `Timeout(5.0)` | split 5/30/10/10 |
| `limits` | `Limits` | `Limits(100, 20, 5.0)` | `Limits(200, 40, 30.0)` |
| `follow_redirects` | `bool` | `False` | `True` |
| `max_redirects` | `int` | `20` | `20` |
| `event_hooks` | `dict` | `{}` | logging hooks |
| `base_url` | `str` | `""` | set for single-API clients |
| `trust_env` | `bool` | `True` | `True` |
| `default_encoding` | `str \| Callable` | `"utf-8"` | `"utf-8"` |

### `httpx2.AsyncHTTPTransport` and `httpx2.HTTPTransport`

| Parameter | Type | Library default | Standard value |
|---|---|---|---|
| `http1` | `bool` | `True` | `True` |
| `http2` | `bool` | `False` | `True` |
| `retries` | `int` | `0` | `3` |
| `limits` | `Limits` | `Limits(100, 20, 5.0)` | `Limits(200, 40, 30.0)` |
| `uds` | `str \| None` | `None` | `None` |
| `local_address` | `str \| None` | `None` | `None` |
| `socket_options` | `Iterable[SOCKET_OPTION]` | `None` | `[TCP_NODELAY]` |
| `proxy` | `str \| Proxy \| None` | `None` | `None` |

### `httpx2.Timeout`

| Parameter | Library default | Standard value |
|---|---|---|
| `connect` | 5.0 | 5.0 |
| `read` | 5.0 | 30.0 |
| `write` | 5.0 | 10.0 |
| `pool` | 5.0 | 10.0 |

### `httpx2.Limits`

| Parameter | Library default | Standard value |
|---|---|---|
| `max_connections` | 100 | 200 |
| `max_keepalive_connections` | 20 | 40 |
| `keepalive_expiry` | 5.0 | 30.0 |

### Async backend

The underlying `httpcore2` uses `anyio`, so it runs on asyncio and Trio alike and fits the async stack without extra configuration. For Trio, install `httpcore2[trio]`.

## Pitfalls

| Pattern | Problem | Replacement |
|---|---|---|
| `httpx2.AsyncClient()` inside a request handler | new pool per request, no HTTP/2 reuse | shared client from the lifespan |
| `requests.get(...)` or `aiohttp` | outside the project's single client policy | the factory client |
| `timeout=None` globally | hung requests never finish | split timeouts, `read=None` only for streams |
| retrying non-idempotent POSTs | duplicate side effects | idempotency keys, or retry connect errors only |
| `response.json()` on unvalidated shapes | untyped data enters the program | `Model.model_validate_json(response.content)` |
| logging full URLs with tokens in the query | credential leak | redact the query |

## Sources

- httpx2 repository: <https://github.com/pydantic/httpx2>
- HTTPX documentation (the API it continues): <https://www.python-httpx.org>
- HTTP/2 explained: <https://http2-explained.haxx.se>
