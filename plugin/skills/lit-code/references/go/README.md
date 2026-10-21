# Go Programmer (lit-code, Go reference index)

Production Go in 2026. The house style is plain code, strict tooling, and a type layout in which invalid states have no constructor. Start here, then open only the reference file that matches the task at hand.

## Why the toolchain carries so much weight

Go ships a small type system, so a few guarantees that other languages get from the compiler have to come from conventions and linters:

- Sum types are missing. An interface plus a type switch is the closest substitute, and completeness is checked by the `exhaustive` linter.
- Optional values are expressed with pointers or zero values. A nil interface and an interface that holds a nil pointer behave differently, which is a classic source of surprise.
- Failure is a second return value (`(T, error)`). The compiler lets a caller drop it silently unless `errcheck` is on.
- A defined type such as `type UserID string` blocks accidental assignment between two defined types, yet an untyped string literal converts to it freely.

The answer is to let tools play the part of the missing compiler checks. Run `golangci-lint` v2 with the configuration in `golangci-strict.md` the way a TypeScript project runs `tsc --strict`. Add `nilaway` for nil-flow analysis and `go test -race` for data races. When all of them are green, the code has earned the label "done".

## Five working rules

1. **Parse at the boundary.** Input from HTTP, RPC, CLI flags, environment variables and files is converted into domain types through `New*(...)` constructors with unexported fields. Inside the domain the values are trusted. See `data-modeling.md`.
2. **Return `(T, error)`.** Library code returns errors and leaves `panic` for programmer bugs found at start-up. Wrap with `%w`, branch with `errors.Is` and `errors.As`, and give callers a typed error when they need to branch. See `error-handling.md`.
3. **Sealed interfaces for variants.** An interface with an unexported method closes the set of implementations; a type switch plus `exhaustive` proves every case is handled. See `type-patterns.md`.
4. **`context.Context` goes first.** Every function that does I/O or blocks accepts a `ctx` as its first parameter, every goroutine has a shutdown path tied to a context, and time comes from an injected clock in domain code. See `concurrency.md`.
5. **Generate external contracts.** `sqlc` produces the database layer, `oapi-codegen` produces OpenAPI servers and clients, `buf` with `protoc-gen-go` and `protoc-gen-connect-go` produces RPC stubs. Hand-written marshalling for those contracts drifts from the spec. See `sqlc-pgx.md` and `grpc-connect.md`.

## Tooling table

| Concern | Choose | Avoid |
|---|---|---|
| Go version | 1.23 or newer (range-over-func, `iter`, stable `log/slog`); 1.24 adds the `tool` directive in `go.mod` | releases older than 1.22 |
| Modules | `go.mod`, plus `go.work` for a multi-module repository | GOPATH layouts, `dep` |
| Formatting | `gofumpt` and `goimports -local <module>` | bare `gofmt` |
| Lint | `golangci-lint` v2 with the bundle in `golangci-strict.md` | a lone `go vet` |
| Nil analysis | `nilaway` in CI | hoping |
| Extra vet passes | `fieldalignment`, `shadow` | skipping them |
| Tests | `go test -race -shuffle=on -count=1 ./...` | cached or race-free runs |
| Goroutine leaks | `go.uber.org/goleak` in `TestMain` | eyeballing |
| Mocks | `go.uber.org/mock` (`mockgen`) | hand-maintained stubs for wide interfaces |
| Database | `sqlc` with `jackc/pgx/v5` | `database/sql` with an ORM |
| HTTP | `gin-gonic/gin` by default, `go-chi/chi` for a minimal router, `connectrpc.com/connect` for RPC | `gorilla/mux` for new work, `fiber` (not net/http based) |
| RPC | `connectrpc.com/connect` | raw `grpc-go` unless a Connect gap forces it |
| Validation | `go-playground/validator/v10` at HTTP edges, `protovalidate-go` for proto, smart constructors in the domain | scattered `if len(s) == 0` chains |
| Config | `caarlos0/env/v11` | `viper` unless file, env and flag layers all matter |
| Logging | `log/slog` | logrus, zap or zerolog for new code |
| CLI | `spf13/cobra` | hand-rolled `os.Args` parsing past two flags |
| TUI | `charm.land/bubbletea/v2` family (see `bubbletea-v2.md` for CJK input) | bubbletea v1 when IME input matters |

One command acts as the completion gate for any change:

```bash
gofumpt -l . | (! grep .) && \
  golangci-lint run ./... && \
  nilaway -include-pkgs "$(go list -m)" ./... && \
  go test -race -shuffle=on -count=1 ./...
```

A failure in any stage means the change is unfinished. `scripts/go/check-no-excuse-rules.sh` adds the rules that linters cannot see (suppression comments, file length, banned imports); run it after each edit session.

## Which file to open

| Task | Open |
|---|---|
| New project, layout, Taskfile, CI | `bootstrap.md` |
| Named types, smart constructors, struct tags | `data-modeling.md`, `type-patterns.md` |
| Error design, HTTP error mapping | `error-handling.md` |
| Goroutines, channels, `errgroup`, shutdown | `concurrency.md` |
| gin service, middleware, SSE, WebSocket | `backend-stack.md` |
| Protobuf, Connect, interceptors, streaming | `grpc-connect.md` |
| PostgreSQL, sqlc, pgx pool, goose, testcontainers | `sqlc-pgx.md` |
| Command-line tools | `cobra-stack.md` |
| Terminal UIs | `bubbletea-v2.md` |
| Unit, table, golden, property, integration tests | `testing.md` |
| Linter configuration and the suppression policy | `golangci-strict.md` |
| Which library for which job | `libraries.md` |
| Throwaway scripts with `go run` | `one-liners.md` |

## The 250 line ceiling

A `.go` file whose pure lines (no blanks, no comments) pass 250 has outgrown its purpose. Go favours many small files inside one package, so splitting costs little: give each file one cohesive type with its methods. The usual offender is `cmd/server/main.go`; reduce it to wiring (`signal.NotifyContext`, load config, call `cmd.Execute`) and move everything else into `internal/`.

## Existing codebases

When a file already breaks these rules, write the new lines in the strict style and leave the surrounding code alone for that change. A branch-wide cleanup belongs to the `lit-burnoff` skill, which locks behavior with tests first.

## When this reference applies

Load it whenever you create or edit a `.go` file, `go.mod`, `go.sum`, `.golangci.yml`, `Taskfile.yml`, or a generator input such as `*.proto`, the `.sql` files beside `sqlc.yaml`, or `openapi.yaml` beside `oapi-codegen.yaml`. One-off scripts get the same discipline; the `//go:build ignore` plus `go run` pattern in `one-liners.md` gives them throwaway ergonomics with production hygiene.

Read the matching reference before writing. Re-read it when a session drifts, and finish with the architecture review pass from the main skill.

## Verification checklist

1. `gofumpt -l .` prints nothing.
2. `golangci-lint run ./...` exits 0 with the strict bundle and no new `//nolint` lines (each one needs a linter name and a reason).
3. `nilaway` reports nothing for the module's packages.
4. `go test -race -shuffle=on -count=1 ./...` passes; goleak is wired into `TestMain` for packages that start goroutines.
5. `go build ./...` and `go vet ./...` succeed on a clean checkout (run `git status` first so untracked generated files do not hide a missing `go generate` step).
6. Every file stays under 250 pure lines, and `cmd/*/main.go` stays under 50.
7. In headless runs, read the tool versions with `go version` and `golangci-lint version` before choosing config syntax; a refused `run_command` ends the run, so ask for the permission up front.

## Sources

- Go release notes: https://go.dev/doc/devel/release
- golangci-lint v2 documentation: https://golangci-lint.run/
- nilaway: https://github.com/uber-go/nilaway
- Effective Go and Go Code Review Comments: https://go.dev/doc/effective_go
