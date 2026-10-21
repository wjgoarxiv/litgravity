# Async with Tokio

Structured concurrency, cancellation, isolating blocking work and choosing channels. These are the defaults an agent reaches for before inventing anything.

## Runtime selection

```rust
// Services and CLIs that do real work
#[tokio::main(flavor = "multi_thread", worker_threads = 8)]
async fn main() -> anyhow::Result<()> {
    run().await
}

// Tiny tools, or targets where one thread was measured sufficient
#[tokio::main(flavor = "current_thread")]
async fn main() -> anyhow::Result<()> {
    run().await
}
```

Set the worker count on purpose. The default (one worker per core) suits servers; desktop tools often want two to four. Features: `tokio = { version = "1", features = ["rt-multi-thread", "macros", "time", "sync", "signal", "fs", "net"] }` narrows compile time compared with `"full"`; use `"full"` in applications where simplicity wins.

## Spawning

`tokio::spawn` returns a `JoinHandle<T>` and the task keeps running when the handle is dropped. Structured concurrency comes from `JoinSet`, which owns its tasks:

```rust
use tokio::task::JoinSet;

let mut set = JoinSet::new();
for url in urls {
    let client = client.clone();
    set.spawn(async move { fetch(&client, &url).await });
}

let mut bodies = Vec::new();
while let Some(joined) = set.join_next().await {
    match joined {
        Ok(Ok(body)) => bodies.push(body),
        Ok(Err(error)) => tracing::warn!(%error, "fetch failed"),
        Err(join_error) if join_error.is_panic() => {
            tracing::error!(?join_error, "worker panicked");
            // Decide: re-raise with std::panic::resume_unwind, or continue degraded
        }
        Err(join_error) => tracing::error!(?join_error, "worker cancelled"),
    }
}
```

What `JoinSet` provides:

- It reports when every spawned task has finished.
- Dropping the set aborts all tasks still running, so no work outlives its owner.
- Each failure surfaces individually, which allows partial results.
- `set.abort_all()` and `set.shutdown().await` stop the group deliberately.

Wait for all with `join!` when the futures have fixed, known types:

```rust
let (a, b, c) = tokio::join!(load_a(), load_b(), load_c());
let (a, b, c) = (a?, b?, c?);
```

`tokio::try_join!` returns early on the first `Err`.

Race with `select!`:

```rust
tokio::select! {
    biased; // poll branches top to bottom when priority matters
    _ = shutdown.recv() => {
        tracing::info!("shutdown signal");
        return Ok(());
    }
    accepted = listener.accept() => {
        handle(accepted?).await?;
    }
}
```

Without `biased`, branches are polled in random order, which prevents starvation. Add `biased` only when order is the requirement (the shutdown signal wins ties).

## Cancellation

A future is cancelled by being dropped, for example when another `select!` branch completes first. Ask of every `.await`: if this future is dropped here, what state remains?

Cancel-safe operations (dropping loses nothing):

- `mpsc::Receiver::recv`, `broadcast::Receiver::recv`, `watch::Receiver::changed`
- `TcpListener::accept`
- `AsyncReadExt::read` and `read_buf`, `AsyncWriteExt::write`
- `tokio::time::sleep` and `interval.tick()`

Operations that are not cancel-safe (dropping can lose data or leave partial writes):

- `AsyncReadExt::read_exact`, `read_to_end`, `read_line`
- `AsyncWriteExt::write_all`
- Hand-written futures that perform side effects before their first suspension point

`mpsc::Sender::send` is cancel-safe in that nothing is sent when it is dropped, but the moved message is gone with it; call `reserve().await` first when the message must survive a lost race, then send through the permit.

Document the exceptions in rustdoc under a `# Cancel safety` heading. To take an operation out of a `select!` race, create the future first and poll it by reference with `&mut fut` and `tokio::pin!`.

For cooperative shutdown across a task tree, use `CancellationToken`:

```rust
use tokio_util::sync::CancellationToken;

let token = CancellationToken::new();
let child = token.child_token();
tokio::spawn(async move {
    tokio::select! {
        _ = child.cancelled() => { /* release resources */ }
        result = work() => { /* normal completion */ }
    }
});
// later
token.cancel();
```

Hand child tokens down the call tree so cancelling the root stops everything below it.

## Timeouts

```rust
use tokio::time::{timeout, Duration};

match timeout(Duration::from_secs(5), fetch(url)).await {
    Ok(Ok(body)) => Ok(body),
    Ok(Err(error)) => Err(error.into()),
    Err(_elapsed) => Err(anyhow::anyhow!("timed out fetching {url}")),
}
```

Every external boundary gets a timeout. "Wait forever" is a latent outage. Timeouts compose with cancellation: when the timer wins, the inner future is dropped, so the cancel-safety rules above apply to it.

## Blocking work

Blocking inside an async task stalls every other task on that worker. Symptoms: latency cliffs, stuck futures, deadlock on a `current_thread` runtime.

Short CPU-bound or synchronous I/O work moves to `spawn_blocking`:

```rust
let digest = tokio::task::spawn_blocking(move || {
    // parsing, hashing, image work, rusqlite, OS calls without async wrappers
    expensive_pure_computation(&data)
})
.await?;
```

Jobs that run longer than about a second of CPU belong on a dedicated pool such as `rayon`, since Tokio's blocking pool is sized for short bursts. Bridge back with a `oneshot` channel:

```rust
let (tx, rx) = tokio::sync::oneshot::channel();
rayon::spawn(move || {
    let _ = tx.send(heavy_job());
});
let result = rx.await?;
```

Never call `Runtime::block_on` or `futures::executor::block_on` from inside an async context.

## Channels

| Need | Use |
|---|---|
| Many producers, one consumer, async | `tokio::sync::mpsc::channel(cap)` |
| Same, with sync and async ends | `flume::bounded(cap)` |
| One producer, many readers, latest value only | `tokio::sync::watch::channel(initial)` |
| One producer, many readers, every value queued | `tokio::sync::broadcast::channel(cap)` |
| Single reply | `tokio::sync::oneshot::channel()` |
| Stream adapter over a receiver | `tokio_stream::wrappers::ReceiverStream` |

The mpsc worker pattern:

```rust
let (tx, mut rx) = tokio::sync::mpsc::channel::<Job>(256);

let worker = tokio::spawn(async move {
    while let Some(job) = rx.recv().await {
        if let Err(error) = process(job).await {
            tracing::warn!(%error, "job failed");
        }
    }
    tracing::info!("queue closed, worker exiting");
});

tx.send(job).await?; // waits when full: backpressure
drop(tx);            // closing the last sender ends the worker loop
worker.await?;
```

Bound every channel. An unbounded channel converts a slow consumer into unbounded memory growth.

## Streams

`futures::Stream` is the async counterpart of `Iterator`. It fits paginated fetches, long-poll responses and line-by-line file reads.

```rust
use futures::stream::{self, StreamExt, TryStreamExt};

let bodies: Vec<String> = stream::iter(urls)
    .map(|url| async move { fetch(&url).await })
    .buffer_unordered(8) // at most eight requests in flight
    .try_collect()
    .await?;
```

`buffer_unordered(n)` is the throttle; prefer it over spawning N tasks by hand. `buffered(n)` keeps input order. Turn a channel into a stream with `ReceiverStream::new(rx)` and hand it to an SSE or WebSocket handler.

## Graceful shutdown

```rust
use std::time::Duration;
use tokio::signal;
use tokio_util::sync::CancellationToken;

async fn shutdown_signal() -> std::io::Result<()> {
    let ctrl_c = signal::ctrl_c();
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())?
            .recv()
            .await;
        Ok::<(), std::io::Error>(())
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<std::io::Result<()>>();

    tokio::select! {
        result = ctrl_c => result?,
        result = terminate => result?,
    }
    tracing::info!("shutdown signal received");
    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let token = CancellationToken::new();
    let server = tokio::spawn(run_server(token.child_token()));
    shutdown_signal().await?;
    token.cancel();
    // A bounded wait keeps a stuck worker from hanging the exit
    let _ = tokio::time::timeout(Duration::from_secs(10), server).await;
    Ok(())
}
```

Sequence: catch the signal, cancel a token shared with the server, let the server's `select!` arms see it and exit, then wait with a timeout. Registration failures surface as `Result`s instead of `expect` calls, which keeps the strict lint set quiet.

## Synchronisation primitives

- `tokio::sync::Mutex`: async mutex for state shared between tasks and held across `.await`. A guard held over a slow await serialises the whole system, so keep critical sections short.
- `tokio::sync::RwLock`: async read-write lock with the same caveat.
- `parking_lot::Mutex`: synchronous, fast, no poisoning; fits short critical sections with no `.await` inside.
- `tokio::sync::Semaphore`: bounds concurrent operations such as "ten requests in flight" or "three database writers".

```rust
use std::sync::Arc;
use tokio::sync::Semaphore;

let semaphore = Arc::new(Semaphore::new(10));
let mut set = tokio::task::JoinSet::new();
for url in urls {
    let permit = semaphore.clone().acquire_owned().await?;
    set.spawn(async move {
        let _permit = permit; // released when the task ends
        fetch(&url).await
    });
}
```

## Common mistakes

1. **A std mutex guard held across `.await`.** It compiles, then deadlocks or serialises at scale. Release before the await, or switch to `tokio::sync::Mutex`. Clippy's `await_holding_lock` flags the pattern.
2. **Ignoring the `JoinHandle` result.** A panicked task returns `Err(JoinError)`; discarding it swallows the panic.
3. **`tokio::spawn` where `JoinSet` fits.** Detached tasks outlive their parent and leak.
4. **Unbounded channels.** Always give a capacity.
5. **`block_on` inside async code.** Deadlocks under `current_thread`, wastes a worker under `multi_thread`.
6. **CPU-heavy work in an `async fn`.** Move it to `spawn_blocking` or `rayon`.
7. **Missing timeouts on network and filesystem calls.** Wrap each external await in `tokio::time::timeout`.
8. **Holding a `RefCell` borrow or `std::sync::MutexGuard` across `.await`.** The future stops being `Send` and `tokio::spawn` rejects it; restructure so the borrow ends first.

## Testing async code

```rust
#[tokio::test]
async fn fetches_and_parses() {
    let server = wiremock::MockServer::start().await;
    wiremock::Mock::given(wiremock::matchers::method("GET"))
        .respond_with(wiremock::ResponseTemplate::new(200).set_body_string(r#"{"id":1}"#))
        .mount(&server)
        .await;

    let result = my_client::fetch(&server.uri()).await.unwrap();
    assert_eq!(result.id, 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn parallel_work() { /* ... */ }
```

Control time with the `test-util` feature (`tokio = { version = "1", features = ["test-util"] }` under dev-dependencies):

```rust
#[tokio::test(start_paused = true)]
async fn time_travel() {
    let start = tokio::time::Instant::now();
    tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
    assert!(start.elapsed() >= std::time::Duration::from_secs(3600));
    // Wall-clock time spent: close to zero.
}
```

With paused time, the runtime advances the clock whenever all tasks are idle, so timeouts and retries test in microseconds.

## When async is the wrong tool

- CPU-heavy single-threaded code with no I/O: a plain `fn` with `rayon` is simpler and often faster.
- A trivial script making one HTTP call: a synchronous client such as `ureq` is smaller.
- Code whose foreign-function side is synchronous.

Async pays off with many concurrent I/O operations or when cancellation is a first-class need.
