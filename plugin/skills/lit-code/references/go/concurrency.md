# Concurrency

Goroutines start with one keyword and fail in quiet ways: leaks, races, deadlocks, lost errors. This page collects the rule set that keeps concurrent Go code boring. It covers `context`, `errgroup`, channels, locks, atomics, clocks, shutdown and the tooling that proves it all.

---

## Four working rules

1. **`ctx context.Context` is the first parameter** of every function that performs I/O, waits, or can be cancelled.
2. **Every `go` statement answers "how does this stop?"** A context, a closed channel, or a `WaitGroup` must end it.
3. **Tests run with `-race`.** The Taskfile and CI both pass the flag.
4. **`goleak` runs in `TestMain`** for each package that starts goroutines. It detects leaks the race detector does not see.

---

## `context.Context`: the cancellation backbone

```go
// ctx flows from the caller through every layer.
func (s *UserService) Create(ctx context.Context, email domain.Email) (domain.User, error) {
    user, err := s.store.Insert(ctx, email)
    if err != nil {
        return domain.User{}, fmt.Errorf("insert: %w", err)
    }
    if err := s.notifier.Welcome(ctx, user); err != nil {
        return domain.User{}, fmt.Errorf("notify: %w", err)
    }
    return user, nil
}
```

A function that builds its own `context.Background()` while a `ctx` is in scope detaches itself from request cancellation. `contextcheck` reports it, and `noctx` reports HTTP requests built without a context. Create root contexts only in `main`, in tests, and in background workers whose lifetime is the process.

Since Go 1.21, `context.WithoutCancel(ctx)` keeps values and drops cancellation for the rare case of work that must outlive the request (audit writes after a client disconnects). Pair it with its own timeout.

### Context values

```go
type ctxKey struct{ name string }

var requestIDKey = ctxKey{"request_id"}

func WithRequestID(ctx context.Context, id string) context.Context {
    return context.WithValue(ctx, requestIDKey, id)
}

func RequestID(ctx context.Context) string {
    v, _ := ctx.Value(requestIDKey).(string)
    return v
}
```

- Keys are unexported struct types. A plain string key can collide with another package's.
- Values carry request-scoped metadata: request ID, authenticated subject, trace span.
- Dependencies (loggers, pools, configuration) live in struct fields. Reaching for `ctx.Value` to fetch a database pool hides a dependency and defeats compile-time wiring.

### Timeouts and cancellation

```go
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()

if err := slow(ctx); err != nil {
    return fmt.Errorf("slow: %w", err)
}
```

`defer cancel()` goes on the line after the `With*` call. A skipped cancel keeps a timer alive until the parent finishes; `go vet`'s `lostcancel` check finds the omission. Use `context.WithCancelCause` and `context.Cause(ctx)` when the reason for cancellation matters to the caller. Distinguish `context.DeadlineExceeded` from `context.Canceled` with `errors.Is`.

---

## `errgroup`: structured concurrency

`golang.org/x/sync/errgroup` is the Go equivalent of a task group. Prefer it over raw `go` for any set of related goroutines.

```go
import "golang.org/x/sync/errgroup"

func FetchAll(ctx context.Context, urls []string) ([][]byte, error) {
    g, ctx := errgroup.WithContext(ctx)
    g.SetLimit(8)

    results := make([][]byte, len(urls))
    for i, u := range urls {
        g.Go(func() error {
            body, err := fetch(ctx, u)
            if err != nil {
                return fmt.Errorf("fetch %s: %w", u, err)
            }
            results[i] = body
            return nil
        })
    }
    if err := g.Wait(); err != nil {
        return nil, err
    }
    return results, nil
}
```

Behaviour worth knowing:

- `WithContext` returns a child context that cancels on the first non-nil error, so sibling tasks observe `ctx.Done()` and stop.
- `SetLimit(n)` makes `g.Go` block when `n` goroutines are in flight. Always set it; unbounded fan-out exhausts file descriptors, connections and memory. `g.TryGo` returns false instead of blocking.
- `Wait` returns the first error. When every error matters, collect them under a mutex and finish with `errors.Join`:
  ```go
  var (
      mu   sync.Mutex
      errs []error
  )
  g.Go(func() error {
      if err := work(ctx); err != nil {
          mu.Lock()
          errs = append(errs, err)
          mu.Unlock()
      }
      return nil // keep siblings running
  })
  _ = g.Wait()
  return errors.Join(errs...)
  ```
- Each task writes to its own index of a preallocated slice, which avoids a lock.

### Plain `sync.WaitGroup`

When no task returns an error, a `WaitGroup` suffices. Call `Add` before the `go` statement, and `Done` with `defer`:

```go
var wg sync.WaitGroup
for _, item := range items {
    wg.Add(1)
    go func() {
        defer wg.Done()
        process(ctx, item)
    }()
}
wg.Wait()
```

Go 1.25 adds `wg.Go(func() { ... })`, which folds `Add`, `go` and `Done` into one call.

---

## Goroutine leaks and `goleak`

```go
package store_test

import (
    "testing"

    "go.uber.org/goleak"
)

func TestMain(m *testing.M) {
    goleak.VerifyTestMain(m)
}
```

One function per package runs goleak after the whole package finishes and fails with the stack of every surviving goroutine. It catches workers started in setup and never joined, tickers without an exit, and clients that were never closed.

A known long-lived goroutine (a metrics exporter owned by a dependency) gets an explicit exemption:

```go
goleak.VerifyTestMain(m,
    goleak.IgnoreTopFunction("github.com/example/metrics.(*Registry).Push"),
)
```

For a single test, `defer goleak.VerifyNone(t)` narrows the scope. Prefer fixing the leak to widening the ignore list.

---

## Channels

### Direction in signatures

```go
func produce(out chan<- Item)
func consume(in <-chan Item)
func stage(in <-chan Item, out chan<- Item)
```

Directional types stop a consumer from closing the producer's channel.

### Closing

- The sender closes the channel. With several senders, use a `WaitGroup` and a single closer goroutine.
- Closing a closed channel, closing a nil channel and sending on a closed channel all panic.
- A receive from a closed channel returns the zero value with `ok == false`, and `for range ch` ends.

```go
func fanIn(ctx context.Context, sources ...<-chan Item) <-chan Item {
    out := make(chan Item)
    var wg sync.WaitGroup
    wg.Add(len(sources))
    for _, src := range sources {
        go func() {
            defer wg.Done()
            for item := range src {
                select {
                case out <- item:
                case <-ctx.Done():
                    return
                }
            }
        }()
    }
    go func() {
        wg.Wait()
        close(out)
    }()
    return out
}
```

### `select`

```go
select {
case msg := <-incoming:
    handle(msg)
case <-ctx.Done():
    return context.Cause(ctx)
case <-timer.C:
    return ErrTimeout
}
```

- `time.After` allocates a timer per call. Fine for a one-off select; in a loop use `time.NewTimer` with `Reset` (and call `Stop`). Go 1.23 made timer channels unbuffered and garbage-collectable, which removed older `Reset` pitfalls.
- A `default` case makes the select non-blocking. Add it on purpose, because a busy loop with `default` burns a CPU core.
- Every long-lived `for { select { ... } }` loop includes a `ctx.Done()` case.

### Buffered and unbuffered

An unbuffered channel is a synchronous hand-off and suits coordination. A buffered channel decouples rates up to its capacity and suits queues with a deliberate bound. A capacity-one channel makes a non-blocking signal:

```go
ready := make(chan struct{}, 1)

// producer
select {
case ready <- struct{}{}:
default: // a signal is already pending
}

// consumer
<-ready
```

### Iterators (Go 1.23)

Range-over-func gives producers a pull interface with no goroutine:

```go
func Lines(r io.Reader) iter.Seq2[string, error] {
    return func(yield func(string, error) bool) {
        sc := bufio.NewScanner(r)
        for sc.Scan() {
            if !yield(sc.Text(), nil) {
                return
            }
        }
        if err := sc.Err(); err != nil {
            yield("", err)
        }
    }
}

for line, err := range Lines(f) {
    if err != nil {
        return err
    }
    use(line)
}
```

Choose an iterator when the consumer drives the pace, and a channel when producer and consumer run in parallel.

---

## Locks and atomics

The ladder, from preferred to last resort:

1. Message passing through channels, `errgroup`, `WaitGroup`.
2. `sync.RWMutex` for read-heavy shared state, `sync.Mutex` otherwise.
3. `atomic.Int64`, `atomic.Bool`, `atomic.Pointer[T]` for single-word state.
4. `unsafe` tricks need a written justification and a race-detector pass.

```go
type Cache struct {
    mu    sync.RWMutex
    items map[string]Entry
}

func (c *Cache) Get(key string) (Entry, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    e, ok := c.items[key]
    return e, ok
}

func (c *Cache) Set(key string, e Entry) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.items[key] = e
}
```

- A struct with a mutex travels by pointer; `go vet` (`copylocks`) reports copies.
- Place `defer mu.Unlock()` right after `Lock()`.
- Snapshot data under the lock and call callbacks after releasing it, since user code under a lock invites deadlock.
- Keep lock ordering consistent when two locks are involved, and document it next to the struct.
- Leave the mutex field unexported and next to the data it guards, with a comment naming the fields it covers.

### Lazy initialization

```go
var loadConfig = sync.OnceValues(func() (Config, error) {
    var cfg Config
    err := env.Parse(&cfg)
    return cfg, err
})

func handler() {
    cfg, err := loadConfig()
    // ...
}
```

`sync.OnceFunc`, `sync.OnceValue` and `sync.OnceValues` (Go 1.21) replace the `sync.Once` plus package variable pair. `OnceValue` re-panics for later callers if the function panicked, so prefer `OnceValues` with an error return for fallible setup.

### Atomics: the typed family

```go
var counter atomic.Int64

counter.Add(1)
n := counter.Load()
```

The older function style (`atomic.AddInt64(&x, 1)`) compiles against any `int64` and invites mixed plain and atomic access. The typed API makes the atomic nature part of the variable.

---

## Time: inject a clock

```go
type Clock interface{ Now() time.Time }

type realClock struct{}

func (realClock) Now() time.Time { return time.Now() }

type Service struct{ clock Clock }
```

Tests substitute a fake (for example `github.com/benbjohnson/clock`, or a tiny struct returning a fixed time):

```go
fake := clock.NewMock()
fake.Set(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
svc := &Service{clock: fake}
```

Domain and service code calls `s.clock.Now()`. A direct `time.Now()` makes expirations, retries and schedules untestable.

For code that waits, avoid `time.Sleep` in production paths:

- `time.NewTicker` for periodic work, with a `ctx.Done()` exit and a deferred `Stop`.
- `time.NewTimer` for a single delay inside a `select`.
- `time.AfterFunc` for fire-and-forget callbacks that you can `Stop`.

Go 1.25 promotes `testing/synctest` to a stable package: `synctest.Test(t, func(t *testing.T) { ... })` runs a test in a bubble with a fake clock, so `time.Sleep` and timers advance instantly and deterministically. It suits code that must stay concrete about real time.

---

## Graceful shutdown

```go
func run(ctx context.Context, srv *http.Server, workers []Worker, grace time.Duration) error {
    g, gctx := errgroup.WithContext(ctx)

    g.Go(func() error {
        if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
            return err
        }
        return nil
    })
    for _, w := range workers {
        g.Go(func() error { return w.Run(gctx) })
    }
    g.Go(func() error {
        <-gctx.Done()
        shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(gctx), grace)
        defer cancel()
        return srv.Shutdown(shutdownCtx)
    })
    return g.Wait()
}
```

`main` builds `ctx` with `signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)`. A signal cancels the context, every worker returns, and the server drains within `grace`.

---

## Race detector in CI

```bash
go test -race -shuffle=on -count=1 ./...
```

- `-race` instruments memory accesses and reports data races at run time, at roughly 5 to 10 times the cost, which suits tests.
- `-shuffle=on` randomizes test order and exposes hidden ordering dependencies.
- `-count=1` bypasses the test cache, so a pass reflects the current code.

A test that fails only under `-race` has found a real defect. Fix the race and keep the test.

---

## Antipatterns

| Pattern | Problem | Replacement |
|---|---|---|
| `go func() { ... }()` without `ctx` | leaks at shutdown | `errgroup.WithContext` or pass `ctx` |
| `time.Sleep(d)` in production code | blocks, untestable | timer in a `select` with `ctx.Done()` |
| `chan interface{}` | type information lost | typed channel or sealed interface |
| mutex inside a struct passed by value | copies a locked lock | pointer receivers, `copylocks` check |
| lock around an entire handler | serializes the API | lock the smallest critical section |
| `for { select { ... } }` without `ctx.Done()` | cannot stop | add the context case |
| `wg.Add(1)` inside the goroutine | `Wait` may return first | `Add` before `go` |
| unbounded `go` per item | exhausts resources | `SetLimit` or a worker pool |
| writing a map from several goroutines | fatal concurrent map writes | mutex or `sync.Map` for narrow cases |

## Sources

- Go memory model: https://go.dev/ref/mem
- errgroup: https://pkg.go.dev/golang.org/x/sync/errgroup
- goleak: https://github.com/uber-go/goleak
- Pipelines and cancellation: https://go.dev/blog/pipelines
- testing/synctest: https://go.dev/blog/synctest
- Range over func: https://go.dev/blog/range-functions
