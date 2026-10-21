# Bootstrap: Layout, Toolchain, Taskfile, CI

The first minutes of a Go project decide how it will age. The scaffold script `scripts/go/new-project.py` in this skill folder writes everything below in one run; this page documents what lands on disk and the reason for each piece, so you can scaffold by hand or audit a generated tree.

Run the script from the skill folder path your activation note gave you (`<skill-folder>` below):

```bash
uv run "<skill-folder>/scripts/go/new-project.py" <name> --path <workspace-dir> --module github.com/<org>/<name>
```

Options: `--path <parent-dir>` (default `.`), `--module <module-path>` (default: the project name) and `--purpose "<short text>"` for the generated `AGENTS.md`. The script refuses a project directory that already exists, which keeps existing work untouched; when that happens, ask the user for another name or scaffold by hand from this page. Read the file list it prints before moving on.

## Toolchain pin

A single module is pinned by the `go` directive in `go.mod`. Since Go 1.21 the `go` command downloads a matching toolchain when the local one is older, so no version manager is required.

```bash
go version            # expect 1.23 or newer
go env GOTOOLCHAIN    # "auto" (the default) lets go.mod pick the toolchain
```

For a repository with several modules, add a `go.work` file (`go work init ./svc-a ./svc-b`) and keep it out of release builds with `GOWORK=off`.

## Developer tools

Install each tool once per machine. Go 1.24 and newer can also record tools in `go.mod` with `go get -tool <module>@<version>` and run them with `go tool <name>`, which gives every contributor the same versions without a global install. Both styles are shown.

```bash
# global install style
go install mvdan.cc/gofumpt@latest
go install golang.org/x/tools/cmd/goimports@latest
go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
go install go.uber.org/nilaway/cmd/nilaway@latest
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
go install go.uber.org/mock/mockgen@latest
go install github.com/go-task/task/v3/cmd/task@latest

# pinned-in-go.mod style (Go 1.24+)
go get -tool mvdan.cc/gofumpt@latest
go get -tool github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go tool gofumpt -l .
```

Protobuf and Connect projects add:

```bash
go install github.com/bufbuild/buf/cmd/buf@latest
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install connectrpc.com/connect/cmd/protoc-gen-connect-go@latest
```

golangci-lint publishes its v2 line under the `/v2` module path. An install line without `/v2` fetches the v1 binary, which rejects the v2 configuration format used in `golangci-strict.md`. Check with `golangci-lint version`.

## The canonical tree

```text
myservice/
├── go.mod
├── go.sum
├── Taskfile.yml               # task runner entry point
├── .golangci.yml              # see golangci-strict.md
├── .editorconfig
├── .gitignore
├── README.md
├── AGENTS.md                  # short, declarative project facts for agents
├── cmd/
│   └── server/
│       └── main.go            # parse flags, call cmd.Execute; at most 50 lines
├── internal/                  # importable only inside this module
│   ├── cmd/                   # run loop: config, wiring, signals
│   ├── api/                   # transport layer (gin or connect)
│   │   ├── server.go
│   │   ├── middleware/
│   │   └── handlers/
│   ├── domain/                # types with smart constructors, no I/O
│   ├── service/               # business logic, depends on domain
│   ├── store/                 # persistence
│   │   ├── sqlc/              # generated, read-only
│   │   ├── queries/           # *.sql inputs for sqlc
│   │   └── migrations/        # goose migrations
│   ├── config/                # env-driven configuration
│   └── obs/                   # slog setup, health, tracing
├── pkg/                       # public library packages, created only when someone imports them
├── proto/                     # *.proto sources (Connect or gRPC projects)
├── gen/                       # generated protobuf and OpenAPI code
├── test/                      # shared fixtures and helpers
└── .github/workflows/ci.yml
```

Layout rules:

- `cmd/<binary>/main.go` stays at or below 50 lines. Its job is to build a signal-aware context and hand control to `internal/cmd`.
- `internal/` holds the business code, and the compiler refuses imports of it from other modules.
- `pkg/` starts empty. Publish a package there only once an outside consumer exists.
- Name files after the concept they own. Directories called `utils`, `helpers`, `common` or `shared` collect unrelated code and get rejected in review.
- One package per directory, one responsibility per package.
- Generated directories (`gen/`, `internal/store/sqlc/`) carry a `// Code generated ... DO NOT EDIT.` header and are excluded from lint (`golangci-strict.md` shows the exclusion).

## `Taskfile.yml`

`go-task/task` is a cross-platform task runner with a YAML syntax. Every action a human or CI performs goes through it, so local runs and CI runs behave alike.

```yaml
version: '3'

vars:
  BINARY: server
  PKG: ./cmd/server

tasks:
  default:
    desc: Format, lint, test
    cmds:
      - task: fmt
      - task: lint
      - task: test

  fmt:
    desc: Format all Go files
    cmds:
      - gofumpt -w .
      - goimports -w -local "$(go list -m)" .

  lint:
    desc: Run every linter
    cmds:
      - golangci-lint run --timeout 5m ./...
      - nilaway -include-pkgs "$(go list -m)" ./...

  test:
    desc: Tests with the race detector and shuffled order
    cmds:
      - go test -race -shuffle=on -count=1 ./...

  cover:
    desc: Coverage report
    cmds:
      - go test -race -shuffle=on -count=1 -coverprofile=coverage.out ./...
      - go tool cover -html=coverage.out -o coverage.html

  build:
    desc: Build the binary
    cmds:
      - go build -trimpath -ldflags="-s -w" -o bin/{{.BINARY}} {{.PKG}}

  run:
    desc: Build and run locally
    deps: [build]
    cmds:
      - ./bin/{{.BINARY}}

  gen:
    desc: Run every generator
    cmds:
      - task: gen:sqlc
      - task: gen:mocks
      - task: gen:proto

  gen:sqlc:
    cmds:
      - sqlc generate
    sources:
      - internal/store/queries/*.sql
      - sqlc.yaml
    generates:
      - internal/store/sqlc/*.go

  gen:mocks:
    cmds:
      - go generate ./...

  gen:proto:
    cmds:
      - buf generate
    sources:
      - proto/**/*.proto
      - buf.yaml
      - buf.gen.yaml

  migrate:up:
    cmds:
      - goose -dir internal/store/migrations postgres "$DATABASE_URL" up

  migrate:down:
    cmds:
      - goose -dir internal/store/migrations postgres "$DATABASE_URL" down

  ci:
    desc: The full CI pipeline, locally
    cmds:
      - task: fmt
      - task: lint
      - task: test
      - task: build
```

`task` with no arguments runs the quick loop. `task ci` mirrors the pipeline. A `sources`/`generates` pair lets `task` skip a generator whose inputs have not changed.

## `go.mod` skeleton

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

List direct dependencies only and let `go mod tidy` fill in the indirect block. Treat the versions above as floors observed when this page was written; run `go get -u ./...` on a fresh project and read the diff before accepting upgrades.

## `.editorconfig`

```ini
root = true

[*]
indent_style = tab
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.{yml,yaml,json,md}]
indent_style = space
indent_size = 2
```

## `.gitignore`

```gitignore
bin/
coverage.out
coverage.html
*.test
*.prof

# editors
.idea/
.vscode/
*.swp

# local environment
.env
.env.local

# secrets
*.pem
*.key
```

Keep `go.sum` and the generated code tracked. Build artifacts and local environment files stay ignored.

## CI with GitHub Actions

`.github/workflows/ci.yml`:

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.23'
          cache: true

      - name: Install tools
        run: |
          go install mvdan.cc/gofumpt@latest
          go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
          go install go.uber.org/nilaway/cmd/nilaway@latest

      - name: Format check
        run: test -z "$(gofumpt -l .)"

      - name: Lint
        run: golangci-lint run --timeout 5m ./...

      - name: Nilaway
        run: nilaway -include-pkgs "$(go list -m)" ./...

      - name: Test
        run: go test -race -shuffle=on -count=1 ./...

      - name: Build
        run: go build -trimpath ./...
```

Order the stages from cheapest to most expensive so the pipeline fails fast: format, lint, nil analysis, tests, build. In CI, pin tool versions to explicit tags instead of `@latest` once the project has a release process, and add `golangci/golangci-lint-action` if you want its annotation output.

## `AGENTS.md` for the new project

Every scaffold carries a short `AGENTS.md`: declarative sentences, no marketing prose, only facts a coding agent needs to act correctly.

```markdown
# AGENTS.md

Go 1.23+ HTTP service for <one-line purpose>.

## Commands
- `task` runs fmt, lint and test
- `task build` produces ./bin/server
- `task gen` regenerates sqlc, mocks and proto output

## Architecture
- `cmd/server/main.go` is the entry point, at most 50 lines
- `internal/api/` holds gin handlers and middleware
- `internal/domain/` holds smart-constructor types without I/O
- `internal/store/sqlc/` is generated and read-only

## Conventions
- All logging goes through `log/slog`
- `context.Context` is the first parameter of every function that does I/O
- Errors are wrapped with `%w` and inspected with `errors.Is` and `errors.As`
- Files stay under 250 pure lines; split before adding more
```

The scaffold fills in the project name and purpose. Update the architecture list whenever a top-level package appears.

## After scaffolding

1. `cd` into the project and run `go mod tidy` to materialize `go.sum`.
2. Run `task` once. A fresh tree should pass every gate before any feature code exists; a failure here points at a tool version mismatch to fix first.
3. Run `git init` and commit the scaffold on its own so later diffs show only feature work.
4. Run `bash "<skill-folder>/scripts/go/check-no-excuse-rules.sh" $(git ls-files '*.go')` to confirm the scaffold itself satisfies the house rules (the checker takes `.go` file paths as arguments).
5. Record the tool versions (`go version`, `golangci-lint version`) in the first commit message or the README for reproducibility.

## Sources

- Go modules reference: https://go.dev/ref/mod
- Tool dependencies in go.mod: https://go.dev/doc/modules/managing-dependencies#tools
- go-task: https://taskfile.dev
- golangci-lint v2 configuration: https://golangci-lint.run/docs/configuration/
- Official module layout guide: https://go.dev/doc/modules/layout
