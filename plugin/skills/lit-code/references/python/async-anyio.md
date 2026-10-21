# AnyIO Reference: Structured Concurrency Instead of asyncio Idioms

Rule for this stack: async code imports `anyio` and leaves `import asyncio` to the few places where a library forces it (marked `# noqa: ANYIO_OK` with a reason). This page targets AnyIO 4.x. Check the installed version with `uv run python -c "import anyio; print(anyio.__version__)"` before relying on a feature that names a minimum version.

---

## 1. Task groups

A task group is an async context manager that guarantees every child task has finished (or been cancelled) before the block exits. Tasks cannot leak, and exceptions cannot vanish.

### `start_soon`: launch and continue

```python
import anyio


async def worker(n: int) -> None:
    await anyio.sleep(1)
    print(f"task {n} done")


async def main() -> None:
    async with anyio.create_task_group() as tg:
        for i in range(3):
            tg.start_soon(worker, i)
    print("all tasks finished")


anyio.run(main)
```

Signature: `tg.start_soon(func, *args, name=None)`.

- `func` is a coroutine function, and the arguments follow separately. Pass `worker, i`, never `worker(i)`.
- `name` labels the task in debuggers and logs.
- The call returns nothing. A failure cancels the siblings and surfaces as an `ExceptionGroup` when the block exits.

### `start`: wait for a readiness signal

Use it when a task must finish initializing before the caller continues, for example starting a server and then connecting to it.

```python
import anyio
from anyio import TASK_STATUS_IGNORED, create_task_group
from anyio.abc import TaskStatus


async def start_server(port: int, *, task_status: TaskStatus[None] = TASK_STATUS_IGNORED) -> None:
    listener = await anyio.create_tcp_listener(local_host="127.0.0.1", local_port=port)
    task_status.started()          # unblocks tg.start()
    await listener.serve(handler)


async def main() -> None:
    async with create_task_group() as tg:
        await tg.start(start_server, 8080)
        # the listener is ready here
        async with await anyio.connect_tcp("127.0.0.1", 8080) as client:
            ...
        tg.cancel_scope.cancel()   # stop the server when finished


anyio.run(main)
```

Choose `start_soon` when readiness is irrelevant, and `start` when a later step depends on it. `task_status.started(value)` can hand a value back to the caller (a bound port, for instance), which `tg.start` returns.

### Collecting results

`tg.create_task(coro)` (AnyIO 4.14 and newer) returns a handle that can be awaited for the task's value:

```python
async def add(x: int, y: int) -> int:
    return x + y


async def main() -> None:
    async with anyio.create_task_group() as tg:
        handle = tg.create_task(add(2, 4))
        result = await handle            # 6
```

Awaiting a failed handle raises `TaskFailed` (or `TaskCancelled`). On earlier 4.x releases collect results with a small helper that writes into a pre-sized list:

```python
async def gather[T](*calls: Callable[[], Awaitable[T]]) -> list[T]:
    results: list[T | None] = [None] * len(calls)

    async def run(i: int, call: Callable[[], Awaitable[T]]) -> None:
        results[i] = await call()

    async with anyio.create_task_group() as tg:
        for i, call in enumerate(calls):
            tg.start_soon(run, i, call)
    return [r for r in results if r is not None]   # use a sentinel when None is a valid result
```

Every task group joins its children before returning, so this helper has no leak window.

---

## 2. asyncio to AnyIO map

| asyncio | AnyIO | Notes |
|---|---|---|
| `asyncio.gather(a, b, c)` | task group with `create_task` or the helper above | structured concurrency needs an explicit scope |
| `asyncio.create_task(coro)` | `tg.start_soon(func, *args)` or `tg.create_task(coro)` | `start_soon` takes a function plus arguments; `create_task` takes a coroutine object |
| `asyncio.sleep(n)` | `anyio.sleep(n)` | same meaning |
| `asyncio.wait_for(coro, t)` | `with anyio.fail_after(t): await coro` | raises `TimeoutError`; `move_on_after` times out quietly |
| `asyncio.Event()` | `anyio.Event()` | events are one-shot; create a new one instead of `.clear()` |
| `asyncio.Lock()` | `anyio.Lock()` | `async with lock:`; `fast_acquire=True` for hot paths |
| `asyncio.Semaphore(n)` | `anyio.Semaphore(n)` | `fast_acquire=True` available |
| `asyncio.Condition()` | `anyio.Condition()` | same semantics |
| `asyncio.run(main())` | `anyio.run(main)` | backend-agnostic entry point |
| `asyncio.Queue(maxsize=N)` | `anyio.create_memory_object_stream[T](max_buffer_size=N)` | returns a send and a receive stream |
| `asyncio.to_thread(fn, *a)` | `anyio.to_thread.run_sync(fn, *a)` | supports `abandon_on_cancel=True` and a custom `limiter` |
| `asyncio.run_coroutine_threadsafe` | `anyio.from_thread.run(func, *args)` | async call from a worker thread |
| `loop.call_soon_threadsafe` | `anyio.from_thread.run_sync(func, *args)` | sync call on the loop thread, with a return value |
| `asyncio.shield(coro)` | `with anyio.CancelScope(shield=True): ...` | shielding does not orphan tasks |
| `asyncio.timeout(d)` | `with anyio.fail_after(d): ...` | level cancellation instead of edge cancellation |
| `asyncio.CancelledError` | `anyio.get_cancelled_exc_class()` | portable across backends |
| `asyncio.Semaphore` as a concurrency gate | `anyio.CapacityLimiter(n)` | named limiter with borrow tracking |
| `loop.add_signal_handler` | `anyio.open_signal_receiver(...)` | async iterator of signals |
| `asyncio.create_subprocess_exec` | `anyio.run_process` / `anyio.open_process` | no event-loop internals needed |
| `open(...)` in async code | `anyio.open_file`, `anyio.Path` | file I/O off the loop thread |

---

## 3. Cancellation and `CancelScope`

AnyIO uses level cancellation, as Trio does. While a task sits inside a cancelled scope, every checkpoint raises a fresh cancellation exception. asyncio's edge cancellation injects the exception once, and a task that swallows it keeps running.

### Basic scope

```python
from anyio import create_task_group, get_cancelled_exc_class, run, sleep


async def worker() -> None:
    try:
        await sleep(10)
    except get_cancelled_exc_class():
        print("cancelled")
        raise                          # always re-raise cancellation


async def main() -> None:
    async with create_task_group() as tg:
        tg.start_soon(worker)
        await sleep(0.1)
        tg.cancel_scope.cancel()       # cancels every child


run(main)
```

A handler for the cancellation exception always ends in `raise`. Swallowing it breaks timeouts and task-group shutdown.

### Shielding cleanup

A shielded scope protects a block from outside cancellation, which cleanup code needs:

```python
from anyio import CancelScope, move_on_after


async def do_something(resource: Resource) -> None:
    try:
        await run_async_stuff()
    except BaseException:                       # noqa: BROAD_EXCEPT_OK
        with move_on_after(10, shield=True):    # up to 10 seconds of cleanup
            await resource.aclose()
        raise
```

The `except BaseException` above re-raises right after cleanup, which is the allowed shape for a broad catch. Prefer `try/finally` with a shielded scope when no exception inspection is needed:

```python
try:
    await run_async_stuff()
finally:
    with CancelScope(shield=True):
        await resource.aclose()
```

### Task group guarantee

A task group owns a `CancelScope`. When a child raises:

1. the group's scope is cancelled,
2. every other child receives cancellation,
3. the group waits for all children to finish,
4. the original exception (wrapped in an `ExceptionGroup` when several failed) propagates.

---

## 4. Timeouts

Both helpers create a `CancelScope`.

```python
from anyio import fail_after, move_on_after, run, sleep


async def strict() -> None:
    try:
        with fail_after(5) as scope:
            await sleep(10)
    except TimeoutError:
        print("timed out", scope.cancelled_caught)    # True


async def lenient() -> None:
    with move_on_after(5) as scope:
        await sleep(10)
        print("never printed")
    print("left the scope, cancelled =", scope.cancelled_caught)
```

`fail_after` raises `TimeoutError`, and `move_on_after` leaves the block silently and sets `cancelled_caught`. Prefer deadlines on the outermost operation that matters (a whole request) over many small inner timeouts, and use `anyio.current_effective_deadline()` to see the remaining budget when handing work to a callee.

---

## 5. Memory object streams (the queue replacement)

```python
from anyio import create_memory_object_stream, create_task_group, run
from anyio.streams.memory import MemoryObjectReceiveStream


async def consumer(stream: MemoryObjectReceiveStream[str]) -> None:
    async with stream:                  # closes the receive end on exit
        async for item in stream:
            print("received", item)


async def main() -> None:
    send_stream, receive_stream = create_memory_object_stream[str](max_buffer_size=10)

    async with create_task_group() as tg:
        tg.start_soon(consumer, receive_stream)
        async with send_stream:
            for i in range(5):
                await send_stream.send(f"item {i}")
        # closing the send end ends the consumer's loop


run(main)
```

Differences from `asyncio.Queue`:

- **Back-pressure by default.** `max_buffer_size=0` makes `send` wait until a receiver takes the item; pick a positive size to allow a bounded buffer. `float("inf")` removes the bound and should be a conscious choice.
- **Cloneable ends.** `send_stream.clone()` gives each producer its own handle. The stream ends when all clones of one end are closed.
- **Async iteration.** `async for item in receive_stream` is built in.
- **Generic typing.** `create_memory_object_stream[T]()` gives typed ends.
- **Synchronous close.** `close()` and `async with` both work.

For fan-out workers, create one stream, clone the receive end per worker, and let each worker loop over its clone.

---

## 6. Limiting concurrency

```python
limiter = anyio.CapacityLimiter(10)


async def fetch_one(client: httpx2.AsyncClient, url: str) -> bytes:
    async with limiter:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


async def fetch_all(client: httpx2.AsyncClient, urls: Sequence[str]) -> None:
    async with anyio.create_task_group() as tg:
        for url in urls:
            tg.start_soon(fetch_one, client, url)
```

`CapacityLimiter` also bounds thread offloading: `anyio.to_thread.run_sync(fn, limiter=thread_limiter)`. The default thread limiter holds 40 tokens, so raise it deliberately for blocking-heavy services. A fixed pool of workers reading a stream gives the same cap with a flat memory profile for very large inputs.

---

## 7. Backends

AnyIO code runs on asyncio and Trio.

```python
import anyio


async def main() -> None:
    print("running on", anyio.current_async_library())
    await anyio.sleep(1)


anyio.run(main)                                                   # default: asyncio
anyio.run(main, backend="trio")
anyio.run(main, backend="asyncio", backend_options={"debug": True})
```

Library design rule: leave the backend choice to the application's `anyio.run()` call, and import only `anyio` APIs.

For services, `uvicorn` (FastAPI) runs the loop; AnyIO code inside handlers needs no extra setup. Install `uvloop` through `uvicorn[standard]` for a faster default loop, and pass `backend_options={"use_uvloop": True}` to `anyio.run` in scripts.

---

## 8. Testing

```python
import pytest

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


async def test_worker_finishes_within_deadline() -> None:
    with anyio.fail_after(1):
        await worker(1)
```

AnyIO ships a pytest plugin: mark tests with `pytest.mark.anyio` and provide the `anyio_backend` fixture (return `"asyncio"` or parametrize over `["asyncio", "trio"]`). `async` fixtures work directly. Control time with a short real timeout, or restructure code so the clock is a parameter. Wrap anything that could hang in `fail_after`, so a bug fails fast instead of stalling CI.

---

## 9. Compatibility with asyncio-only libraries

Under the asyncio backend, awaitables from asyncio-only libraries work because AnyIO runs on the asyncio event loop:

```python
import anyio
import some_asyncio_only_lib


async def main() -> None:
    result = await some_asyncio_only_lib.fetch_data()


anyio.run(main, backend="asyncio")
```

This works on the asyncio backend only, and the Trio backend rejects asyncio-native objects. Wrap such libraries in a small adapter module, mark the one `import asyncio` line with `# noqa: ANYIO_OK` and a reason, and document that the feature requires the asyncio backend.

Where no AnyIO equivalent exists:

| Scenario | asyncio API | AnyIO approach |
|---|---|---|
| Signal handlers | `loop.add_signal_handler()` | `anyio.open_signal_receiver()` |
| Custom protocols | `asyncio.Protocol` | AnyIO streams and sockets |
| Raw futures | `asyncio.Future` | AnyIO primitives (events, streams) |
| Eager task factories | `asyncio.eager_task_factory` | experimental; avoid |

---

## 10. Idioms

### Parallel work with a shared deadline

```python
async def fetch_all(urls: Sequence[str]) -> None:
    with anyio.move_on_after(5):
        async with anyio.create_task_group() as tg:
            for url in urls:
                tg.start_soon(fetch, url)
```

The `move_on_after` scope surrounds the task group, so the deadline cancels the group and the group joins its children before the scope exits. Placing the scope inside the group would leave children running past the deadline.

### Producer and consumer

```python
async def producer(send_stream: MemoryObjectSendStream[int]) -> None:
    async with send_stream:
        for i in range(100):
            await send_stream.send(i)


async def consumer(receive_stream: MemoryObjectReceiveStream[int]) -> None:
    async with receive_stream:
        async for item in receive_stream:
            print(f"consumed {item}")


async def main() -> None:
    send, receive = anyio.create_memory_object_stream[int](max_buffer_size=5)
    async with anyio.create_task_group() as tg:
        tg.start_soon(producer, send)
        tg.start_soon(consumer, receive)
```

### Blocking code from async

```python
result = await anyio.to_thread.run_sync(parse_big_file, path)
```

Pass `abandon_on_cancel=True` only when the thread can be left running safely after cancellation.

### Async code from a worker thread

```python
def blocking_callback() -> None:
    anyio.from_thread.run(anyio.sleep, 1)
    anyio.from_thread.run_sync(print, "hello from thread")


async def main() -> None:
    await anyio.to_thread.run_sync(blocking_callback)
```

From plain synchronous code (a CLI wrapper, a Django view) use `with anyio.from_thread.start_blocking_portal() as portal: portal.call(async_fn, arg)`.

### Graceful shutdown on signals

```python
async def main() -> None:
    async with anyio.create_task_group() as tg:
        tg.start_soon(serve)
        with anyio.open_signal_receiver(signal.SIGINT, signal.SIGTERM) as signals:
            async for sig in signals:
                logger.info("received %s, shutting down", sig.name)
                tg.cancel_scope.cancel()
                return
```

### Subprocesses

```python
result = await anyio.run_process(["git", "rev-parse", "HEAD"], check=True)
head = result.stdout.decode().strip()
```

### Files

```python
path = anyio.Path("input.json")
text = await path.read_text()
async with await anyio.open_file(path, "rb") as f:
    chunk = await f.read(65536)
```

### Exception groups

```python
try:
    async with anyio.create_task_group() as tg:
        tg.start_soon(fetch_a)
        tg.start_soon(fetch_b)
except* httpx2.HTTPStatusError as group:
    for exc in group.exceptions:
        logger.error("upstream %d", exc.response.status_code)
```

Task groups always raise `ExceptionGroup`, even for one failure (AnyIO 4), so handlers use `except*`.

---

## Pitfalls

| Pattern | Problem | Replacement |
|---|---|---|
| `tg.start_soon(worker(i))` | passes a coroutine object | `tg.start_soon(worker, i)` |
| catching the cancellation exception without `raise` | task survives cancellation, timeouts break | re-raise always |
| creating tasks outside a group | orphaned work, lost errors | `async with create_task_group()` |
| unbounded `max_buffer_size` | memory growth under a slow consumer | bounded buffer |
| `time.sleep()` in a coroutine | blocks the loop | `await anyio.sleep()` |
| blocking file or DNS calls in handlers | stalls other requests | `anyio.to_thread.run_sync` or `anyio.Path` |
| reusing an `anyio.Event` after `set()` | events are one-shot | create a new event |
| `try/except Exception` around awaited code | hides cancellation and task-group errors | catch specific exceptions |

## Sources

- AnyIO documentation: https://anyio.readthedocs.io/en/stable/
- AnyIO repository: https://github.com/agronholm/anyio
- Tasks: https://anyio.readthedocs.io/en/stable/tasks.html
- Cancellation and timeouts: https://anyio.readthedocs.io/en/stable/cancellation.html
- Streams: https://anyio.readthedocs.io/en/stable/streams.html
- Synchronization: https://anyio.readthedocs.io/en/stable/synchronization.html
- Threads: https://anyio.readthedocs.io/en/stable/threads.html
- Testing: https://anyio.readthedocs.io/en/stable/testing.html
- Design rationale: https://anyio.readthedocs.io/en/stable/why.html
