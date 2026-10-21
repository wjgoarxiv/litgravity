# Error Handling

Go errors look simple and hide several traps. This page lists the moves that keep error chains intact, branch logic correct, and logs readable: sentinels, typed errors, wrapping with `%w`, `errors.Is` and `errors.As`, panics, cleanup with `defer`, and one funnel for HTTP responses.

---

## Five rules

1. **Wrap on the way up with `%w` and one fact of context.** A bare `return err` from a non-trivial site hides where the failure happened.
2. **Compare with `errors.Is`.** Wrapping breaks `==`, and `errorlint` reports comparisons against error values.
3. **Extract with `errors.As`.** Type assertions on errors miss wrapped values.
4. **Reserve `panic` for programmer errors found at start-up.** Library code returns `(T, error)` for bad input and environment failures.
5. **Release resources with `defer` on the line after acquiring them.**

---

## Sentinel errors for programmatic checks

```go
package domain

import (
    "errors"
    "fmt"
    "strings"
)

var (
    ErrInvalidEmail = errors.New("invalid email")
    ErrInvalidPhone = errors.New("invalid phone")
    ErrInvalidAge   = errors.New("invalid age")
)

func NewEmail(s string) (Email, error) {
    if !emailRe.MatchString(s) {
        return Email{}, fmt.Errorf("email %q: %w", s, ErrInvalidEmail)
    }
    return Email{raw: strings.ToLower(s)}, nil
}
```

The caller branches on identity:

```go
email, err := domain.NewEmail(input)
if errors.Is(err, domain.ErrInvalidEmail) {
    c.JSON(http.StatusBadRequest, gin.H{"error": "email format"})
    return
}
```

`errors.Is` walks the chain. `err == domain.ErrInvalidEmail` returns false for the wrapped value built above. The Go convention is for package sentinels to read without a package prefix in the message, since wrapping adds the path (`save user: email "x": invalid email`).

Sentinels suit conditions with no payload: not found, already exists, unauthorized, invalid input class.

---

## Typed errors for structured data

Use a struct error when callers need fields from it: the offending value, a field name, an upstream status.

```go
type ValidationError struct {
    Field string
    Value string
    Rule  string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation: %s=%q failed %s", e.Field, e.Value, e.Rule)
}

var ErrValidation = errors.New("validation failed")

// Is lets callers match the whole class with errors.Is(err, ErrValidation).
func (e *ValidationError) Is(target error) bool { return target == ErrValidation }
```

Caller:

```go
var vErr *ValidationError
if errors.As(err, &vErr) {
    c.JSON(http.StatusBadRequest, gin.H{"field": vErr.Field, "rule": vErr.Rule})
    return
}
```

`errors.As` needs a pointer to a variable of the target type. When the error type is `*ValidationError`, pass `&vErr` where `vErr` is `*ValidationError`. A mismatch between the declared type and the receiver (value receiver vs pointer receiver) is the usual reason it never matches, and `go vet` reports an invalid target.

Give typed errors an `Unwrap() error` method when they hold a cause:

```go
type QueryError struct {
    Query string
    Err   error
}

func (e *QueryError) Error() string { return "query " + e.Query + ": " + e.Err.Error() }
func (e *QueryError) Unwrap() error { return e.Err }
```

---

## Wrapping with `%w`

```go
// Drops context.
return err

// Keeps text and loses the chain: errors.Is and errors.As stop working.
return fmt.Errorf("failed to save user: %v", err)

// Keeps both.
return fmt.Errorf("save user %s: %w", userID, err)
```

Wrap once per layer, and add one new fact each time:

```text
handler:  create user request: %w
service:  validate inputs: %w
domain:   email "foo": invalid email
```

The resulting message reads as a path: `create user request: validate inputs: email "foo": invalid email`. Start messages in lower case without trailing punctuation, and skip filler such as "failed to" or "error while", since the word error is implied.

`fmt.Errorf` accepts several `%w` verbs (Go 1.20 and newer) when an error has more than one cause.

### `errors.Join` for batches

```go
var errs []error
if _, err := NewEmail(req.Email); err != nil {
    errs = append(errs, fmt.Errorf("email: %w", err))
}
if _, err := NewUsername(req.Username); err != nil {
    errs = append(errs, fmt.Errorf("username: %w", err))
}
if err := errors.Join(errs...); err != nil {
    return err
}
```

`errors.Join` returns nil when every element is nil, so the final check works without a length test. `errors.Is` and `errors.As` search each joined error. Use it for batch validation and multi-step cleanup.

---

## Panics

Panics belong in these places:

- Package-level initialization from literals, through a `Must*` helper, so a typo fails at process start:
  ```go
  func MustParseURL(s string) *url.URL {
      u, err := url.Parse(s)
      if err != nil {
          panic(err)
      }
      return u
  }

  var defaultAPI = MustParseURL("https://api.example.com")
  ```
- The `default` branch of an exhaustive sealed-interface switch (see `type-patterns.md`), which is reachable only after a refactor that forgot a case.
- `main` start-up when configuration is missing and the process cannot run.

Return errors everywhere else: handlers, services, stores, and every goroutine that outlives a request. gin's `Recovery` middleware is a last-resort net that logs the stack and answers 500; a panic caught there has already lost its typed error. A goroutine started with `go` has no caller to recover it, so a panic inside one takes the process down unless the goroutine installs its own `recover` and reports the failure.

---

## `defer` for resources

```go
func writeReport(path string, data []byte) (err error) {
    f, err := os.Create(path)
    if err != nil {
        return fmt.Errorf("create %s: %w", path, err)
    }
    defer func() {
        if cerr := f.Close(); cerr != nil && err == nil {
            err = fmt.Errorf("close %s: %w", path, cerr)
        }
    }()

    if _, err := f.Write(data); err != nil {
        return fmt.Errorf("write %s: %w", path, err)
    }
    return nil
}
```

Points to keep:

- Open and defer on adjacent lines.
- A named return `err` lets the deferred close report a failure that matters for writes (a failed close can mean lost data).
- `bodyclose` finds an HTTP response body that is never closed. `sqlclosecheck` finds `rows` and statements that are never closed.
- Read-only handles can use `defer f.Close()` directly; `errcheck` accepts it when `exclude-functions` lists the method, or when the handle is a reader.
- `defer` inside a loop runs at function exit. Wrap the body in a function when each iteration owns a resource.

### Joining cleanup errors

```go
func process(path string) (err error) {
    f, err := os.Open(path)
    if err != nil {
        return fmt.Errorf("open %s: %w", path, err)
    }
    defer func() { err = errors.Join(err, f.Close()) }()

    return consume(f)
}
```

Both failures survive: the main operation's and the close's.

---

## One funnel for HTTP errors

Define one package that maps domain errors to status codes, and have every handler call it:

```go
package httperr

import (
    "errors"
    "log/slog"
    "net/http"

    "github.com/gin-gonic/gin"

    "myservice/internal/domain"
)

type APIError struct {
    Status  int    `json:"-"`
    Code    string `json:"code"`
    Message string `json:"message"`
}

func (e *APIError) Error() string { return e.Code + ": " + e.Message }

var (
    ErrNotFound     = errors.New("not found")
    ErrUnauthorized = errors.New("unauthorized")

    notFound     = &APIError{Status: http.StatusNotFound, Code: "not_found", Message: "resource not found"}
    unauthorized = &APIError{Status: http.StatusUnauthorized, Code: "unauthorized", Message: "authentication required"}
    internal     = &APIError{Status: http.StatusInternalServerError, Code: "internal", Message: "internal error"}
)

// From converts any error into the response contract.
func From(err error) *APIError {
    var apiErr *APIError
    switch {
    case err == nil:
        return nil
    case errors.As(err, &apiErr):
        return apiErr
    case errors.Is(err, domain.ErrInvalidEmail), errors.Is(err, domain.ErrInvalidUsername):
        return &APIError{Status: http.StatusBadRequest, Code: "validation", Message: err.Error()}
    case errors.Is(err, ErrNotFound):
        return notFound
    case errors.Is(err, ErrUnauthorized):
        return unauthorized
    default:
        return internal
    }
}

// Write logs unexpected failures once and answers with the mapped body.
func Write(c *gin.Context, err error) {
    apiErr := From(err)
    if apiErr == internal {
        slog.ErrorContext(c.Request.Context(), "unmapped error", slog.Any("err", err))
    }
    c.AbortWithStatusJSON(apiErr.Status, apiErr)
}
```

Handlers shrink to:

```go
user, err := h.svc.Create(c.Request.Context(), req)
if err != nil {
    httperr.Write(c, err)
    return
}
c.JSON(http.StatusCreated, user)
```

Never put `err.Error()` of an internal failure in a response body, because it can leak SQL text, hostnames or paths. The funnel returns the generic body and logs the detail with the request ID.

For Connect services the same idea uses `connect.NewError(connect.CodeNotFound, err)`; see `grpc-connect.md`.

---

## `errgroup` across goroutines

```go
import "golang.org/x/sync/errgroup"

func fetchAll(ctx context.Context, urls []string) ([][]byte, error) {
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

`WithContext` cancels the shared context on the first error, `SetLimit` bounds concurrency, and `Wait` returns that first error. Each goroutine writes to its own slice index, so no mutex is needed. Since Go 1.22 the loop variables `i` and `u` are per-iteration, which makes the closure above correct. See `concurrency.md` for the larger toolbox.

---

## Logging errors

```go
slog.ErrorContext(ctx, "save user failed",
    slog.String("user_id", string(id)),
    slog.Any("err", err),
)
```

Log at the outermost frame that handles the error, and return it unlogged from the inner frames. A log line at every wrap site produces five records for one failure. `sloglint` favours `slog.Any("err", err)` over `slog.String("err", err.Error())`, since handlers can then inspect the value.

---

## Typed nil trap

```go
// Returns a non-nil interface that holds a nil pointer.
func bad() error {
    var e *MyError
    return e
}

if err := bad(); err != nil {
    // entered: the interface has a type, so the comparison with nil is false
}
```

Return a literal `nil` for the success path. `nilaway` and `nilnil` help with `(T, error)` pairs, and a code review habit helps with the rest: a function that returns `error` returns either `nil` or a constructed value.

---

## Antipatterns

| Pattern | Problem | Replacement |
|---|---|---|
| `_ = err` | silent loss | handle, wrap or log it |
| ten nested `return err` with no context | no path in the message | `fmt.Errorf("step: %w", err)` per layer |
| `panic(err)` in handlers | loses the typed error | `httperr.Write(c, err)` |
| `err.Error() == "text"` | breaks on any rewording or wrap | define a sentinel, use `errors.Is` |
| `err == sql.ErrNoRows` | breaks under wrapping | `errors.Is(err, sql.ErrNoRows)` |
| `log.Fatal` in library code | ends the caller's process | return the error |
| `strings.Contains(err.Error(), ...)` | string matching on messages | typed error or sentinel |
| returning a typed nil as `error` | `err != nil` is true | return untyped `nil` |

## Sources

- Go blog, working with errors in Go 1.13: https://go.dev/blog/go1.13-errors
- `errors.Join`: https://pkg.go.dev/errors#Join
- errorlint: https://github.com/polyfloyd/go-errorlint
- nilaway: https://github.com/uber-go/nilaway
