# Library Defaults: Decision Tree for Go in 2026

Opinionated defaults with a one-line reason and a canonical snippet for each, so the idioms of every library do not have to be rediscovered mid-task. Go favours boring choices: the standard library is the starting point, and a third-party package needs a reason from the lists below.

Versions change quickly. Before adding a dependency, run `go get <module>@latest`, read the resolved version in `go.mod`, and skim its release notes. In headless sessions where network access is refused, keep the current `go.mod` pins and report the missing check.

---

## HTTP framework: `net/http`, `chi` or `gin`

| Situation | Choice |
|---|---|
| Fewer than about ten routes, light auth | `net/http` with the Go 1.22 `ServeMux` (method and path patterns such as `GET /users/{id}`) |
| Small or medium service that wants stdlib-shaped handlers | `go-chi/chi/v5` |
| A service with rich binding, many middlewares, large team familiarity | `gin-gonic/gin` (this skill's default, see `backend-stack.md`) |
| Avoid for new work | `gorilla/mux` (archived and revived with low activity), `fiber` (built on `fasthttp`, outside the `net/http` ecosystem) |

`gin` leads in ecosystem size: middleware, examples and answers are easy to find, and its `Context` object makes middleware composition simple. That is a social advantage, and the technical gap to `chi` or the enhanced `ServeMux` is small. Pick `chi` or the standard mux when handlers should stay `http.Handler` values reusable across stacks.

```go
import "github.com/gin-gonic/gin"

func main() {
    r := gin.New()
    r.Use(middleware.RequestID(), middleware.Recovery(logger), middleware.RequestLogger(logger))
    r.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
    _ = r.Run(":8080")
}
```

The standard mux alternative:

```go
mux := http.NewServeMux()
mux.HandleFunc("GET /users/{id}", func(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id")
    // ...
})
srv := &http.Server{Addr: ":8080", Handler: mux, ReadHeaderTimeout: 10 * time.Second}
```

`backend-stack.md` has the gin layout, middleware order, SSE streaming and graceful shutdown.

---

## RPC: `connectrpc.com/connect`

Connect is the default RPC layer. It serves the gRPC, gRPC-Web and Connect protocols from one handler, supports HTTP/1.1 and HTTP/2, and keeps unary calls debuggable with `curl`. Buf handles linting, breaking-change checks and code generation.

```go
// server
mux := http.NewServeMux()
mux.Handle(elizav1connect.NewElizaServiceHandler(&elizaServer{}))
srv := &http.Server{Addr: ":8080", Handler: mux, ReadHeaderTimeout: 10 * time.Second}

// client
client := elizav1connect.NewElizaServiceClient(http.DefaultClient, "http://localhost:8080")
res, err := client.Say(ctx, connect.NewRequest(&elizav1.SayRequest{Sentence: "hi"}))
```

Raw `grpc-go` is the exception, kept for strict gRPC-only environments (proxies or meshes that require its server library) and features Connect lacks. See `grpc-connect.md`.

---

## Database: `pgx/v5`, `sqlc`, `goose`

```bash
go get github.com/jackc/pgx/v5
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
```

- `pgx/v5` has broader PostgreSQL coverage (batch, `COPY`, `LISTEN/NOTIFY`, composite and array types) and better performance than `database/sql` with `lib/pq`. Use `pgxpool` for pooling and call pgx natively; `database/sql` mode drops those features.
- `sqlc` generates typed Go from `.sql`. Hand-written scanning code is a steady source of subtle bugs, and generation removes the class.
- `goose` runs migrations from the command line or as a library, without global state.

Other stores: `redis/go-redis/v9` for Redis, `nats-io/nats.go` for messaging, `riverqueue/river` for PostgreSQL-backed job queues, `twmb/franz-go` for Kafka, `modernc.org/sqlite` for pure-Go SQLite without cgo.

`gorm` and `ent` are avoided for new services: runtime reflection, implicit queries and graph-shaped abstractions cost clarity. See `sqlc-pgx.md`.

---

## Validation: three layers, three tools

| Layer | Tool | Example |
|---|---|---|
| HTTP edge | `go-playground/validator/v10` struct tags | `binding:"required,email,min=3"` |
| RPC edge | `protovalidate` (`buf.build/go/protovalidate`) | `(buf.validate.field).string.min_len = 3` |
| Domain | smart constructor with unexported fields | `NewEmail(s) (Email, error)` |

```go
type CreateUserReq struct {
    Email    string `json:"email"    binding:"required,email"`
    Username string `json:"username" binding:"required,alphanum,min=3,max=32"`
}

type Email struct{ raw string }

func NewEmail(s string) (Email, error) {
    if !emailRe.MatchString(s) {
        return Email{}, ErrInvalidEmail
    }
    return Email{raw: strings.ToLower(s)}, nil
}
```

The edge parses raw input into domain types once, and the domain trusts what it receives. `data-modeling.md` has the full pattern.

---

## Logging: `log/slog`

```go
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level:     slog.LevelInfo,
    AddSource: true,
}))
slog.SetDefault(logger)

logger.InfoContext(ctx, "request handled",
    slog.String("path", r.URL.Path),
    slog.Int("status", http.StatusOK),
    slog.Duration("elapsed", elapsed),
)
```

`slog` ships in the standard library (Go 1.21), and its `Handler` interface is what the OpenTelemetry, Datadog and Honeycomb bridges implement. Projects already on logrus, zap or zerolog may keep them; new files use `slog`. The `sloglint` linter in `golangci-strict.md` enforces typed attributes. Bridge older libraries with `slog.NewLogLogger` or a `zapslog` handler.

---

## CLI: `cobra`, `pflag`, `slog`

`spf13/cobra` is the standard framework (Kubernetes, Docker CLI, Helm, GitHub CLI). `caarlos0/env/v11` covers environment-only configuration. Add `spf13/viper` only for a real merge of config file, environment and flags. For prompts use `charmbracelet/huh`; for styled help `charmbracelet/fang`. See `cobra-stack.md`.

---

## TUI: Bubble Tea v2

Use `charm.land/bubbletea/v2`, `charm.land/bubbles/v2` and `charm.land/lipgloss/v2` together. Version 2 positions the real terminal cursor through `tea.View`, which Korean, Japanese and Chinese IME popups need, and `SetVirtualCursor(false)` on text components hands cursor drawing to the terminal. Version 1 misplaces the candidate window for CJK users. See `bubbletea-v2.md`.

---

## HTTP client: stdlib plus retry

The standard `http.Client` handles HTTP/2, pooling and timeouts once configured.

```go
client := &http.Client{
    Timeout: 30 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        200,
        MaxIdleConnsPerHost: 40,
        IdleConnTimeout:     90 * time.Second,
        ForceAttemptHTTP2:   true,
    },
}
```

Create one client per process and reuse it. Build requests with `http.NewRequestWithContext`. For retries and backoff add `github.com/hashicorp/go-retryablehttp`, a small wrapper that keeps the stdlib types. Rate limiting uses `golang.org/x/time/rate`. Libraries such as `resty` hide defaults and headers and add little over the stdlib plus the retry wrapper.

---

## JSON

Use `encoding/json` by default. Reach for `goccy/go-json` or `bytedance/sonic` only after a profile shows JSON on the hot path. They are API-compatible replacements, so the switch is an import alias. For partial reads and edits of large payloads, `tidwall/gjson` and `tidwall/sjson` avoid a full unmarshal. Go 1.25 previews a new `encoding/json/v2` behind `GOEXPERIMENT=jsonv2`; keep production code on v1 until it stabilizes. Decode untrusted bodies with `DisallowUnknownFields` and a size limit (`data-modeling.md`).

---

## Concurrency helpers

| Need | Use |
|---|---|
| Goroutine group with errors | `golang.org/x/sync/errgroup` |
| Weighted semaphore | `golang.org/x/sync/semaphore` |
| Duplicate call suppression | `golang.org/x/sync/singleflight` |
| Lazy init | `sync.OnceValue`, `sync.OnceValues`, `sync.OnceFunc` |
| Counters and flags | `atomic.Int64`, `atomic.Bool`, `atomic.Pointer[T]` |
| Pipelines | typed channels with `errgroup` for shutdown |
| Iteration helpers | `iter`, `slices`, `maps` from the standard library |

See `concurrency.md` for the discipline around them.

---

## Time

Use `time` from the standard library and inject a `Clock` interface so tests control the current time. `github.com/benbjohnson/clock` offers a ready mock; a four-line fake often suffices. Go 1.25's `testing/synctest` covers timer-heavy code.

---

## IDs

```go
import "github.com/google/uuid"

id := uuid.Must(uuid.NewV7()) // time-ordered, 128 bits
```

UUIDv7 sorts by creation time, which keeps database indexes compact. Use v4 where exposing creation time would be a privacy concern. For short URL-safe sortable IDs, `rs/xid` is a compact option.

---

## Crypto and secrets

Use the standard `crypto/*` packages, `crypto/rand` for randomness, and `golang.org/x/crypto` for extras. For password hashing choose argon2id (`golang.org/x/crypto/argon2`, or the wrapper `github.com/alexedwards/argon2id`), which OWASP recommends; bcrypt remains acceptable. Compare secrets with `crypto/subtle.ConstantTimeCompare`. Load secrets from the environment or a secret manager, and keep them out of logs (`slog.LogValuer` on secret types redacts them).

---

## Data processing

| Need | Use |
|---|---|
| Queries over CSV, Parquet or JSON | DuckDB bindings (`marcboeker/go-duckdb`) with Arrow interop |
| Columnar in-memory data | `apache/arrow-go/v18` |
| Numerics and statistics | `gonum.org/v1/gonum` |

Go's data-science story is deliberately thin. For heavy analysis, build the pipeline in Polars or DuckDB (see `python/data-processing.md`), exchange Parquet or Arrow files, and consume them from Go.

---

## Testing

| Need | Use |
|---|---|
| Assertions | `testify/require`; `assert` in table loops |
| Snapshots | `hexops/autogold/v2` |
| Property-based | `pgregory.net/rapid`, native `go test -fuzz` |
| Mocks | `go.uber.org/mock` |
| Outbound HTTP stubs | `httptest`, `h2non/gock` |
| Containers | `testcontainers-go` |
| Goroutine leaks | `go.uber.org/goleak` |
| Benchmarks | `testing.B`, `benchstat` |
| Struct comparison | `github.com/google/go-cmp/cmp` |
| Test runner UX | `gotest.tools/gotestsum` |

Details in `testing.md`.

---

## Observability and operations

| Need | Use |
|---|---|
| Tracing and metrics | `go.opentelemetry.io/otel` with `otelhttp`, `otelconnect`, `otelpgx` |
| Prometheus metrics | `prometheus/client_golang` |
| Vulnerability scan | `golang.org/x/vuln/cmd/govulncheck` in CI |
| Release automation | `goreleaser` |
| Container images | distroless base with `CGO_ENABLED=0` binaries, or `ko` |
| Live reload (development) | `air` |
| Profiling | `net/http/pprof` on a private port, `go tool pprof` |

---

## Configuration: `caarlos0/env/v11`

```go
type Config struct {
    Port        int           `env:"PORT"         envDefault:"8080"`
    DatabaseURL string        `env:"DATABASE_URL,required"`
    Timeout     time.Duration `env:"TIMEOUT"      envDefault:"30s"`
}

cfg, err := env.ParseAs[Config]()
if err != nil {
    return fmt.Errorf("parse config: %w", err)
}
```

The library is twelve-factor friendly: defaults in tags, a `required` marker, parsing for durations, slices and maps, and `encoding.TextUnmarshaler` support for domain types. Add `viper` only when file-based configuration is a real requirement.

---

## Templates and front ends

Server-rendered HTML uses `a-h/templ` for type-checked templates, with `html/template` for simple cases. `htmx` pairs well with either. For an API plus separate front end, generate the TypeScript client from the OpenAPI document produced by `oapi-codegen` or from the proto files via Connect-Web.

---

## Standard library first: modern replacements

Check this table before adding a package. Each row replaces a common third-party helper.

| Job | Standard library |
|---|---|
| Sorting, searching, dedup, min and max on slices | `slices` (`Sort`, `SortFunc`, `BinarySearch`, `Compact`, `Contains`, `Max`) |
| Map helpers | `maps` (`Keys`, `Values`, `Clone`, `Equal`), combined with `slices.Sorted` |
| Ordering and comparison | `cmp.Compare`, `cmp.Or` (first non-zero value, handy for defaults) |
| Lazy sequences | `iter.Seq`, `iter.Seq2`, `iter.Pull` |
| Splitting strings without allocating | `strings.SplitSeq`, `strings.Lines` (Go 1.24) |
| IP and prefix handling | `net/netip` |
| Embedding assets | `embed` |
| Sandboxed file access under a directory | `os.Root` (Go 1.24) |
| Interning repeated values | `unique` (Go 1.23) |
| Structured logging | `log/slog` |
| Pointer to a literal | a small generic helper `func ptr[T any](v T) *T { return &v }` |
| Atomic values | `sync/atomic` typed values |
| Test helpers | `testing` (`t.TempDir`, `t.Setenv`, `t.Context`, `b.Loop`) |

Reaching for a dependency to do something in this table adds weight and drift. When the project's `go` directive is older than the version listed, either raise it deliberately or keep the existing helper.

---

## Evaluating an unfamiliar dependency

Check each item before `go get`:

1. **Maintenance.** A tag within the last year, responsive owners, an issue tracker that gets answers.
2. **Standard types.** It accepts `io.Reader`, `context.Context`, `http.Handler`. Private connection or request types suggest lock-in.
3. **Side effects at import.** A package that registers state in `init()` complicates tests; reject it or isolate it.
4. **Failure behaviour.** A library that calls `log.Fatal` or panics on routine failures is unfit for services.
5. **Cancellation.** Functions that do I/O take a `context.Context` first.
6. **Overlap.** If `go.mod` already holds a package for the same job, extend that usage.
7. **Weight.** `go mod why -m <module>` and `go list -deps` show what it drags in; prefer small dependency trees.
8. **License.** Compatible with the project's distribution model.

Record the reason for each new direct dependency in the pull request description.

---

## Sources

- Go standard library index: https://pkg.go.dev/std
- Go 1.22 routing enhancements: https://go.dev/blog/routing-enhancements
- Connect for Go: https://connectrpc.com/docs/go/getting-started
- sqlc: https://docs.sqlc.dev
- slog guide: https://go.dev/blog/slog
- CLIProxyAPI (gin, SSE and WebSocket in production): https://github.com/router-for-me/CLIProxyAPI
