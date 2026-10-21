# Go Debugging

Covers goroutines, `dlv` (Delve), `pprof`, the race detector, and the fact that Go's concurrency model makes most bugs about goroutines doing something quiet and wrong. Run commands through `run_command`; a `dlv` prompt is a long-running command driven with `send_command_input` and read with `command_status`.

---

## Environment detection (Phase 0)

```bash
go version
cat go.mod | head -5

which dlv
dlv version

grep -r '// +build\|//go:build' cmd/ internal/ pkg/ 2>/dev/null | head   # build constraints
grep -r 'net/http/pprof\|runtime/pprof' --include='*.go' | head -3        # pprof wired up?
```

---

## Delve (`dlv`) — the Go debugger

Go's gc compiler emits DWARF, but plain gdb barely understands goroutines and prints garbage for interface values. Use dlv.

### The five launch modes

```bash
dlv debug ./cmd/server -- --port=8080        # build and launch under the debugger
dlv test ./internal/handler/                 # debug a test binary
dlv exec ./bin/myserver                      # debug an existing binary
dlv attach $(pgrep myserver)                 # attach to a running process
dlv debug --headless --listen=:2345 --api-version=2 ./cmd/server   # headless, default port 2345
```

### Build a debuggable binary

```bash
go build -gcflags="all=-N -l" -o ./bin/server ./cmd/server
# -N disables optimization, -l disables inlining
```

Then `dlv exec ./bin/server`.

### Essential dlv commands

```
(dlv) b main.main                      # breakpoint at a function
(dlv) b handler.go:42                  # breakpoint at file:line
(dlv) b pkg/foo.Bar                    # breakpoint at a type method
(dlv) c / continue
(dlv) n / next
(dlv) s / step
(dlv) so / stepout
(dlv) bt / stack
(dlv) goroutines                       # list all goroutines
(dlv) goroutine <id>                   # switch to goroutine N
(dlv) goroutine <id> bt                # stack of a specific goroutine
(dlv) locals
(dlv) args
(dlv) p <expr>                         # understands interfaces, maps, slices
(dlv) vars <regex>                     # package vars matching a regex
(dlv) on <bpid> print <expr>           # auto-print on a breakpoint hit
(dlv) trace <location>                 # a logpoint: log without stopping
```

`trace` is underused: a logpoint with no stepping.

---

## Goroutine-centric debugging

Goroutine leaks and deadlocks are the most common Go bugs; `goroutines` is the starting point.

```
(dlv) goroutines -t                    # with truncated stack
(dlv) goroutines -s                    # sorted by stack
(dlv) goroutines -with user            # filter user-spawned goroutines
```

| You see in `goroutines` | Usually means |
|---|---|
| hundreds stuck at `chan receive` | the producer died; the consumers leak |
| hundreds stuck at `semacquire` | lock contention; a holder probably deadlocked |
| one stuck at `select` with no default | a missing case or a closed-channel scenario |
| stuck at `netpoll` | external I/O not responding — check downstream, not Go |
| a count that grows over time | a goroutine leak; find who spawns without cleanup |

### Panic signals in Go

```go
defer func() {
    if r := recover(); r != nil {
        log.Printf("recovered panic: %v\n%s", r, debug.Stack())   // GOOD — surfaced
        // log.Printf("recovered")                                   // BAD — silent
    }
}()
```

Check for silent recovers in Phase 8: `rg 'recover\(\)' --type go`, then read each site for whether the panic reaches the surface.

---

## Race detector — run it whenever the bug is intermittent

```bash
go test -race ./...
go run -race ./cmd/server
go build -race ./cmd/server
```

Run this before attaching dlv when intermittency is involved; it often finds the bug directly.

```
WARNING: DATA RACE
Read at 0x00c0001a0080 by goroutine 7:
  main.(*Counter).Value()
      /path/to/counter.go:14 +0x3c
Previous write at 0x00c0001a0080 by goroutine 6:
  main.(*Counter).Inc()
      /path/to/counter.go:10 +0x5f
```

Both stacks, both goroutines; the race is obvious from the line pair.

---

## pprof — perf, memory, goroutine leaks

### Wire it up (usually already present)

```go
import _ "net/http/pprof"

func main() {
    go func() { log.Println(http.ListenAndServe("localhost:6060", nil)) }()
    // ... rest of the server
}
```

### Queries

```bash
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30   # CPU
go tool pprof http://localhost:6060/debug/pprof/heap                 # heap snapshot
go tool pprof http://localhost:6060/debug/pprof/goroutine            # find leaks
go tool pprof http://localhost:6060/debug/pprof/block                # blocking ops
go tool pprof http://localhost:6060/debug/pprof/mutex                # lock contention
```

Inside pprof: `top` (top functions by self time), `list main.handler` (annotated source), `web` (SVG callgraph), `traces`.

For goroutine leaks, take two snapshots 30s apart and diff:

```bash
go tool pprof -base prof1.pb.gz prof2.pb.gz
```

Goroutines present in prof2 but not prof1 are new; those that stick around are leaking.

---

## `GODEBUG` — runtime-level observability

```bash
GODEBUG=gctrace=1 ./myserver              # GC stats
GODEBUG=schedtrace=1000 ./myserver        # scheduler trace every 1000ms
GODEBUG=scheddetail=1,schedtrace=1000     # detailed scheduler state
GODEBUG=allocfreetrace=1 ./myserver       # every alloc/free (noisy)
GODEBUG=memprofilerate=1 ./myserver       # profile every allocation
```

Useful for GC pressure, goroutine starvation, or memory-pattern issues.

---

## Silent-failure patterns in Go

| Pattern | Why it stays quiet |
|---|---|
| `if err != nil { return err }` returning to a caller that ignores it | the error bubbles up and is discarded at the top |
| `defer func() { recover() }()` with no log | the panic is swallowed; the program continues with corrupt state |
| `_, _ = conn.Write(data)` | an intentionally discarded error |
| a buffered channel send that blocks forever | the sender hangs; hard to see without deadlock detection |
| `time.Sleep` in a test | passes locally, fails in CI |
| `go func() { ... }()` with no error path | the goroutine dies quietly on a panic unless it recovers and logs |
| a canceled context the code keeps working past | an ignored `ctx.Err()` check |
| `json.Unmarshal` into a zero-value field | the input lacked the key; the field is quietly zero |
| a closed-channel read returning the zero value | the consumer skips the `ok` check and reads forever |

---

## Phase 9 cleanup specifics

```bash
pkill -f 'dlv' || true
lsof -iTCP:2345 -sTCP:LISTEN -nP 2>/dev/null      # dlv default
lsof -iTCP:6060 -sTCP:LISTEN -nP 2>/dev/null      # pprof endpoint if started for this session

git diff | grep -E '(fmt\.Println\("DEBUG|log\.Printf\("DEBUG)'
git checkout <file>

unset GODEBUG
```
