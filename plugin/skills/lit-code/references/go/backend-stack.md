# HTTP Backend Stack: gin, slog, validator, pgx

The reference skeleton for a production HTTP service in Go. It is modelled on [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI), an open-source proxy that serves several LLM provider APIs with SSE streaming, WebSocket upgrades, request logging and hot-reloaded configuration. The pieces below are the ones that survive contact with production traffic: explicit timeouts, ordered middleware, one error funnel, injected dependencies and graceful shutdown.

`libraries.md` explains when `chi` or the standard `ServeMux` is the better fit. Gin is the default here because its ecosystem is the largest, and the technical gap to the alternatives is small.

---

## `go.mod`

```go
module github.com/your-org/myservice

go 1.23

require (
    github.com/caarlos0/env/v11 v11.2.2
    github.com/gin-gonic/gin v1.10.1
    github.com/go-playground/validator/v10 v10.22.1
    github.com/google/uuid v1.6.0
    github.com/jackc/pgx/v5 v5.7.6
    golang.org/x/sync v0.18.0
)
```

Run `go get -u ./...` on a new project and keep the resolved versions. The numbers above are floors observed when this page was written.

---

## Project structure

```text
cmd/server/main.go          # at most 50 lines: signal context, call cmd.Execute
internal/
  cmd/run.go                # about 150 lines: load config, wire dependencies, run server
  config/config.go          # env-driven Config
  api/
    server.go               # gin engine, route mounting, http.Server
    middleware/
      request_id.go
      request_logging.go
      auth.go
      recovery.go
      cors.go
    handlers/
      users.go              # one file per resource
      streams.go            # SSE and WebSocket endpoints
  httperr/                  # one funnel from errors to responses
  domain/                   # smart-constructor types (Email, UserID, ...)
  service/                  # business logic
  store/                    # pgx and sqlc
  obs/
    logger.go               # slog setup, context handler
```

Dependencies flow inward: `api` depends on `service`, `service` on `domain` and storage interfaces, `store` implements those interfaces. Nothing imports `api`.

---

## `cmd/server/main.go`

```go
package main

import (
    "context"
    "log/slog"
    "os"
    "os/signal"
    "syscall"

    "github.com/your-org/myservice/internal/cmd"
)

func main() {
    ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer stop()

    if err := cmd.Execute(ctx); err != nil {
        slog.Error("fatal", slog.Any("err", err))
        os.Exit(1)
    }
}
```

That is all of `main`. Any further logic belongs in `internal/cmd`.

---

## `internal/config/config.go`

```go
package config

import (
    "fmt"
    "time"

    "github.com/caarlos0/env/v11"
)

type Config struct {
    Host            string        `env:"HOST"             envDefault:"0.0.0.0"`
    Port            int           `env:"PORT"             envDefault:"8080"`
    DatabaseURL     string        `env:"DATABASE_URL,required"`
    ReadTimeout     time.Duration `env:"READ_TIMEOUT"     envDefault:"15s"`
    WriteTimeout    time.Duration `env:"WRITE_TIMEOUT"    envDefault:"30s"`
    ShutdownTimeout time.Duration `env:"SHUTDOWN_TIMEOUT" envDefault:"20s"`
    LogLevel        string        `env:"LOG_LEVEL"        envDefault:"info"`
    LogFormat       string        `env:"LOG_FORMAT"       envDefault:"json"`
    Env             string        `env:"ENV"              envDefault:"development"`
    AllowedOrigins  []string      `env:"ALLOWED_ORIGINS"  envSeparator:","`
}

func Load() (Config, error) {
    cfg, err := env.ParseAs[Config]()
    if err != nil {
        return Config{}, fmt.Errorf("parse config: %w", err)
    }
    return cfg, nil
}
```

Configuration is a value passed into constructors. Package-level globals for config make tests order-dependent. A long-lived streaming endpoint raises `WriteTimeout` problems, so the SSE section shows a per-request override.

---

## `internal/obs/logger.go`

```go
package obs

import (
    "context"
    "log/slog"
    "os"
)

type ctxKey struct{ name string }

var requestIDKey = ctxKey{"request_id"}

func NewLogger(level, format string) *slog.Logger {
    var lvl slog.Level
    if err := lvl.UnmarshalText([]byte(level)); err != nil {
        lvl = slog.LevelInfo
    }
    opts := &slog.HandlerOptions{Level: lvl, AddSource: true}

    var h slog.Handler
    switch format {
    case "text":
        h = slog.NewTextHandler(os.Stdout, opts)
    default:
        h = slog.NewJSONHandler(os.Stdout, opts)
    }
    return slog.New(&ctxHandler{Handler: h})
}

// ctxHandler copies the request ID from the context into every record.
type ctxHandler struct{ slog.Handler }

func (h *ctxHandler) Handle(ctx context.Context, r slog.Record) error {
    if id, ok := ctx.Value(requestIDKey).(string); ok && id != "" {
        r.AddAttrs(slog.String("request_id", id))
    }
    return h.Handler.Handle(ctx, r)
}

// WithAttrs and WithGroup keep the wrapper in place when callers derive loggers.
func (h *ctxHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
    return &ctxHandler{Handler: h.Handler.WithAttrs(attrs)}
}

func (h *ctxHandler) WithGroup(name string) slog.Handler {
    return &ctxHandler{Handler: h.Handler.WithGroup(name)}
}

func WithRequestID(ctx context.Context, id string) context.Context {
    return context.WithValue(ctx, requestIDKey, id)
}
```

Embedding `slog.Handler` alone would drop the wrapper after `logger.With(...)`, because the embedded `WithAttrs` returns the inner handler. Override `WithAttrs` and `WithGroup` as shown, and call logging methods with a context (`InfoContext`) so the request ID attaches.

---

## `internal/api/server.go`

```go
package api

import (
    "context"
    "errors"
    "fmt"
    "log/slog"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"

    "github.com/your-org/myservice/internal/api/handlers"
    "github.com/your-org/myservice/internal/api/middleware"
    "github.com/your-org/myservice/internal/config"
)

type Server struct {
    cfg    config.Config
    srv    *http.Server
    logger *slog.Logger
}

func New(cfg config.Config, logger *slog.Logger, h *handlers.Handler) *Server {
    gin.SetMode(gin.ReleaseMode)
    r := gin.New()
    _ = r.SetTrustedProxies(nil) // add proxy CIDRs here when behind a load balancer

    r.Use(
        middleware.RequestID(),
        middleware.Recovery(logger),
        middleware.RequestLogger(logger),
        middleware.CORS(cfg.AllowedOrigins),
    )
    h.Mount(r)

    return &Server{
        cfg:    cfg,
        logger: logger,
        srv: &http.Server{
            Addr:              fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
            Handler:           r,
            ReadHeaderTimeout: 5 * time.Second, // slowloris guard
            ReadTimeout:       cfg.ReadTimeout,
            WriteTimeout:      cfg.WriteTimeout,
            IdleTimeout:       90 * time.Second,
        },
    }
}

func (s *Server) Run(ctx context.Context) error {
    errCh := make(chan error, 1)
    go func() {
        s.logger.InfoContext(ctx, "server starting", slog.String("addr", s.srv.Addr))
        if err := s.srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
            errCh <- err
        }
        close(errCh)
    }()

    select {
    case <-ctx.Done():
        s.logger.InfoContext(ctx, "shutdown signal received")
        shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), s.cfg.ShutdownTimeout)
        defer cancel()
        if err := s.srv.Shutdown(shutdownCtx); err != nil {
            return fmt.Errorf("shutdown: %w", err)
        }
        return nil
    case err := <-errCh:
        return err
    }
}
```

Notes:

- `gin.New()` rather than `gin.Default()`: `Default()` installs the text logger and a recovery handler without logger injection. Both are replaced by the slog-based middleware.
- `gin.SetMode(gin.ReleaseMode)` silences debug output. Read the mode from `cfg.Env` if development needs it.
- `http.Server` carries explicit timeouts. Zero values mean "wait forever", an easy denial-of-service surface.
- `SetTrustedProxies(nil)` makes `c.ClientIP()` use the socket address. Behind a proxy, list its address range; otherwise any client can forge `X-Forwarded-For`.
- Shutdown uses `context.WithoutCancel(ctx)` because `ctx` is already cancelled at that point; the fresh deadline gives in-flight requests time to finish.
- `ListenAndServe` returning `http.ErrServerClosed` is the normal shutdown path and is filtered out with `errors.Is`.

---

## Middleware order

```text
RequestID -> Recovery -> Logger -> CORS -> Auth -> Handler
   (1)         (2)        (3)       (4)     (5)
```

1. **RequestID** runs first so every later step sees the ID.
2. **Recovery** wraps everything after it, so a panic in CORS or Auth is still caught.
3. **Logger** records the final status, including the 500 produced by Recovery.
4. **CORS** precedes Auth because preflight `OPTIONS` requests carry no credentials.
5. **Auth** is the last cross-cutting step. Role checks mount on sub-groups.

```go
// public
api := r.Group("/api/v1")
{
    api.POST("/auth/login", h.Login)
    api.GET("/healthz", h.Healthz)
}

// authenticated
authed := r.Group("/api/v1", middleware.Auth(authSvc))
{
    authed.GET("/users/:id", h.GetUser)
    authed.POST("/users", h.CreateUser)
}

// admin only
admin := r.Group("/api/v1/admin", middleware.Auth(authSvc), middleware.RequireRole("admin"))
{
    admin.GET("/users", h.ListAllUsers)
}
```

Health endpoints stay outside the authenticated groups. Add a body-size cap to the global stack with `http.MaxBytesReader` (shown below) so every route gets one.

---

## Middleware examples

### `request_id.go`

```go
func RequestID() gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.GetHeader("X-Request-ID")
        if id == "" || len(id) > 64 {
            id = uuid.Must(uuid.NewV7()).String()
        }
        c.Request = c.Request.WithContext(obs.WithRequestID(c.Request.Context(), id))
        c.Header("X-Request-ID", id)
        c.Next()
    }
}
```

An inbound ID is accepted only up to a sane length so clients cannot flood logs with huge values.

### `recovery.go`

```go
func Recovery(logger *slog.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        defer func() {
            if rec := recover(); rec != nil {
                logger.ErrorContext(c.Request.Context(), "panic recovered",
                    slog.Any("panic", rec),
                    slog.String("stack", string(debug.Stack())),
                )
                if !c.Writer.Written() {
                    c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
                    return
                }
                c.Abort()
            }
        }()
        c.Next()
    }
}
```

`http.ErrAbortHandler` is a deliberate panic used by `net/http` to abort a response; re-panic it (`if rec == http.ErrAbortHandler { panic(rec) }`) so the server can close the connection as intended.

### `request_logging.go`

```go
func RequestLogger(logger *slog.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        c.Next()
        logger.InfoContext(c.Request.Context(), "http request",
            slog.String("method", c.Request.Method),
            slog.String("route", c.FullPath()),
            slog.Int("status", c.Writer.Status()),
            slog.Int("bytes", c.Writer.Size()),
            slog.Duration("elapsed", time.Since(start)),
            slog.String("ip", c.ClientIP()),
        )
    }
}
```

Log `c.FullPath()` (the route template such as `/users/:id`) to keep cardinality low, and keep raw query strings out of logs because they may carry tokens. `sloglint` expects typed attributes like these.

### `cors.go`

```go
func CORS(allowed []string) gin.HandlerFunc {
    set := make(map[string]struct{}, len(allowed))
    for _, o := range allowed {
        set[o] = struct{}{}
    }
    return func(c *gin.Context) {
        origin := c.GetHeader("Origin")
        if _, ok := set[origin]; ok {
            c.Header("Access-Control-Allow-Origin", origin)
            c.Header("Vary", "Origin")
            c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
            c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
        }
        if c.Request.Method == http.MethodOptions {
            c.AbortWithStatus(http.StatusNoContent)
            return
        }
        c.Next()
    }
}
```

An allow-list of origins beats `*`, which cannot be combined with credentials anyway. `github.com/gin-contrib/cors` offers a maintained implementation when the rules grow. Preflight requests return before Auth runs.

### Body limit

```go
func MaxBody(n int64) gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, n)
        c.Next()
    }
}
```

---

## Handlers: the standard shape

```go
package handlers

type Handler struct {
    Users  *service.UserService
    Pool   *pgxpool.Pool
    Logger *slog.Logger
}

func (h *Handler) Mount(r gin.IRouter) {
    api := r.Group("/api/v1")
    api.POST("/users", h.CreateUser)
    api.GET("/users/:id", h.GetUser)
}

type createUserReq struct {
    Email    string `json:"email"    binding:"required,email"`
    Username string `json:"username" binding:"required,alphanum,min=3,max=32"`
}

func (h *Handler) CreateUser(c *gin.Context) {
    var req createUserReq
    if err := c.ShouldBindJSON(&req); err != nil {
        writeBindingError(c, err)
        return
    }

    email, err := domain.NewEmail(req.Email)
    if err != nil {
        httperr.Write(c, err)
        return
    }
    username, err := domain.NewUsername(req.Username)
    if err != nil {
        httperr.Write(c, err)
        return
    }

    user, err := h.Users.Create(c.Request.Context(), email, username)
    if err != nil {
        httperr.Write(c, err)
        return
    }
    c.JSON(http.StatusCreated, user)
}

func writeBindingError(c *gin.Context, err error) {
    var vErr validator.ValidationErrors
    if errors.As(err, &vErr) {
        out := make(map[string]string, len(vErr))
        for _, fe := range vErr {
            out[fe.Field()] = fe.Tag()
        }
        c.JSON(http.StatusBadRequest, gin.H{"errors": out})
        return
    }
    c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_json"})
}
```

A handler does four things in order: bind, parse into domain types, call the service with `c.Request.Context()`, write the response. Business logic stays in the service. `data-modeling.md` holds the validator tag reference, and `error-handling.md` the `httperr.Write` funnel.

---

## Server-sent events

```go
func (h *Handler) StreamChat(c *gin.Context) {
    ctx, cancel := context.WithCancel(c.Request.Context())
    defer cancel()

    // Streaming outlives the server's WriteTimeout, so extend it for this response.
    rc := http.NewResponseController(c.Writer)
    _ = rc.SetWriteDeadline(time.Time{})

    // 1. Headers go out before the first byte of body.
    c.Header("Content-Type", "text/event-stream")
    c.Header("Cache-Control", "no-cache")
    c.Header("Connection", "keep-alive")
    c.Header("X-Accel-Buffering", "no") // stop nginx buffering

    chunks, errs := h.svc.StreamCompletions(ctx, req)
    keepAlive := time.NewTicker(15 * time.Second)
    defer keepAlive.Stop()

    for {
        select {
        case <-ctx.Done():
            return // client disconnected
        case <-keepAlive.C:
            fmt.Fprint(c.Writer, ": keep-alive\n\n")
            _ = rc.Flush()
        case chunk, ok := <-chunks:
            if !ok {
                fmt.Fprint(c.Writer, "data: [DONE]\n\n")
                _ = rc.Flush()
                return
            }
            fmt.Fprintf(c.Writer, "data: %s\n\n", chunk)
            if err := rc.Flush(); err != nil {
                return
            }
        case err := <-errs:
            fmt.Fprintf(c.Writer, "event: error\ndata: %s\n\n", sseEscape(err.Error()))
            _ = rc.Flush()
            return
        }
    }
}
```

Facts that make streaming work:

- **Set headers before the first write.** Otherwise the framework chooses `text/plain`.
- **Flush after each event.** `http.NewResponseController(w).Flush()` (Go 1.20) works through wrapped writers; the older form asserts `w.(http.Flusher)`. Without flushing, the client receives one blob at the end.
- **Honour `ctx.Done()`.** A closed connection must stop upstream work, or tokens keep generating for nobody.
- **Every event ends with a blank line.** The double newline is part of the wire format.
- **`data:` lines carry no raw newlines.** Split multi-line payloads into several `data:` lines or encode as JSON (`sseEscape` stands for that step).
- **Send comment lines (`: keep-alive`)** every ten to thirty seconds so proxies keep the connection open.
- **Per-response deadlines** (`SetWriteDeadline`) beat a global `WriteTimeout` of zero, because ordinary endpoints keep their protection.

---

## WebSocket upgrade

```go
import "github.com/gorilla/websocket"

var upgrader = websocket.Upgrader{
    ReadBufferSize:  4096,
    WriteBufferSize: 4096,
    CheckOrigin: func(r *http.Request) bool {
        return isAllowedOrigin(r.Header.Get("Origin"))
    },
}

func (h *Handler) WebSocketEcho(c *gin.Context) {
    conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
    if err != nil {
        slog.ErrorContext(c.Request.Context(), "ws upgrade failed", slog.Any("err", err))
        return
    }
    defer conn.Close()

    conn.SetReadLimit(1 << 20)
    _ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    conn.SetPongHandler(func(string) error {
        return conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    })

    for {
        mt, msg, err := conn.ReadMessage()
        if err != nil {
            return
        }
        if err := conn.WriteMessage(mt, msg); err != nil {
            return
        }
    }
}
```

`CheckOrigin` that always returns true allows cross-site hijacking of authenticated sockets, so compare the origin to the allow-list. A ping ticker goroutine (every 30 seconds) with the pong handler above detects dead peers. Gorilla's connection allows one concurrent reader and one concurrent writer, so serialize writes through a single goroutine. `github.com/coder/websocket` is a context-aware alternative with a smaller API. The `wsrelay` package in CLIProxyAPI is a worked example of relaying sockets at scale.

---

## Database wiring

```go
func NewPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
    cfg, err := pgxpool.ParseConfig(dsn)
    if err != nil {
        return nil, fmt.Errorf("parse dsn: %w", err)
    }
    cfg.MaxConns = 25
    cfg.MinConns = 5
    cfg.MaxConnLifetime = time.Hour
    cfg.MaxConnIdleTime = 30 * time.Minute

    pool, err := pgxpool.NewWithConfig(ctx, cfg)
    if err != nil {
        return nil, fmt.Errorf("connect: %w", err)
    }
    if err := pool.Ping(ctx); err != nil {
        pool.Close()
        return nil, fmt.Errorf("ping: %w", err)
    }
    return pool, nil
}
```

The pool is created once in `internal/cmd/run.go`, passed to stores by constructor, and closed after the server finishes shutting down (`defer pool.Close()`). It is never a package-level variable. See `sqlc-pgx.md` for queries and transactions.

---

## Composition root

```go
// internal/cmd/run.go
func Execute(ctx context.Context) error {
    cfg, err := config.Load()
    if err != nil {
        return err
    }
    logger := obs.NewLogger(cfg.LogLevel, cfg.LogFormat)
    slog.SetDefault(logger)

    pool, err := store.NewPool(ctx, cfg.DatabaseURL)
    if err != nil {
        return err
    }
    defer pool.Close()

    users := service.NewUserService(store.NewUserStore(pool), clock.System)
    h := &handlers.Handler{Users: users, Pool: pool, Logger: logger}

    return api.New(cfg, logger, h).Run(ctx)
}
```

All wiring happens here, in plain code. No dependency-injection framework is needed at this size, and the explicit graph reads like documentation.

---

## Health and readiness

```go
func (h *Handler) Healthz(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) }

func (h *Handler) Readyz(c *gin.Context) {
    ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
    defer cancel()
    if err := h.Pool.Ping(ctx); err != nil {
        h.Logger.WarnContext(ctx, "readiness check failed", slog.Any("err", err))
        c.JSON(http.StatusServiceUnavailable, gin.H{"db": "down"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"ok": true})
}
```

Liveness (`/healthz`) reports that the process runs; readiness (`/readyz`) reports that dependencies answer. Orchestrators restart on liveness failures and stop routing traffic on readiness failures, so keep database checks out of liveness. Mount both before Auth, and keep error details out of the response body (log them instead).

---

## Testing the server

```go
func Test_CreateUser_returns_201_for_valid_input(t *testing.T) {
    // Given
    gin.SetMode(gin.TestMode)
    r := gin.New()
    newTestHandler(t).Mount(r)

    body := `{"email":"a@b.com","username":"alice"}`
    req := httptest.NewRequest(http.MethodPost, "/api/v1/users", strings.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    rec := httptest.NewRecorder()

    // When
    r.ServeHTTP(rec, req)

    // Then
    require.Equal(t, http.StatusCreated, rec.Code)
    var got struct {
        ID string `json:"id"`
    }
    require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
    require.NotEmpty(t, got.ID)
}
```

`testing.md` covers table-driven handler tests, `httptest.NewServer` for streaming and WebSocket paths, container-backed integration tests and goroutine-leak detection. Test SSE handlers through a real `httptest.Server` because `ResponseRecorder` does not stream.

---

## Pitfalls

- `gin.Default()` in production code, which brings an unstructured logger.
- Missing server timeouts, or a global `WriteTimeout` that silently kills streams.
- Reading `c.ClientIP()` while trusting every proxy header.
- Starting goroutines inside handlers without tying them to `c.Request.Context()` (gin recycles the `*gin.Context`; copy it with `c.Copy()` before using it in a goroutine that outlives the request).
- Returning `err.Error()` of internal failures to clients.
- Global `*sql.DB` or `*pgxpool.Pool` variables.
- Logging request bodies, which can contain credentials.

## Sources

- gin documentation: https://gin-gonic.com/docs/
- CLIProxyAPI (reference implementation): https://github.com/router-for-me/CLIProxyAPI
- pgxpool: https://pkg.go.dev/github.com/jackc/pgx/v5/pgxpool
- Server-sent events specification: https://html.spec.whatwg.org/multipage/server-sent-events.html
- `http.Server.Shutdown`: https://pkg.go.dev/net/http#Server.Shutdown
- `http.ResponseController`: https://pkg.go.dev/net/http#ResponseController
