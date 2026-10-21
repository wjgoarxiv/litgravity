# One-Liners and Disposable Scripts

A throwaway script deserves production hygiene with throwaway ergonomics. Go scripts keep the same lint rules, the same typed boundaries and the same 250 line ceiling; the difference is packaging. They live as single `.go` files started with `go run`, or as small `main` packages under `scripts/`, and need no installation step.

Python has PEP 723 with `uv run`, and Rust has `rust-script`. Go needs only the `go` command.

---

## Pattern 1: a single file with `go run`

```go
//go:build ignore

// fetch.go fetches a URL and prints the body size.
//
// Usage:
//
//	go run fetch.go <url>
package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"
)

func main() {
	if len(os.Args) != 2 {
		log.Fatal("usage: go run fetch.go <url>")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	n, err := fetch(ctx, os.Args[1])
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("%d bytes\n", n)
}

func fetch(ctx context.Context, url string) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, fmt.Errorf("build request: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("get %s: %w", url, err)
	}
	defer resp.Body.Close()

	n, err := io.Copy(io.Discard, resp.Body)
	if err != nil {
		return 0, fmt.Errorf("read body: %w", err)
	}
	return n, nil
}
```

Run it with `go run fetch.go https://example.com`.

`//go:build ignore` keeps the file out of `go build ./...` and `go vet ./...`, since it is a script and not part of the module. Without the constraint, a second `main` function in the same directory breaks the package build. The blank line after the constraint is required, or the compiler reads it as a doc comment.

`go run` accepts file names ending in `.go`. Process substitution and stdin do not work, so write scratch programs to a real file (`$(mktemp -d)/main.go`) and delete the directory afterwards.

---

## Pattern 2: a directory under `scripts/`

```text
myproject/
├── go.mod
├── internal/...
└── scripts/
    ├── seed/
    │   └── main.go        # go run ./scripts/seed
    ├── migrate-data/
    │   └── main.go
    └── one-time-fix/
        └── main.go
```

Each `scripts/<name>/main.go` is its own `main` package that shares the parent module's dependencies. Start it with `go run ./scripts/seed`. Choose this layout when the script:

- uses module dependencies (sqlc output, pgx, your `internal` packages),
- benefits from IDE navigation, type checking and tests,
- runs in CI or ships with the repository.

Packages under `scripts/` are ordinary packages: `golangci-lint` covers them, and `go test ./scripts/...` runs their tests. Remove one-time scripts once they have run in production, and record the reason in the commit message.

---

## Pattern 3: running a published tool without installing it

```bash
go run golang.org/x/tools/cmd/stringer@latest -type=Status
go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.27.0 generate
```

`go run <module>/<path>@<version>` builds the tool in the module cache and runs it. Pin a version in scripts and CI. On Go 1.24 or newer, `go get -tool` records tools in `go.mod`, and `go tool <name>` runs them with that pinned version for every contributor.

---

## Hard rules for scripts

A 30-line script follows the same philosophy as service code:

1. **Parse flags with `flag` or `pflag`.** Positional string parsing of `os.Args` stops at one argument.
   ```go
   url := flag.String("url", "", "URL to fetch")
   limit := flag.Int("limit", 100, "maximum bytes to read")
   flag.Parse()
   if *url == "" {
       flag.Usage()
       os.Exit(2)
   }
   ```
2. **Propagate `context.Context` wherever I/O happens**, with `signal.NotifyContext` at the top and a timeout around each external call.
   ```go
   ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
   defer stop()
   req, err := http.NewRequestWithContext(ctx, http.MethodGet, *url, nil)
   ```
3. **`log.Fatal` belongs to `main`.** Functions the script calls return errors, so they stay testable and reusable.
4. **Wrap errors with context**, as in production code: `fmt.Errorf("fetch %s: %w", *url, err)`.
5. **Release resources with `defer`** on the line after acquiring them. A script that leaks a descriptor leaks it on every run.
6. **Use `slog` when output must be parsed**, and `fmt.Println` for human terminal output. Write data to stdout and diagnostics to stderr.
7. **Stay under 250 pure lines.** A script that grows becomes a subcommand of a real CLI (see `cobra-stack.md`).
8. **Make destructive scripts dry-run by default.** Require `--apply` (or `--yes`) before deleting, migrating or writing to shared systems, and print what would change first.
9. **Keep secrets out of arguments and output.** Read them from the environment, and redact them in logs.

---

## Pattern 4: a script that needs dependencies the module lacks

### Option A: a scratch module

```bash
dir=$(mktemp -d)
cd "$dir"
go mod init scratch.local/migrate-tool
go get github.com/pressly/goose/v3@latest
$EDITOR main.go          # or write the file with your editor tool
go run .
cd - && rm -rf "$dir"
```

Run it, then delete the directory. The module cache keeps downloads, so repeat runs stay fast. Agents should create the directory under the session scratch folder, run the program there, and remove it before finishing.

### Option B: `gorun`

```bash
go install github.com/erning/gorun@latest
```

```go
//usr/bin/env gorun "$0" "$@"; exit
// /// go.mod
// module scratch
// go 1.23
// require github.com/spf13/cobra v1.8.0
// ///

package main

// ...
```

With `chmod +x script.go`, the file runs as `./script.go`. `gorun` reads the embedded `go.mod` block, builds a temporary module and executes it. It is a niche tool, worth using when the executable-script experience matters, and it adds an install step for everyone else.

---

## When a script becomes a CLI

Promote it to a `cobra` command when it needs:

- more than one subcommand,
- persistent state or configuration files,
- help text longer than a paragraph,
- repeated invocation from CI or by other people.

The boundary is soft; use judgment. A 500-line script has already crossed it.

---

## Quick checks before running a script

1. `go vet ./scripts/...` passes (or `go vet ./scripts/seed` for one script).
2. `gofumpt -l` prints nothing for the file.
3. The script has a usage line and exits with code 2 on bad arguments.
4. Anything destructive supports a dry run, and the dry run was executed first.
5. Run it with a short timeout in headless sessions: `timeout 60 go run ./scripts/seed -dry-run`.

---

## Antipatterns

| Pattern | Problem | Replacement |
|---|---|---|
| `os.Args[1]` without a length check | panics on a missing argument | `flag.Parse()` plus explicit checks |
| `log.Fatal` in a helper the script imports | ends the caller's process | return an error |
| `panic(err)` for expected failures | stack trace instead of a message | `log.Fatal` in `main`, errors elsewhere |
| skipping `defer resp.Body.Close()` | leaks connections | always close |
| one 800-line `main.go` | harder to read than a CLI | `cmd/<name>/` with subcommands |
| `// TODO: handle error` | production habits apply here too | handle it now, or document why it is ignored |
| `http.Get` with no timeout | hangs forever on a stalled server | client with `Timeout` or a context deadline |
| missing `//go:build ignore` | duplicate `main` breaks `go build ./...` | add the constraint |

## Sources

- `go run`: https://pkg.go.dev/cmd/go#hdr-Compile_and_run_Go_program
- Build constraints: https://pkg.go.dev/cmd/go#hdr-Build_constraints
- `signal.NotifyContext`: https://pkg.go.dev/os/signal#NotifyContext
- Tool dependencies in `go.mod`: https://go.dev/doc/modules/managing-dependencies#tools
- gorun: https://github.com/erning/gorun
