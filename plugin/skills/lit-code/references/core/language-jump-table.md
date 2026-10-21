# Language jump table, scaffolds and checkers

Phase 0 in `SKILL.md` makes each language's `README.md` mandatory reading. This file maps every narrower need to its exact reference file, then documents each shipped script: what it does, how to run it, what it writes, and what to do when its runner is missing. Paths are relative to the skill folder. Read a file with `read_file` (older builds: `view_file`); another skill's file sits at `../<id>/SKILL.md`.

## Python (`.py`, `.pyi`)

Read `references/python/README.md` first. Then, by need:

| Need | File |
|---|---|
| Strict `pyproject.toml`, basedpyright and ruff configuration | `references/python/pyproject-strict.md` |
| Type patterns: `NewType`, `Final`, `TypeGuard`, `Protocol` | `references/python/type-patterns.md` |
| Data modeling: Pydantic, dataclass, TypedDict, StrEnum, and when each fits | `references/python/data-modeling.md` |
| Errors: typed exceptions, exhaustive match, union returns | `references/python/error-handling.md` |
| Async with anyio: task groups, cancel scopes, memory channels | `references/python/async-anyio.md` |
| `httpx2` production defaults: HTTP/2, brotli and zstd, pool limits | `references/python/httpx2-optimization.md` |
| orjson on hot paths: FastAPI responses, Pydantic v2 `model_dump_json` trade-offs, Redis, queues, logs | `references/python/orjson-stack.md` |
| Data processing with polars and duckdb | `references/python/data-processing.md` |
| FastAPI with SQLAlchemy 2.x async | `references/python/fastapi-stack.md` |
| pydantic-ai agents | `references/python/pydantic-ai.md` |
| Textual TUI | `references/python/textual-tui.md` |
| Disposable PEP 723 scripts | `references/python/one-liners.md` |
| Canonical library defaults | `references/python/libraries.md` |

## Rust (`.rs`, `Cargo.toml`)

Read `references/rust/README.md` first. It sets out the five pillars (explicit allocation, compile-time proof, zero hidden cost, type-encoded invariants, deterministic cleanup) and the Rust post-write checklist. Then, by need:

| Need | File |
|---|---|
| Arena allocation, `const fn`, zero-allocation APIs, bitfields, scope guards, error-path cleanup | `references/rust/zero-cost-safety.md` |
| Strict `Cargo.toml` lints, profiles, workspace configuration | `references/rust/cargo-strict.md` |
| Type-state and newtype patterns | `references/rust/type-state.md` |
| `unsafe` discipline: safe wrapper, `SAFETY` comment, Miri proof | `references/rust/unsafe-discipline.md` |
| Async with tokio: `JoinSet`, cancellation, `select!`, blocking work | `references/rust/async-tokio.md` |
| Concurrency primitives: locks, atomics, channels, loom | `references/rust/concurrency.md` |
| axum, sqlx, tracing and tower HTTP stack | `references/rust/axum-stack.md` |
| clap, color-eyre, tracing and indicatif CLI stack | `references/rust/clap-stack.md` |
| Property tests (proptest) and snapshot tests (insta) | `references/rust/proptest-insta.md` |
| Disposable `rust-script` scripts | `references/rust/one-liners.md` |
| Canonical library defaults | `references/rust/libraries.md` |
| Any `unsafe`, FFI, `MaybeUninit` or lock-free work | `references/rust-ub/README.md`, `references/rust-ub/ub-taxonomy.md`, `references/rust-ub/miri-sanitizers-loom.md` (all three) |

## TypeScript (`.ts`, `.tsx`, `.mts`, `.cts`)

Read `references/typescript/README.md` first. Then, by need:

| Need | File |
|---|---|
| Strict tsconfig and Biome configuration | `references/typescript/tsconfig-strict.md` |
| Type patterns: branded types, `as const`, `satisfies`, narrowing, `assertNever` | `references/typescript/type-patterns.md` |
| Data modeling: type, interface or Zod schema; readonly; parsing at the edge | `references/typescript/data-modeling.md` |
| Errors: Result types, typed errors, union versus throw, `AbortSignal` timeouts | `references/typescript/error-handling.md` |
| Bootstrapping a project with Bun, pnpm, Hono or Vite | `references/typescript/bootstrap.md` |
| Hono backend: `hono-openapi`, Scalar, Swagger UI, Zod v4 | `references/typescript/backend-hono.md` |

## Go (`.go`, `go.mod`, `go.sum`, `.golangci.yml`, `*.proto`)

Read `references/go/README.md` first. Then, by need:

| Need | File |
|---|---|
| Library defaults and the reasoning behind the 2026 stack (gin or chi, sqlc, slog) | `references/go/libraries.md` |
| Strict `.golangci.yml` v2 with the reason for each linter | `references/go/golangci-strict.md` |
| Project layout, Taskfile, CI, `go.mod` template | `references/go/bootstrap.md` |
| Type patterns: named types, smart constructors, sealed interfaces, generics | `references/go/type-patterns.md` |
| Data modeling and the three validation layers (validator/v10, smart constructor, sqlc) | `references/go/data-modeling.md` |
| Errors: `errors.Is/As`, typed errors, `%w` wrapping, panic policy | `references/go/error-handling.md` |
| Concurrency: `context.Context`, `errgroup`, channels, locks, `-race`, `goleak` | `references/go/concurrency.md` |
| HTTP backend: gin, slog, validator, pgx, middleware order, SSE, WebSocket | `references/go/backend-stack.md` |
| RPC: Connect-Go by default, grpc-go as fallback, protovalidate, Buf | `references/go/grpc-connect.md` |
| CLI: cobra, slog, huh | `references/go/cobra-stack.md` |
| Database: sqlc, pgx, goose, testcontainers | `references/go/sqlc-pgx.md` |
| TUI: bubbletea v2, bubbles v2, lipgloss v2, CJK and input-method support | `references/go/bubbletea-v2.md` |
| Testing: Given / When / Then, table-driven tests, fakes, autogold, rapid | `references/go/testing.md` |
| Disposable `go run` scripts | `references/go/one-liners.md` |

## Scripts

| Script | Runner | Purpose |
|---|---|---|
| `scripts/python/check-no-excuse-rules.py` | `uv run --script` or `python3 -I` | Python escape hatches: `cast(Any, …)`, ignore comments, bare and silent `except`, `asyncio` and `pandas` imports, mutable or unslotted dataclasses, raw `dict` returns, `match` without `assert_never`, generic exceptions with bare strings, `object` annotations, `if`/`elif` over variants, broad excepts, files past 250 pure LOC |
| `scripts/python/new-project.py` | `uv run --script` | Strict uv project: `uv init`, then basedpyright, ruff `ALL` and pytest configuration; `--lib` for a publishable library |
| `scripts/python/new-script.py` | `uv run --script` | PEP 723 script with shebang, inline metadata, a "How to run" block and a `main()` guard; `--deps`, `--py`, `--output` |
| `scripts/rust/check-no-excuse-rules.sh` | `bash` | Rust: stray `unwrap` and `expect`, placeholder macros, `Box<dyn Error>`, library `panic!`, `unsafe` without `SAFETY`, unjustified clippy allows, narrowing `as` casts |
| `scripts/rust/check-no-excuse-rules.py` | `uv run --script` or `python3 -I` | The same Rust rules in Python, walking directories |
| `scripts/rust/new-project.py` | `uv run --script` | Cargo project with strict lints, `deny.toml`, `rustfmt.toml`, `rust-toolchain.toml` and `.cargo/config.toml` |
| `scripts/typescript/check-no-excuse-rules.ts` | `bun run` | TypeScript AST scan: `as any`, `as unknown`, `@ts-ignore`, `@ts-expect-error`, `enum`, postfix `!`, thrown literals, `export let`, `any` annotations and returns, empty or unnarrowed `catch` |
| `scripts/typescript/new-project.ts` | `bun run` | Bun project with Hono, Zod, Biome and the strict tsconfig |
| `scripts/go/check-no-excuse-rules.sh` | `bash` | Go: `_ = err`, `panic` and `log.Fatal` outside `main`, `init()`, `time.Sleep` in production code, `context.Background()` in libraries, `interface{}`, `fmt.Print*` in libraries, reasonless `//nolint`, TODOs without an owner |
| `scripts/go/new-project.py` | `uv run --script` | Go module with the strict layout, filled from `scripts/go/templates/` |

### Running the checkers

```bash
uv run --script "<skill-folder>/scripts/python/check-no-excuse-rules.py" <files-or-dirs>
python3 -I "<skill-folder>/scripts/python/check-no-excuse-rules.py" <files-or-dirs>     # no uv: stdlib only
bash "<skill-folder>/scripts/rust/check-no-excuse-rules.sh" <file.rs>...
python3 -I "<skill-folder>/scripts/rust/check-no-excuse-rules.py" <files-or-dirs>
bun run "<skill-folder>/scripts/typescript/check-no-excuse-rules.ts" <files-or-dirs>
bash "<skill-folder>/scripts/go/check-no-excuse-rules.sh" <file.go>...
```

- Exit codes: 0 clean, 1 findings, 2 usage or missing path.
- The two shell checkers take files. Expand a directory first: `find <dir> -name '*.go' -not -path '*/vendor/*'`, then pass the list.
- The TypeScript checker imports the `typescript` package. Bun resolves it on first use when the project has no `node_modules`; inside a project with its own `typescript`, that copy is used. If resolution fails (offline sandbox), report `BLOCKED:` with the error line for that checker and rely on `tsc --noEmit` plus Biome for the same ground.
- Opt-out markers the checkers honour: Python `# noqa: <RULE>_OK` per line (for example `ANYIO_OK`, `PANDAS_OK`, `SIZE_OK`); Rust `// SAFE-UNWRAP:`, `// SAFE-EXPECT:`, `// SAFETY:`, `// CLIPPY-ALLOW:` on the line above; TypeScript `// no-excuse-ok: any` and `// no-excuse-ok: catch`; Go `//nolint:<linter> // <reason>`. Each marker carries a reason, and a marker added during your change gets a ledger `note`.
- Findings are defects to fix. Filtering output to make a run look clean defeats the gate.

### Running the scaffolds

```bash
uv run --script "<skill-folder>/scripts/python/new-project.py" <name> --path <parent-dir>
uv run --script "<skill-folder>/scripts/python/new-script.py" <name> --output <path/to/name.py>
uv run --script "<skill-folder>/scripts/rust/new-project.py" <name> --path <parent-dir>
bun run "<skill-folder>/scripts/typescript/new-project.ts" <name> --path <parent-dir>
uv run --script "<skill-folder>/scripts/go/new-project.py" <name> --path <parent-dir> --module <module-path> --purpose <short-purpose>
```

- Run each with `--help` first. Point the target at a new directory. The Python, TypeScript and Go scaffolds refuse a target that already exists. The Rust scaffold runs `cargo init` on `<parent-dir>/<name>`, which accepts an existing directory without a `Cargo.toml`, so check the target is empty before running it. `--path` defaults to the current directory, so set the `run_command` working directory deliberately.
- The `.py` scaffolds declare `typer` and `rich` as PEP 723 dependencies, which `uv run` fetches on first use. `python3` alone cannot run them. When the fetch fails in a sandbox, report `BLOCKED:` with the error line; global installs stay off the table.
- The Python scaffold calls `uv init` and then `uv add --dev basedpyright ruff pytest pytest-cov` (network); the Rust scaffold calls `cargo init`; the Go scaffold calls `go mod init` and writes a fallback `go.mod` if `go` is missing. Each tool must be on `PATH`.
- `new-script.py` writes to a temp directory when `--output` is omitted and prints the path.
- After a scaffold, run the language gate inside the new project and the matching checker on its sources before adding code; a scaffold is expected to start clean.

## Go templates

`scripts/go/new-project.py` substitutes `$name`, `$module` and `$short_purpose` into the `.tmpl` files and copies the rest verbatim:

| Template | Becomes |
|---|---|
| `scripts/go/templates/main.go.tmpl` | `cmd/server/main.go`: signal-aware context, calls `cmd.Execute` |
| `scripts/go/templates/run.go` | `internal/cmd/run.go`: root command stub with `slog` |
| `scripts/go/templates/config.go` | `internal/config/config.go`: typed env config through `caarlos0/env/v11` |
| `scripts/go/templates/.golangci.yml` | strict golangci-lint v2 configuration |
| `scripts/go/templates/Taskfile.yml` | `fmt`, `lint`, `test`, `build`, `run` and `ci` tasks |
| `scripts/go/templates/ci.yml` | `.github/workflows/ci.yml` |
| `scripts/go/templates/AGENTS.md.tmpl` | the new project's `AGENTS.md` with layout and conventions |
| `scripts/go/templates/README.md.tmpl` | the new project's `README.md` |
| `scripts/go/templates/gitignore` | `.gitignore` |
| `scripts/go/templates/.editorconfig` | `.editorconfig` |

Edit a template when the house layout changes, then scaffold into a scratch directory and run `go build ./...` there to prove it still compiles.
