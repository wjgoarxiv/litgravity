# Database Stack: sqlc, pgx, goose, testcontainers

The PostgreSQL stack for new Go services. SQL is written by hand in `.sql` files and compiled into typed Go by `sqlc`, `pgx` supplies the driver and pool, `goose` owns migrations, and `testcontainers` runs a real PostgreSQL for integration tests. No reflection happens at query time, and a schema change that breaks a query breaks the build.

Existing `gorm` projects can stay as they are; the last section explains the trade-offs for new code.

---

## Toolchain

```bash
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
```

Libraries: `github.com/jackc/pgx/v5` (includes `pgxpool` and `stdlib`), `github.com/google/uuid`, `github.com/testcontainers/testcontainers-go/modules/postgres`.

---

## Layout

```text
internal/store/
├── sqlc.yaml                 # sqlc configuration (or at the repository root)
├── schema.sql                # end-state DDL that sqlc parses
├── queries/                  # one *.sql file per resource
│   ├── users.sql
│   └── orders.sql
├── sqlc/                     # GENERATED: read-only
│   ├── db.go
│   ├── models.go
│   ├── querier.go
│   └── users.sql.go
├── migrations/               # goose files, ordered by timestamp
│   ├── 20260101000001_create_users.sql
│   └── 20260102000001_add_orders.sql
├── pool.go                   # pgxpool constructor
├── user_store.go             # domain-facing wrapper over sqlc
└── user_store_test.go        # integration tests against a container
```

`schema.sql` is the cumulative end state. A common arrangement points sqlc at the `migrations/` directory instead (sqlc understands goose `+goose Up` markers and ignores the `Down` sections), which removes the duplicate file. Pick one source of truth per project.

---

## `sqlc.yaml`

```yaml
version: "2"
sql:
  - engine: "postgresql"
    schema: "schema.sql"
    queries: "queries"
    gen:
      go:
        package: "sqlc"
        out: "sqlc"
        sql_package: "pgx/v5"
        emit_json_tags: false
        emit_prepared_queries: false
        emit_interface: true
        emit_exact_table_names: false
        emit_pointers_for_null_types: true
        emit_empty_slices: true
        overrides:
          - db_type: "uuid"
            go_type:
              import: "github.com/google/uuid"
              type: "UUID"
          - db_type: "timestamptz"
            go_type:
              import: "time"
              type: "Time"
          - db_type: "timestamptz"
            nullable: true
            go_type:
              import: "time"
              type: "Time"
              pointer: true
```

Choices explained:

- `sql_package: "pgx/v5"` generates code against pgx directly rather than `database/sql`.
- `emit_interface: true` writes a `Querier` interface so tests can substitute a fake and stores can accept it.
- `emit_pointers_for_null_types: true` maps nullable columns to `*T`, which maps cleanly onto domain types.
- The `uuid` and `timestamptz` overrides select `uuid.UUID` and `time.Time` in place of the `pgtype` wrappers. Without overrides, pgx/v5 projects get `pgtype.UUID` and `pgtype.Timestamptz`, which are valid but noisier.
- `emit_json_tags: false` keeps wire formats in handler DTOs. Storage rows carry no tags.

Checks to run in CI:

```bash
sqlc generate && git diff --exit-code internal/store/sqlc   # generated code is current
sqlc vet                                                    # lint rules configured in sqlc.yaml
sqlc diff                                                   # same check without writing files
```

---

## `schema.sql`

```sql
-- End-state DDL that sqlc parses. Migrations produce the same shape in the database.

CREATE TABLE users (
    id         UUID        PRIMARY KEY,
    email      TEXT        NOT NULL UNIQUE,
    username   TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_created_at ON users (created_at DESC);
```

---

## `queries/users.sql`

```sql
-- name: GetUser :one
SELECT id, email, username, created_at
FROM users
WHERE id = $1;

-- name: ListUsers :many
SELECT id, email, username, created_at
FROM users
ORDER BY created_at DESC, id DESC
LIMIT $1 OFFSET $2;

-- name: ListUsersAfter :many
SELECT id, email, username, created_at
FROM users
WHERE (created_at, id) < (sqlc.arg(after_created_at)::timestamptz, sqlc.arg(after_id)::uuid)
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(page_size);

-- name: CreateUser :one
INSERT INTO users (id, email, username)
VALUES ($1, $2, $3)
RETURNING id, email, username, created_at;

-- name: UpdateUserEmail :exec
UPDATE users SET email = $2 WHERE id = $1;

-- name: DeleteUser :execrows
DELETE FROM users WHERE id = $1;

-- name: GetUsersByIDs :many
SELECT id, email, username, created_at
FROM users
WHERE id = ANY(sqlc.arg(ids)::uuid[]);
```

Directive reference:

| Directive | Result |
|---|---|
| `:one` | a single row; returns `(T, error)`, with `pgx.ErrNoRows` on a miss |
| `:many` | zero or more rows; returns `([]T, error)` |
| `:exec` | no rows; returns `error` |
| `:execrows` | returns `(int64, error)` with the affected row count |
| `:execresult` | returns the driver's command tag |
| `:batchone`, `:batchmany`, `:batchexec` | pgx batch mode for bulk work |
| `:copyfrom` | PostgreSQL `COPY FROM` for very large inserts |

`sqlc.arg(name)` gives a parameter a readable Go field name, and `sqlc.narg(name)` marks it nullable (useful for optional filters: `WHERE (sqlc.narg(status)::text IS NULL OR status = sqlc.narg(status))`). Keyset pagination (`ListUsersAfter`) scales better than `OFFSET` for deep pages.

Run `task gen:sqlc` (or `sqlc generate`), review the diff, and commit the generated files.

---

## Generated code shape

```go
// Code generated by sqlc. DO NOT EDIT.

type User struct {
    ID        uuid.UUID
    Email     string
    Username  string
    CreatedAt time.Time
}

func (q *Queries) GetUser(ctx context.Context, id uuid.UUID) (User, error) {
    row := q.db.QueryRow(ctx, getUser, id)
    var i User
    err := row.Scan(&i.ID, &i.Email, &i.Username, &i.CreatedAt)
    return i, err
}
```

Inputs, outputs and the column-to-field mapping are checked when you compile. Dropping a column from `schema.sql` breaks every query that selects it at generation time, long before runtime.

---

## `pool.go`

```go
package store

import (
    "context"
    "fmt"
    "time"

    "github.com/jackc/pgx/v5/pgxpool"
)

func NewPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
    cfg, err := pgxpool.ParseConfig(dsn)
    if err != nil {
        return nil, fmt.Errorf("parse dsn: %w", err)
    }
    cfg.MaxConns = 25
    cfg.MinConns = 5
    cfg.MaxConnLifetime = time.Hour
    cfg.MaxConnIdleTime = 30 * time.Minute
    cfg.HealthCheckPeriod = time.Minute

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

Pool sizing: `MaxConns` across all service replicas must stay under the server's `max_connections` minus a margin for admin tools. Put PgBouncer in transaction mode in front of many replicas, and set `cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeCacheDescribe` (or `QueryExecModeSimpleProtocol`) because named prepared statements do not survive transaction pooling. For tracing, attach `github.com/exaring/otelpgx` through `cfg.ConnConfig.Tracer`.

`*pgxpool.Pool` and `pgx.Tx` both satisfy the `DBTX` interface that sqlc generates, so the same `Queries` type works on either.

---

## `user_store.go`: domain on one side, sqlc on the other

```go
package store

import (
    "context"
    "errors"
    "fmt"

    "github.com/google/uuid"
    "github.com/jackc/pgx/v5"
    "github.com/jackc/pgx/v5/pgconn"
    "github.com/jackc/pgx/v5/pgxpool"

    "myservice/internal/domain"
    "myservice/internal/store/sqlc"
)

const pgUniqueViolation = "23505"

type UserStore struct {
    pool *pgxpool.Pool
    q    *sqlc.Queries
}

func NewUserStore(pool *pgxpool.Pool) *UserStore {
    return &UserStore{pool: pool, q: sqlc.New(pool)}
}

func (s *UserStore) Get(ctx context.Context, id domain.UserID) (domain.User, error) {
    row, err := s.q.GetUser(ctx, uuid.UUID(id))
    if errors.Is(err, pgx.ErrNoRows) {
        return domain.User{}, domain.ErrUserNotFound
    }
    if err != nil {
        return domain.User{}, fmt.Errorf("get user %s: %w", id, err)
    }
    return rowToDomain(row)
}

func (s *UserStore) Create(ctx context.Context, u domain.User) (domain.User, error) {
    row, err := s.q.CreateUser(ctx, sqlc.CreateUserParams{
        ID:       uuid.UUID(u.ID),
        Email:    u.Email.String(),
        Username: u.Username.String(),
    })
    var pgErr *pgconn.PgError
    if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
        return domain.User{}, fmt.Errorf("create user: %w", domain.ErrUserExists)
    }
    if err != nil {
        return domain.User{}, fmt.Errorf("create user: %w", err)
    }
    return rowToDomain(row)
}

func rowToDomain(r sqlc.User) (domain.User, error) {
    email, err := domain.NewEmail(r.Email)
    if err != nil {
        return domain.User{}, fmt.Errorf("db invariant: email %q: %w", r.Email, err)
    }
    username, err := domain.NewUsername(r.Username)
    if err != nil {
        return domain.User{}, fmt.Errorf("db invariant: username %q: %w", r.Username, err)
    }
    return domain.User{
        ID:        domain.UserID(r.ID),
        Email:     email,
        Username:  username,
        CreatedAt: r.CreatedAt,
    }, nil
}
```

The store translates storage errors (`pgx.ErrNoRows`, SQLSTATE `23505`) into domain sentinels, so callers never import pgx. The explicit mapper is where stored data meets the smart constructors.

---

## Transactions

`pgx.BeginFunc` handles commit and rollback in one place, and `WithTx` rebinds the generated queries:

```go
func (s *UserStore) CreateWithProfile(ctx context.Context, u domain.User, p domain.Profile) error {
    return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
        q := s.q.WithTx(tx)
        if _, err := q.CreateUser(ctx, createUserParams(u)); err != nil {
            return fmt.Errorf("create user: %w", err)
        }
        if _, err := q.CreateProfile(ctx, createProfileParams(u.ID, p)); err != nil {
            return fmt.Errorf("create profile: %w", err)
        }
        return nil
    })
}
```

The callback returning an error rolls back; returning nil commits; a panic rolls back. When you write the steps by hand instead, use `tx, err := pool.Begin(ctx)` followed by `defer func() { _ = tx.Rollback(ctx) }()` (rollback after commit is a harmless no-op) and finish with `return tx.Commit(ctx)`.

To share a transaction across several stores, let services accept the generated `sqlc.Querier` (or a small interface of the methods they call) and let a unit-of-work function build it from the pool or from a `pgx.Tx`.

Choose the isolation level on purpose: `pgx.BeginTx(ctx, pool, pgx.TxOptions{IsoLevel: pgx.Serializable})` for invariants that span rows. Serializable transactions can fail with SQLSTATE `40001`, so wrap them in a retry loop with a bound.

---

## Migrations with goose

```bash
goose -dir internal/store/migrations create create_users sql
```

```sql
-- +goose Up
CREATE TABLE users (
    id         UUID        PRIMARY KEY,
    email      TEXT        NOT NULL UNIQUE,
    username   TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE users;
```

Commands:

```bash
goose -dir internal/store/migrations postgres "$DATABASE_URL" up
goose -dir internal/store/migrations postgres "$DATABASE_URL" status
goose -dir internal/store/migrations postgres "$DATABASE_URL" down
```

Migration rules:

- One DDL change per file, with data backfills in a separate migration.
- Write a real `Down`. CI runs `up`, `down`, `up` against a fresh container to prove reversibility.
- A merged migration is immutable; corrections arrive as new files.
- Large index builds on live tables use `CREATE INDEX CONCURRENTLY` and `-- +goose NO TRANSACTION` at the top of the file.
- Add columns as nullable or with a default first, backfill, then tighten constraints, so old and new application versions can run together during a rollout.

Programmatic use, with the migrations embedded in the binary:

```go
//go:embed migrations/*.sql
var migrationsFS embed.FS

func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
    goose.SetBaseFS(migrationsFS)
    if err := goose.SetDialect("postgres"); err != nil {
        return fmt.Errorf("goose dialect: %w", err)
    }
    db := stdlib.OpenDBFromPool(pool) // github.com/jackc/pgx/v5/stdlib
    defer db.Close()
    if err := goose.UpContext(ctx, db, "migrations"); err != nil {
        return fmt.Errorf("migrate up: %w", err)
    }
    return nil
}
```

Running migrations from the service on boot suits small deployments. With several replicas, run them in a separate release step to avoid concurrent migrators (goose takes a lock, but a dedicated job is easier to reason about).

---

## Integration tests with testcontainers

```go
package store_test

import (
    "context"
    "testing"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/stretchr/testify/require"
    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/modules/postgres"

    "myservice/internal/store"
)

func newTestPool(t *testing.T) *pgxpool.Pool {
    t.Helper()
    ctx := context.Background()

    ctr, err := postgres.Run(ctx, "postgres:16-alpine",
        postgres.WithDatabase("test"),
        postgres.WithUsername("test"),
        postgres.WithPassword("test"),
        postgres.BasicWaitStrategies(),
    )
    testcontainers.CleanupContainer(t, ctr)
    require.NoError(t, err)

    dsn, err := ctr.ConnectionString(ctx, "sslmode=disable")
    require.NoError(t, err)

    pool, err := store.NewPool(ctx, dsn)
    require.NoError(t, err)
    t.Cleanup(pool.Close)

    require.NoError(t, store.Migrate(ctx, pool))
    return pool
}

func TestUserStore_Create_then_Get_roundtrips(t *testing.T) {
    // Given
    s := store.NewUserStore(newTestPool(t))
    ctx := context.Background()
    in := newUser(t, "a@b.com", "alice")

    // When
    created, err := s.Create(ctx, in)
    require.NoError(t, err)
    fetched, err := s.Get(ctx, created.ID)

    // Then
    require.NoError(t, err)
    require.Equal(t, created.Email, fetched.Email)
}
```

Container startup costs about two seconds, so share one container per package through `TestMain` and give each test its own isolation:

- Run each test inside a transaction that rolls back at the end. Fast, and it works when the code under test accepts a `Querier`.
- Or snapshot after migrations and restore between tests: `ctr.Snapshot(ctx)` once, then `ctr.Restore(ctx)` in each test's setup (the module's snapshot feature uses a template database).
- Or create a database per test from a migrated template with `CREATE DATABASE ... TEMPLATE`.

```go
var testDSN string

func TestMain(m *testing.M) {
    ctx := context.Background()
    ctr, err := postgres.Run(ctx, "postgres:16-alpine", postgres.BasicWaitStrategies())
    if err != nil {
        log.Fatalf("start postgres: %v", err)
    }
    testDSN, _ = ctr.ConnectionString(ctx, "sslmode=disable")
    code := m.Run()
    _ = testcontainers.TerminateContainer(ctr)
    os.Exit(code)
}
```

(`log.Fatalf` is acceptable here because `TestMain` is the process entry for tests.) In CI, make sure the runner exposes a Docker socket. In headless agent sessions, check `docker info` first; if the daemon is unavailable, skip the integration package with a clear message and state in the report that it was not run.

---

## Why sqlc and pgx beat gorm for new code

| Concern | gorm | sqlc with pgx |
|---|---|---|
| Type safety | reflection at run time; tags map columns | the compiler checks SQL-derived types |
| Performance | extra allocation and reflection per query | pgx is among the fastest Go PostgreSQL drivers |
| N+1 queries | `Preload` makes them easy to write | joins are explicit in the `.sql` file |
| Migrations | `AutoMigrate` is risky in production | goose files, reviewed and reversible |
| Debugging | log statements to see the SQL | the query is the source file |
| Context support | uneven across APIs | first-class `ctx` parameters |
| PostgreSQL features | the common subset | arrays, `COPY`, `LISTEN`, JSONB, composite types |

Leave existing gorm code alone unless the task is the migration itself. Mixed stacks inside one package are harder to maintain than either alone.

## Pitfalls

- Editing files under `sqlc/` by hand. Change the query and regenerate.
- Using `SELECT *`; list columns so schema additions do not silently change row shapes.
- Forgetting `ORDER BY` on paginated queries. Pagination without a total order repeats and skips rows.
- Reading `rows.Err()` is handled by generated code for `:many`; hand-written pgx loops need `rows.Err()` after iteration.
- Passing the pool to code that holds a transaction. Use the `Tx`-bound `Queries` consistently inside a unit of work.
- Storing timestamps without a zone. Use `timestamptz`.

## Sources

- sqlc documentation: https://docs.sqlc.dev
- pgx: https://github.com/jackc/pgx
- goose: https://github.com/pressly/goose
- testcontainers-go PostgreSQL module: https://golang.testcontainers.org/modules/postgres/
- pgxpool configuration: https://pkg.go.dev/github.com/jackc/pgx/v5/pgxpool#Config
