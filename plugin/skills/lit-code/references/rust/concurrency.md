# Concurrency Primitives

Locks, atomics, channels and the loom model checker, arranged as a decision ladder that keeps code out of soundness trouble. Start at the top and descend only on measured evidence.

## The ladder

```text
Highest level   tokio::sync::mpsc / broadcast / watch
                message passing: the default for new code

                Arc<Mutex<T>> / Arc<RwLock<T>>
                shared mutable state: common, simple to get right

                parking_lot::{Mutex, RwLock, Condvar}
                faster synchronous locks, no poisoning

                AtomicUsize, AtomicBool, AtomicPtr
                single-word lock-free state

Lowest level    UnsafeCell + unsafe + loom + Miri
                custom lock-free or wait-free primitives
```

Begin at the top. A lower rung needs a measured bottleneck, a written justification and a review.

## Decision tree

```text
Need to share state between tasks or threads?
|- Configuration, read-only after start-up
|    -> Arc<Config>; no lock needed
|- A queue of work
|    -> tokio::sync::mpsc::channel(capacity)
|- The latest value, published to many readers
|    -> tokio::sync::watch::channel(initial)
|- Every value delivered to every consumer
|    -> tokio::sync::broadcast::channel(capacity)
|- A request with a reply inside one task tree
|    -> tokio::sync::oneshot::channel()
|- A counter
|    -> AtomicU64 or AtomicUsize
|- A flag or set-once value
|    -> AtomicBool, OnceLock<T>
|- Mutation by many tasks with short critical sections
|    |- async context                       -> tokio::sync::Mutex<T>
|    `- synchronous, no .await while held   -> parking_lot::Mutex<T>
|- Mutation with many readers and few writers
|    |- async context   -> tokio::sync::RwLock<T>
|    `- synchronous     -> parking_lot::RwLock<T>
`- A custom lock-free structure
     -> UnsafeCell + atomics + loom tests + Miri tests + a second reviewer
```

## Atomics: when and how

Atomics fit counters incremented from many threads (`AtomicU64`), one-shot flags (`AtomicBool`) and pointer publication (`AtomicPtr<T>`).

### Memory orderings

```rust
use std::sync::atomic::{AtomicUsize, Ordering};

let hits = AtomicUsize::new(0);

// A plain count that synchronises with no other data
hits.fetch_add(1, Ordering::Relaxed);
let seen = hits.load(Ordering::Relaxed);
```

| Ordering | Use it for |
|---|---|
| `Relaxed` | Standalone counters and statistics; no other memory depends on the value |
| `Acquire` (loads) and `Release` (stores) | Publish and consume: write data, then release a flag; readers acquire the flag, then read the data |
| `AcqRel` | Read-modify-write operations that both consume and publish, such as `fetch_add` on a sequence number |
| `SeqCst` | One global order across all `SeqCst` operations; the strongest and slowest |

When unsure, use `SeqCst`; the cost is small on common hardware. Weaken an ordering only with a loom test that passes at the weaker setting.

### Publish, then load

```rust
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc,
};
use std::thread;

struct Mailbox {
    ready: AtomicBool,
    value: AtomicU64,
}

fn main() {
    let mailbox = Arc::new(Mailbox { ready: AtomicBool::new(false), value: AtomicU64::new(0) });

    let producer = {
        let mailbox = Arc::clone(&mailbox);
        thread::spawn(move || {
            mailbox.value.store(42, Ordering::Relaxed);
            // Release: every write above becomes visible to a thread that acquires this flag
            mailbox.ready.store(true, Ordering::Release);
        })
    };

    let consumer = {
        let mailbox = Arc::clone(&mailbox);
        thread::spawn(move || {
            while !mailbox.ready.load(Ordering::Acquire) {
                std::hint::spin_loop();
            }
            // The Acquire load that saw `true` pairs with the Release store
            assert_eq!(mailbox.value.load(Ordering::Relaxed), 42);
        })
    };

    producer.join().expect("producer thread");
    consumer.join().expect("consumer thread");
}
```

This is the canonical Release and Acquire pairing. When the published payload is richer than one word, use `OnceLock<T>`, which wraps exactly this protocol behind a safe API. A `static mut` with unsafe reads is never the right container: edition 2024 denies references to `static mut`, and the pattern defeats Miri's checks.

## Std, parking_lot and tokio locks

| | `std::sync::Mutex` | `parking_lot::Mutex` | `tokio::sync::Mutex` |
|---|---|---|---|
| Speed | Good on current platforms | Fastest in contended cases | Slowest (await-aware) |
| Poisoning | Yes (`PoisonError`) | None | None |
| Hold across `.await` | Rejected by `Send` bounds or risks deadlock | Same | Allowed |
| RAII guard | Yes | Yes | Yes |
| `const` constructor | Yes (since 1.63) | Yes | No |
| Async API | No | No | Yes |

Selection rules:

- Short critical section, no `.await` inside: `parking_lot::Mutex`.
- State held across an `.await`: `tokio::sync::Mutex`, and keep the section short.
- Process-wide initialisation: `OnceLock` or `LazyLock`.
- New code seldom benefits from `std::sync::Mutex` poisoning; `parking_lot` removes that friction. A project that avoids extra dependencies keeps the std mutex and handles `PoisonError` with `into_inner` where recovery is sound.

### The async and sync mutex deadlock

```rust
let state = std::sync::Mutex::new(0u64);
let mut guard = state.lock().expect("poisoned");
something_async().await; // the guard is held across the await
*guard += 1;
```

On a `current_thread` runtime this deadlocks: the future suspends while holding the lock, and another task on the same thread blocks the executor trying to take it. Under `multi_thread` it serialises the system. Clippy's `await_holding_lock` and the `Send` check on `tokio::spawn` both flag it.

Release before awaiting:

```rust
{
    let mut guard = state.lock().expect("poisoned");
    *guard += 1;
} // guard dropped here
something_async().await;
```

Or switch to `tokio::sync::Mutex`, whose guard may live across awaits.

## Channels

### mpsc: the workhorse

```rust
let (tx, mut rx) = tokio::sync::mpsc::channel::<Job>(256);

tokio::spawn(async move {
    while let Some(job) = rx.recv().await {
        process(job).await;
    }
});

tx.send(Job::new()).await?; // waits when the buffer is full
```

Capacity is the backpressure budget. Prefer `channel(n)` over `unbounded_channel()`; an unbounded queue turns a slow consumer into a memory leak.

### watch: latest-value publication

```rust
let (tx, mut rx) = tokio::sync::watch::channel(Config::default());

// Producer
tx.send(new_config)?;

// Consumer
loop {
    rx.changed().await?;
    let cfg = rx.borrow_and_update();
    apply(&cfg);
}
```

Receivers observe only the newest value; intermediate updates vanish. That suits configuration reloads, leadership changes and "current time" propagation. Drop the `borrow` guard before awaiting, since it holds a read lock.

### broadcast: queued fan-out

```rust
let (tx, _) = tokio::sync::broadcast::channel::<Event>(1024);
let mut rx1 = tx.subscribe();

loop {
    match rx1.recv().await {
        Ok(event) => handle(event),
        Err(tokio::sync::broadcast::error::RecvError::Lagged(skipped)) => {
            tracing::warn!(skipped, "subscriber fell behind");
        }
        Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
    }
}
```

Each subscriber owns a buffer position. A subscriber that falls more than the capacity behind receives `Lagged(n)` and skips messages. Decide explicitly whether to log and continue or to disconnect and resynchronise.

### oneshot: a single value

```rust
let (reply_tx, reply_rx) = tokio::sync::oneshot::channel::<Response>();
worker.send(Request { reply: reply_tx }).await?;
let response = reply_rx.await?;
```

This is the standard request and response shape over an actor task.

## Semaphores

```rust
use std::sync::Arc;
use tokio::sync::Semaphore;

let permits = Arc::new(Semaphore::new(10));
for task in tasks {
    let permit = Arc::clone(&permits).acquire_owned().await?;
    tokio::spawn(async move {
        let _held = permit; // released when the task ends
        process(task).await
    });
}
```

Typical uses: ten outbound requests in flight, three database writers, N CPU-heavy jobs. A semaphore with one permit is a mutex; write the mutex for clearer intent.

## Arc and Rc

`Arc<T>` shares ownership across threads, and `Rc<T>` stays on one thread (it is not `Send`).

```rust
let shared = Arc::new(BigData::new());
for _ in 0..workers {
    let shared = Arc::clone(&shared);
    tokio::spawn(async move { use_data(&shared).await });
}
```

`Arc::clone` increments a counter and copies nothing. Pass `&Arc<T>` or `&T` into functions that only read, and clone when ownership must cross a thread or task boundary. Use `Weak<T>` for parent pointers and graph back-edges so reference cycles cannot leak.

## One-time initialisation

```rust
use std::sync::{LazyLock, OnceLock};

// Computed on first access
static CONFIG: LazyLock<Config> = LazyLock::new(Config::default);

fn config() -> &'static Config {
    &CONFIG
}

// Set once, explicitly, from async start-up code
static DB: OnceLock<sqlx::PgPool> = OnceLock::new();

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let pool = sqlx::PgPool::connect(&std::env::var("DATABASE_URL")?).await?;
    DB.set(pool).map_err(|_| anyhow::anyhow!("pool already initialised"))?;
    Ok(())
}
```

`OnceLock` has been stable since 1.70 and `LazyLock` since 1.80, both in `std::sync`. They replace `once_cell` and `lazy_static` in new code. Prefer passing handles through `AppState` over global statics; a global suits logging sinks and read-only configuration.

## Loom: model-checking lock-free code

When `unsafe` takes part in a concurrent algorithm, Miri's single execution is not enough. Loom runs a test under every legal thread interleaving.

`Cargo.toml`:

```toml
[target.'cfg(loom)'.dev-dependencies]
loom = "0.7"

[lints.rust]
unexpected_cfgs = { level = "warn", check-cfg = ['cfg(loom)'] }
```

Switch between real and loom primitives in the code under test:

```rust
#[cfg(loom)]
use loom::sync::{atomic::{AtomicUsize, Ordering}, Arc};
#[cfg(not(loom))]
use std::sync::{atomic::{AtomicUsize, Ordering}, Arc};
```

A loom test:

```rust
#[cfg(loom)]
mod loom_tests {
    use super::*;
    use loom::thread;

    #[test]
    fn concurrent_push_pop_keeps_the_queue_coherent() {
        loom::model(|| {
            let queue = Arc::new(MyQueue::new());
            let pusher = {
                let queue = Arc::clone(&queue);
                thread::spawn(move || queue.push(1))
            };
            let popper = {
                let queue = Arc::clone(&queue);
                thread::spawn(move || queue.pop())
            };
            pusher.join().unwrap();
            let popped = popper.join().unwrap();
            // Invariant: either the pop saw the item, or the item is still queued
            assert!(popped == Some(1) || queue.pop() == Some(1));
        });
    }
}
```

Run:

```bash
RUSTFLAGS="--cfg loom" cargo test --release -- --test-threads 1
```

Loom explores every legal schedule, including schedules a real scheduler produces once in a million runs, so a race it can reach is reported deterministically.

Limits to plan around:

- Exploration is exponential. Keep tests tiny: two or three threads and a few operations each. `LOOM_MAX_PREEMPTIONS=3` bounds the search.
- It models one machine's memory model and has no view of distributed systems.
- It does not check memory safety inside `unsafe` blocks. Run Miri as well: Miri for memory safety, loom for schedules.
- It replaces std synchronisation types only; Tokio primitives are outside its model.

## Send and Sync

- `T: Send` means a value of `T` may move to another thread.
- `T: Sync` means `&T` may be shared between threads.

Both derive automatically for types whose fields satisfy them. Manual `unsafe impl` is needed only for raw pointers and FFI handles.

```rust
struct Handle {
    raw: *mut ffi::Object,
}

// SAFETY: the library documents that an Object may move between threads as long as
// calls are externally synchronised. Handle exposes only &mut self methods, so one
// thread uses it at a time.
unsafe impl Send for Handle {}
// No Sync impl: the object is not safe for concurrent calls.
```

When the compiler says "`T` cannot be sent between threads safely", the cause is nearly always a raw pointer, an `Rc` (use `Arc`), or a `RefCell` (use a `Mutex`). Opt a type out explicitly with `PhantomData<*const ()>`.

## Common mistakes

1. **A std mutex guard held across `.await`.** Compiles under some runtimes, deadlocks under `current_thread`.
2. **`Arc::clone` inside a tight loop for read-only access.** Pass a reference.
3. **`Mutex<HashMap<K, V>>` under heavy reads.** Switch to `RwLock`, or a sharded map such as `dashmap`.
4. **`Relaxed` ordering used to publish data.** Publishing needs `Release` and `Acquire`; verify under loom.
5. **Unbounded channels.** Set a capacity. "It will not back up" is a guess.
6. **Detached `tokio::spawn` for fire-and-forget cleanup.** Use `JoinSet` so panics surface.
7. **`transmute` to fake `Send` or `Sync`.** Write `unsafe impl` with a SAFETY comment; a transmute breaks the aliasing model and Miri.
8. **Inconsistent lock order across two mutexes.** Acquire in one global order, or merge the data under a single lock. With more than three locks, restructure.
9. **Spin loops without `std::hint::spin_loop()` or a yield.** They starve other threads on small machines.

## When lock-free is justified

Descend to atomics plus `UnsafeCell` only when all of these hold:

1. A profile shows lock contention on the hot path.
2. No existing crate (`crossbeam`, `arc-swap`, `atomic-queue`) solves the problem.
3. Loom tests pass.
4. Miri tests pass.
5. A second engineer has reviewed the algorithm.

Most lock-free projects fail the third or fourth condition. When in doubt, take the lock and move on.
