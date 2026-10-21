# Testing

Go-specific recipes for the lit-code testing discipline: Given/When/Then structure, real collaborators before mocks, tests that are both fast and accurate. Covered here: naming, table-driven tests, `require` and `assert`, fakes and mocks, end-to-end scenarios, goroutine-leak checks, snapshots, property tests, HTTP testing, determinism, benchmarks, coverage and TUI tests.

---

## Tools

| Need | Use |
|---|---|
| Assertions | `github.com/stretchr/testify/require`; `assert` only inside table loops |
| Mocks | `go.uber.org/mock` (`mockgen`), the maintained successor to gomock |
| Goroutine leaks | `go.uber.org/goleak` |
| Snapshots | `github.com/hexops/autogold/v2` |
| Property-based | `pgregory.net/rapid`, plus native fuzzing (`go test -fuzz`) |
| Outbound HTTP stubs | stdlib `net/http/httptest`; `github.com/h2non/gock` for transports you do not control |
| Containers | `github.com/testcontainers/testcontainers-go` and its modules |
| TUI | `charm.land/bubbletea/v2/teatest` |
| Benchmarks | stdlib `testing.B`, `golang.org/x/perf/cmd/benchstat` |
| Time control | injected `Clock`, or `testing/synctest` (stable in Go 1.25) |

---

## Naming: behaviour in the name

```go
// Test_<Subject>_<Action>_<Outcome>[_when_<Condition>]

func Test_Email_NewEmail_lowercases_input(t *testing.T)
func Test_Email_NewEmail_rejects_input_without_at_sign(t *testing.T)
func Test_UserService_Create_persists_user_when_inputs_valid(t *testing.T)
func Test_UserService_Create_returns_validation_error_when_email_invalid(t *testing.T)
```

A reader should know which behaviour a test pins down before opening its body. A name that needs a comment is a misnamed test. Underscored names read like sentences. If `revive`'s `var-naming` objects, exclude `_test.go` files from that rule in `.golangci.yml`.

---

## A single test

```go
func Test_Email_NewEmail_rejects_input_without_at_sign(t *testing.T) {
    // Given
    raw := "not-an-email"

    // When
    _, err := domain.NewEmail(raw)

    // Then
    require.ErrorIs(t, err, domain.ErrInvalidEmail)
}
```

`require.*` stops the test at the first failure and suits preconditions and the primary assertion. `assert.*` continues and suits table rows where every mismatch should print. Use `require.ErrorIs` and `require.ErrorAs` for errors, never string comparison. Use `t.Helper()` in helpers so failures point at the caller. Put shared setup in a helper that registers its own cleanup with `t.Cleanup`.

Built-ins save code: `t.TempDir()` for scratch directories, `t.Setenv` for environment (automatically restored), `t.Chdir` (Go 1.24) for working directory, and `t.Context()` (Go 1.24) for a context cancelled when the test ends.

---

## Table-driven tests

```go
func Test_Email_NewEmail(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    string
        wantErr error
    }{
        {"lowercases", "ALICE@example.com", "alice@example.com", nil},
        {"trims whitespace", "  bob@example.com  ", "bob@example.com", nil},
        {"rejects missing at sign", "no-at-sign", "", domain.ErrInvalidEmail},
        {"rejects empty", "", "", domain.ErrInvalidEmail},
        {"rejects oversize", strings.Repeat("a", 256) + "@e.com", "", domain.ErrInvalidEmail},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // When
            got, err := domain.NewEmail(tt.input)

            // Then
            if tt.wantErr != nil {
                require.ErrorIs(t, err, tt.wantErr)
                return
            }
            require.NoError(t, err)
            assert.Equal(t, tt.want, got.String())
        })
    }
}
```

Guidelines:

- One scenario per row. A row with five unrelated assertions hides failures.
- Write subtest names as short lowercase phrases. `go test -run 'Test_Email_NewEmail/rejects_missing_at_sign'` runs one row (spaces become underscores).
- Since Go 1.22 each iteration has its own `tt`, so `tt := tt` is dead code and `copyloopvar` reports it.
- Add `t.Parallel()` to rows that share no state; call it first in the subtest.
- A map keyed by name (`map[string]struct{...}`) randomizes order and forces unique names.

---

## Fewer mocks: the order of preference

1. **The real implementation.** Domain types, pure functions and value objects are fast, so construct them.
2. **An in-memory fake** that satisfies the interface and has its own tests proving parity with the real implementation.
3. **`httptest.Server`** for HTTP collaborators: real wire protocol, no internet.
4. **testcontainers** for stateful collaborators: PostgreSQL, Redis, S3-compatible storage, Kafka.
5. **gomock** for what is left: clocks, randomness, SaaS APIs without a sandbox.

### A fake

```go
type UserRepo interface {
    Save(ctx context.Context, u domain.User) error
    Get(ctx context.Context, id domain.UserID) (domain.User, error)
}

type FakeUserRepo struct {
    mu    sync.RWMutex
    users map[domain.UserID]domain.User
}

func NewFakeUserRepo() *FakeUserRepo {
    return &FakeUserRepo{users: map[domain.UserID]domain.User{}}
}

func (r *FakeUserRepo) Save(_ context.Context, u domain.User) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    r.users[u.ID] = u
    return nil
}

func (r *FakeUserRepo) Get(_ context.Context, id domain.UserID) (domain.User, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    u, ok := r.users[id]
    if !ok {
        return domain.User{}, domain.ErrUserNotFound
    }
    return u, nil
}
```

Tests against the fake keep passing when the production repository changes internally. Tests against a generated stub break on any refactor of call order. Run one contract suite against both the fake and the real implementation (container-backed) through a shared function `func repoContract(t *testing.T, newRepo func(*testing.T) UserRepo)`. Divergence between the two runs is the bug report on the fake.

### A mock for the unmockable

```go
//go:generate mockgen -source=clock.go -destination=mocks/clock_mock.go -package=mocks

type Clock interface{ Now() time.Time }

// in a test
ctrl := gomock.NewController(t)
clock := mocks.NewMockClock(ctrl)
clock.EXPECT().Now().Return(fixedTime).AnyTimes()
```

Mock the narrowest seam, and prefer a three-line hand-written fake (`type fixedClock time.Time`) when the interface has one method.

---

## End-to-end scenarios

```go
//go:build e2e

func Test_E2E_user_can_sign_up_then_log_in(t *testing.T) {
    // Given
    ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
    defer cancel()
    pool := newTestPool(t)          // testcontainers PostgreSQL
    srv := startServer(t, pool)     // real engine on an ephemeral port
    client := srv.Client()

    // When
    resp, err := client.Post(srv.URL+"/api/v1/users", "application/json",
        strings.NewReader(`{"email":"a@b.com","username":"alice","password":"PassWord!23"}`))
    require.NoError(t, err)
    require.Equal(t, http.StatusCreated, resp.StatusCode)
    require.NoError(t, resp.Body.Close())

    resp, err = client.Post(srv.URL+"/api/v1/auth/login", "application/json",
        strings.NewReader(`{"email":"a@b.com","password":"PassWord!23"}`))
    require.NoError(t, err)
    defer resp.Body.Close()
    require.Equal(t, http.StatusOK, resp.StatusCode)

    var body struct {
        Token string `json:"token"`
    }
    require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))

    // Then
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/api/v1/me", nil)
    require.NoError(t, err)
    req.Header.Set("Authorization", "Bearer "+body.Token)
    me, err := client.Do(req)
    require.NoError(t, err)
    defer me.Body.Close()
    require.Equal(t, http.StatusOK, me.StatusCode)
}
```

Conventions:

- The `//go:build e2e` tag separates slow scenarios: `go test -tags=e2e ./...`.
- One narrative per test and one test per user-visible outcome.
- Real database, real router, real HTTP; no mocks. These tests exist to catch wiring faults.
- Every scenario carries a timeout so a hang fails fast.
- Close response bodies in tests too; `bodyclose` runs on test files.

---

## Goroutine leak detection

```go
package mypkg

import (
    "testing"

    "go.uber.org/goleak"
)

func TestMain(m *testing.M) {
    goleak.VerifyTestMain(m,
        goleak.IgnoreTopFunction("github.com/prometheus/client_golang/prometheus.(*Registry).Gather"),
    )
}
```

One function per package that spawns goroutines. It finds leaks that the race detector cannot see. Ignore entries are for goroutines owned by dependencies; each one deserves a comment naming the dependency.

---

## Snapshots with `autogold`

```go
import "github.com/hexops/autogold/v2"

func Test_RenderHelp_matches_snapshot(t *testing.T) {
    // Given
    root := newRootCmd()
    var out bytes.Buffer
    root.SetOut(&out)

    // When
    _ = root.Help()

    // Then
    autogold.ExpectFile(t, autogold.Raw(out.String()))
}
```

The first run with `go test -update ./...` writes `testdata/<TestName>.golden`. Later runs compare and print a diff. Review the golden file in the pull request the way you review code.

Snapshots fit structure: CLI help text, JSON response shapes, generated SQL, rendered prompt skeletons. Use plain assertions for values and behaviour. Normalise volatile fields (timestamps, IDs) before comparing.

---

## Property-based tests with `rapid`

```go
import "pgregory.net/rapid"

func Test_Email_roundtrips_through_String(t *testing.T) {
    rapid.Check(t, func(rt *rapid.T) {
        // Given
        local := rapid.StringMatching(`[a-z]{3,10}`).Draw(rt, "local")
        host := rapid.StringMatching(`[a-z]{3,10}\.com`).Draw(rt, "host")

        // When
        e, err := domain.NewEmail(local + "@" + host)
        require.NoError(rt, err)
        again, err := domain.NewEmail(e.String())

        // Then
        require.NoError(rt, err)
        require.Equal(rt, e, again)
    })
}
```

`rapid` shrinks failures to a minimal counterexample. Good properties: round trips (parse, print, parse), idempotence (normalising twice equals once), ordering and dedup laws, and "never panics" for parsers. The variable names avoid shadowing the `domain` package.

Native fuzzing complements it for parsers:

```go
func FuzzNewEmail(f *testing.F) {
    f.Add("a@b.com")
    f.Fuzz(func(t *testing.T, s string) {
        if e, err := domain.NewEmail(s); err == nil {
            _, err2 := domain.NewEmail(e.String())
            require.NoError(t, err2)
        }
    })
}
```

Run `go test -fuzz=FuzzNewEmail -fuzztime=30s`; failing inputs land in `testdata/fuzz/` and become regression tests automatically.

---

## HTTP testing

### Handlers, in process

```go
func Test_GetUser_returns_user_for_existing_id(t *testing.T) {
    // Given
    r := gin.New()
    (&Handler{Users: newSvcWithFake(t)}).Mount(r)
    req := httptest.NewRequest(http.MethodGet, "/api/v1/users/u-1", nil)
    rec := httptest.NewRecorder()

    // When
    r.ServeHTTP(rec, req)

    // Then
    require.Equal(t, http.StatusOK, rec.Code)
    var body struct{ ID string `json:"id"` }
    require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
    require.Equal(t, "u-1", body.ID)
}
```

### Clients, against a fake upstream

```go
func Test_Client_retries_on_500(t *testing.T) {
    // Given
    var calls atomic.Int32
    srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
        if calls.Add(1) < 3 {
            w.WriteHeader(http.StatusInternalServerError)
            return
        }
        _, _ = w.Write([]byte(`{"ok":true}`))
    }))
    t.Cleanup(srv.Close)
    client := myclient.New(srv.URL)

    // When
    err := client.DoSomething(t.Context())

    // Then
    require.NoError(t, err)
    require.EqualValues(t, 3, calls.Load())
}
```

`httptest.NewServer` opens a real listener on a random port. The handler encodes the upstream contract, so the test exercises serialization, headers and retry behaviour. An atomic counter keeps the handler race-free, because the server runs on other goroutines.

---

## Determinism

- No `time.Sleep` in tests. Waiting is solved with a signal (channel, `sync.WaitGroup`, `require.Eventually` with a bounded timeout) or an injected clock.
- With `testing/synctest` (Go 1.25) a test runs in a bubble whose clock advances only when every goroutine blocks, so timers and sleeps resolve instantly and deterministically.
- Run CI with `-shuffle=on -count=1 -race`.
- Give tests their own temp directories, ports (`:0`) and database schemas.
- Use `t.Parallel()` for independent tests, which often speeds suites by several times.
- Seed random sources from a logged seed, and print it on failure, so a failing run can be replayed.

A test that fails once in ten runs reveals a defect: an unsynchronised access, an ordering assumption, wall-clock dependence. Reproduce it with `go test -race -count=200 -run '<Name>'` and fix the cause. Quarantining it with `t.Skip` hides the problem.

---

## Benchmarks

```go
func Benchmark_NewEmail(b *testing.B) {
    for b.Loop() { // Go 1.24 or newer
        _, _ = domain.NewEmail("alice@example.com")
    }
}
```

On older toolchains use `for i := 0; i < b.N; i++` (or `for range b.N` in Go 1.22). `b.Loop` keeps setup outside the timed region and stops the compiler from deleting the call.

```bash
go test -run '^$' -bench . -count 10 -benchmem ./... | tee after.txt
benchstat before.txt after.txt
```

Run `-count 10` for stable means and read `benchstat`'s significance column; a single run varies by several percent. Capture `before.txt` from a clean checkout of the base commit (a second worktree is safer than stashing).

---

## Coverage

```bash
go test -race -shuffle=on -coverprofile=cover.out ./...
go tool cover -func=cover.out | tail -1
go tool cover -html=cover.out -o cover.html
```

Aim for 80 percent or more on `internal/domain` and `internal/service`. Handlers and store mappers are covered by integration tests, where line coverage understates what is checked. Coverage is feedback about what the tests never executed; treat it as a map for missing scenarios and avoid making a number the goal. Use `-coverpkg=./...` when integration tests in one package exercise code in another. For a built binary, `go build -cover` plus `GOCOVERDIR` collects coverage from end-to-end runs.

---

## TUI tests with `teatest`

```go
import (
    tea "charm.land/bubbletea/v2"
    "charm.land/bubbletea/v2/teatest"
)

func Test_Counter_increments_on_space(t *testing.T) {
    // Given
    tm := teatest.NewTestModel(t, initial(), teatest.WithInitialTermSize(80, 24))

    // When
    tm.Send(tea.KeyPressMsg{Code: ' ', Text: " "})
    tm.Send(tea.KeyPressMsg{Code: 'q', Text: "q"})

    // Then
    final := tm.FinalModel(t, teatest.WithFinalTimeout(time.Second)).(model)
    require.Equal(t, 1, final.count)
}
```

Snapshot the rendered view with `autogold` for full-view regressions, and assert the exported cursor position separately (see `bubbletea-v2.md`).

---

## Antipatterns

| Pattern | Problem | Replacement |
|---|---|---|
| `if got != want { t.Errorf(...) }` | hand-rolled assertion | `require.Equal` |
| `time.Sleep(100 * time.Millisecond)` after async work | flaky and slow | completion signal or `require.Eventually` |
| `t.Skip` to silence a known failure | buries the defect | fix it, or open an issue and keep the test red |
| one test with twelve assertions | first failure hides eleven | split per `Then` |
| snapshot everything | locks formatting, hides intent | snapshots for structure, asserts for values |
| mock every collaborator | tests mirror the implementation | real or fake collaborators |
| tests calling unexported helpers through same-package files only | couples tests to internals | test the public surface from `_test` packages |
| shared global state between tests | order-dependent failures | per-test setup with `t.Cleanup` |
| `testify/suite` with hidden setup | obscures Given | plain functions and helpers |

## Sources

- testify: https://github.com/stretchr/testify
- goleak: https://github.com/uber-go/goleak
- autogold: https://github.com/hexops/autogold
- rapid: https://pkg.go.dev/pgregory.net/rapid
- testcontainers-go: https://golang.testcontainers.org
- benchstat: https://pkg.go.dev/golang.org/x/perf/cmd/benchstat
- testing/synctest: https://go.dev/blog/synctest
