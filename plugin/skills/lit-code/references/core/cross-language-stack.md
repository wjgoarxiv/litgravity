# Cross-language stack: iron list, canonical libraries, toolchain, diagnostics

This file holds the full four-language tables that `SKILL.md` compresses. Where a project's manifest already chooses something else, the project wins; note the deviation once. Where it chooses nothing, these are the defaults. The per-language `libraries.md` files (`references/python/libraries.md`, `references/rust/libraries.md`, `references/go/libraries.md`) carry production settings for each library.

## Iron list

Apply unless the language reference is stricter.

| Rule | Python | Rust | TypeScript | Go |
|---|---|---|---|---|
| Immutable by default | `@dataclass(frozen=True, slots=True)` or Pydantic `frozen=True` | `let` bindings; `let mut` only where mutation is the documented purpose | every field `readonly`, arrays `readonly T[]` | value types, unexported fields, mutation methods only where mutation is the purpose |
| Branded primitives | `UserId = NewType("UserId", int)` | `struct UserId(u64);` | `type UserId = Brand<string, "UserId">` | `type UserID string` plus a smart constructor |
| Exhaustive variants | `match` + `assert_never` | `match` (compiler-enforced) | `switch` + `assertNever` | sealed interface + type switch + `exhaustive` linter |
| Escape hatches to remove | `Any` in public signatures, `cast`, `# type: ignore` | `unwrap`/`expect` outside `main` and tests, narrowing `as`, `#[allow]` hiding a real warning | `any`, `as` other than `as const` and `satisfies`, postfix `!`, `@ts-ignore`, `@ts-expect-error` | `interface{}` or bare `any` in domain signatures, `_ = err`, `//nolint` without a reason |
| Typed errors | exception dataclass with `__str__` | `thiserror` enum (library), `anyhow` with `.context(...)` (application) | `Error` subclass with typed fields | sentinel `errors.New` plus typed `*XError`, wrapped with `%w`, checked with `errors.Is/As` |
| Catch at the boundary | catch the exact expected exception; broad `except Exception` only in `main()`, logged and re-raised | `?` throughout; `panic!` stays out of library code | `catch` narrows with `instanceof`, then re-throws or converts; empty catch blocks are defects | every `(T, error)` checked; `panic` only in `main` and tests; one HTTP error funnel per service |
| Scoped resources | `with` / `async with` | `Drop` or an RAII guard | `using` / `await using` | `defer x.Close()` right after acquisition; `bodyclose` and `sqlclosecheck` enforce it |
| Structured async | `anyio` task groups (bare `asyncio` is replaced) | `tokio` (`async-std` is unmaintained) | Bun or Node async with `AbortSignal` cancellation | `context.Context` first parameter plus `errgroup`; `-race` on every test run |
| HTTP client | `httpx2` with HTTP/2, brotli, zstd | `reqwest` with rustls | `ky` by default, `undici` direct for Node throughput; bare `fetch` stays out of production paths | stdlib `net/http.Client` with a tuned `Transport` plus `go-retryablehttp` |
| Parameters are inputs | produce a new value | `&mut` only when mutation is the purpose | parameters keep their binding (`noParameterAssign`) | value receivers unless mutating; `copylocks` vet enforces lock copies |
| One-off operations inline | inline a three-line operation; abstract at the second caller | same | same | same |

## Canonical libraries by domain (2026)

| Domain | Python | Rust | TypeScript | Go |
|---|---|---|---|---|
| Boundary parsing | Pydantic v2 | `serde` derive plus `validator` | Zod v4 (Standard Schema) | `validator/v10` (HTTP), `protovalidate` (proto), smart constructors (domain) |
| Internal value object | frozen slotted dataclass | newtype or plain struct | `readonly` type alias | struct with unexported fields plus `NewX(...)` |
| Errors | typed exception dataclass | `thiserror` / `anyhow` | `Error` subclass plus a Result type | sentinel plus `*XError` plus `%w` |
| HTTP client | `httpx2` | `reqwest` | `ky` / `undici` | `net/http` plus `go-retryablehttp` |
| Web framework | FastAPI | axum | Hono plus `hono-openapi` | gin (common default), chi (minimal), `connect-go` (RPC) |
| Database | SQLAlchemy 2.x async plus `asyncpg` | `sqlx` (compile-time checked) | Drizzle | `sqlc` codegen plus `pgx/v5` plus `goose` migrations |
| CLI | `typer` plus `rich` | `clap` derive plus `color-eyre` plus `indicatif` | `@clack/prompts` plus `commander` | `cobra` plus `huh` plus `slog` |
| Logging | `structlog` in production, `rich.logging` in development | `tracing` plus `tracing-subscriber` | `pino` | stdlib `log/slog` for new code |
| Testing | `pytest` | `cargo nextest` plus `proptest` plus `insta` | `bun test` / vitest | `testing` plus `testify/require`, `goleak`, `autogold`, `rapid`, `testcontainers` |
| Data and analytics | polars plus duckdb plus numpy (pandas is replaced) | `polars` or `arrow` | a backend service | `arrow-go` plus DuckDB bindings plus `gonum` |
| LLM agents | `pydantic-ai` | a Python subprocess | Vercel AI SDK | direct `net/http` plus Connect |
| TUI | `textual` | `ratatui` | `@clack/prompts` or ink | bubbletea v2 with `bubbles/v2` and `lipgloss/v2` (v2 is required for CJK input methods) |
| Config from env | `pydantic-settings` | `figment` or `config` | Zod over `process.env` | `caarlos0/env/v11` |

A canonical library built with bare defaults (no timeouts, no pool limits, no schema) is a bug. Each language's `libraries.md` gives the production constructor.

## Toolchain detail

| Category | Python | Rust | TypeScript | Go |
|---|---|---|---|---|
| Project manager | uv (pip, poetry and conda are replaced) | cargo plus `cargo-nextest`, `cargo-machete`, `cargo-deny` | Bun as runtime and package manager; pnpm when Node is required | go modules; `go work` for monorepos |
| Type checker | basedpyright, `typeCheckingMode = "all"` | rustc `-D warnings` plus clippy `pedantic`, `nursery`, `cargo` groups | `tsc --noEmit` or `tsgo` with the full strict flag set | compiler plus golangci-lint v2 strict bundle plus nilaway |
| Lint and format | ruff `select = ["ALL"]` | clippy plus rustfmt | Biome (one binary for lint and format) | gofumpt plus `goimports -local` plus golangci-lint v2 |
| Test runner | pytest | cargo-nextest | `bun test` / vitest | `go test -race -shuffle=on -count=1` plus goleak |
| Soundness gate | n/a | nightly miri with strict provenance and a Tree Borrows pass | n/a | nilaway, the race detector and goleak |
| One-off script | PEP 723 inline metadata plus `uv run` | `rust-script` with an inline manifest | `bun run script.ts` | `//go:build ignore` plus `go run` |

Strictness is a set of flags. `"strict": true` alone leaves `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax` off; `references/typescript/tsconfig-strict.md`, `references/python/pyproject-strict.md`, `references/rust/cargo-strict.md` and `references/go/golangci-strict.md` give the complete configurations.

## Missing tools

1. Check with `command -v <tool>` through `run_command` before the first gate run.
2. When a tool is absent, name it in the reply, run the closest installed equivalent (`pyright` for basedpyright, `npx tsc` for `bunx tsc`, `go vet` for golangci-lint) and state what remained unverified.
3. Installing is the user's decision: ask with `ask_question`, recommended default "do not install". In a headless run take that default, log a `decision` ledger line and give the user the install command.
4. Global installs (`npm i -g`, `pip install --user`, `cargo install` into the user's toolchain) need explicit approval each time.

## Diagnostics through the shell

agy offers no language-server tool to the model directly. When a workflow wants diagnostics, run the CLI through `run_command` and read its output.

| Language | Typecheck / diagnostics | Lint | Notes |
|---|---|---|---|
| TypeScript | `tsc --noEmit -p <tsconfig> --pretty false` | `biome check <paths>` | `--pretty false` gives one finding per line |
| Python | `basedpyright --outputjson <paths>` or `pyright --outputjson <paths>` | `ruff check <paths>` | `ruff format --check` for formatting |
| Go | `go vet ./...` or `gopls check <files>` | `golangci-lint run ./...` | `go build ./...` for compile errors |
| Rust | `cargo check --message-format=json` | `cargo clippy -- -D warnings` | `cargo fmt --check` for formatting |

For definitions, references and rename safety, read the `lsp` skill (`../lsp/SKILL.md` from the skill folder); for syntax-shaped search, `structural-search`. When neither a CLI nor those skills can answer a semantic question, say so plainly and keep text matches labelled as text matches.
