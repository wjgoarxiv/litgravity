# Strict `.golangci.yml` (golangci-lint v2)

This file is the definition of acceptable Go in the house style. Copy it into the project root as is, then adjust only the module prefix. Each linter is on for a reason; read its row in the rationale table before turning one off.

golangci-lint v2 changed the configuration schema: the file starts with `version: "2"`, formatters (`gofumpt`, `goimports`) live in their own `formatters` section, per-linter options sit under `linters.settings`, and exclusions sit under `linters.exclusions`. A v1 file fails to load. Two commands help during the switch:

```bash
golangci-lint migrate          # rewrites a v1 config into the v2 layout
golangci-lint config verify    # validates the file against the JSON schema
```

Install the v2 binary from its `/v2` module path (`go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest`) and check `golangci-lint version`. Linter names and options evolve between minor releases, so run `golangci-lint linters` to see what the installed build offers before adding one.

## `.golangci.yml`

```yaml
version: "2"

run:
  timeout: 5m
  tests: true
  modules-download-mode: readonly

linters:
  default: none
  enable:
    # Correctness
    - govet            # stdlib vet: shadow, nilness, copylocks, lostcancel, fieldalignment
    - staticcheck      # SA, S and ST checks (v2 folds gosimple and stylecheck in)
    - errcheck         # every error is handled
    - errorlint        # %w wrapping, errors.Is and errors.As
    - nilerr           # returns nil right after an err != nil check
    - nilnil           # returns (nil, nil) from (*T, error)
    - bodyclose        # unclosed http.Response.Body
    - rowserrcheck     # sql.Rows.Err never read
    - sqlclosecheck    # sql.Rows and sql.Stmt never closed
    - contextcheck     # context.Background() while a ctx is in scope
    - noctx            # HTTP request built without a context
    - fatcontext       # context.WithValue growing inside a loop
    - copyloopvar      # pre-1.22 loop variable copies
    - intrange         # for i := range n
    - usetesting       # t.TempDir and t.Setenv in tests
    - testifylint      # require versus assert, argument order
    - forcetypeassert  # bare type assertions that can panic
    - makezero         # make([]T, n) followed by append
    - recvcheck        # mixed value and pointer receivers
    - errname          # ErrFoo sentinels and FooError types

    # Style
    - whitespace
    - misspell
    - unconvert
    - unparam
    - ineffassign
    - dupword
    - nolintlint       # every nolint names a linter and gives a reason
    - revive
    - unused

    # Architecture
    - gocognit
    - gocyclo
    - funlen
    - lll
    - nestif
    - dupl
    - gochecknoinits   # init() functions hide state from tests
    - depguard         # banned imports

    # Variant completeness
    - exhaustive

    # Security
    - gosec

    # Logging and performance
    - sloglint
    - forbidigo        # fmt.Print and log.* in library code
    - perfsprint
    - prealloc

  settings:
    errcheck:
      check-type-assertions: true
      check-blank: true            # `_ = err` is a finding

    govet:
      enable-all: true
      settings:
        shadow:
          strict: true

    errorlint:
      errorf: true                 # %w when wrapping
      asserts: true                # errors.As over type assertions
      comparison: true             # errors.Is over ==

    gocognit:
      min-complexity: 25

    gocyclo:
      min-complexity: 15

    funlen:
      lines: 90
      statements: 60
      ignore-comments: true

    lll:
      line-length: 120
      tab-width: 4

    nestif:
      min-complexity: 4

    exhaustive:
      default-signifies-exhaustive: false
      check:
        - switch
        - map

    gosec:
      excludes:
        - G104                     # errcheck covers it
        - G304                     # file path from input; CLIs read user paths by design

    sloglint:
      no-mixed-args: true
      attr-only: true              # slog.String("k", v), never alternating key/value
      no-global: all               # a logger value, never slog.Info
      context: scope               # *Context variants when a ctx is in scope
      static-msg: true             # message is a literal
      no-raw-keys: true
      key-naming-case: snake

    testifylint:
      enable-all: true
      disable:
        - require-error            # table loops use assert.Error on purpose

    nolintlint:
      allow-unused: false
      require-explanation: true
      require-specific: true

    revive:
      severity: warning
      rules:
        - name: var-naming
        - name: package-comments
        - name: exported
        - name: error-return
        - name: error-naming
        - name: errorf
        - name: if-return
        - name: indent-error-flow
        - name: range-val-in-closure
        - name: redefines-builtin-id
        - name: superfluous-else
        - name: unhandled-error
          arguments: ["fmt.Print.*", "fmt.Fprint.*"]

    depguard:
      rules:
        main:
          list-mode: lax
          deny:
            - pkg: github.com/sirupsen/logrus
              desc: use log/slog
            - pkg: go.uber.org/zap
              desc: use log/slog
            - pkg: github.com/rs/zerolog
              desc: use log/slog
            - pkg: github.com/pkg/errors
              desc: use the standard errors package with %w
            - pkg: io/ioutil
              desc: deprecated since Go 1.16; use io and os

    forbidigo:
      forbid:
        - pattern: ^fmt\.Print(f|ln)?$
          msg: use slog (CLIs write output through an injected io.Writer)
        - pattern: ^log\.(Print|Fatal|Panic).*$
          msg: use slog and return errors

    perfsprint:
      integer-format: true
      error-format: true
      bool-format: true
      string-format: true

  exclusions:
    generated: lax
    presets:
      - comments
      - std-error-handling
    rules:
      - path: _test\.go
        linters: [funlen, lll, dupl, gosec, forbidigo, gochecknoinits]
      - path: ^cmd/
        linters: [forbidigo]       # a CLI main may print its own usage
    paths:
      - gen/
      - internal/store/sqlc/

issues:
  max-issues-per-linter: 0
  max-same-issues: 0

formatters:
  enable:
    - gofumpt
    - goimports
  settings:
    gofumpt:
      extra-rules: true
    goimports:
      local-prefixes:
        - github.com/your-org
```

`generated: lax` skips files whose header says `Code generated ... DO NOT EDIT.`, which already covers `*.pb.go`, `*.connect.go` and sqlc output. The explicit `paths` entries add a second line of defence for directories you know are generated. Replace `github.com/your-org` with the module path (`go list -m`).

## Per-linter rationale

| Linter | Catches | Reason to keep it on |
|---|---|---|
| `errcheck` with `check-blank` | ignored errors from `Close`, `Write`, `json.Marshal`, and `_ = err` | silent error loss is the most common Go defect; the setting forces a decision at each site |
| `errorlint` | `err == io.EOF`, `%v` where `%w` was meant, type assertions on errors | once middleware wraps errors, identity comparisons break without notice |
| `nilerr`, `nilnil` | returning `nil` after an error check, `(nil, nil)` results | frequent in generated code; the linter finds it mechanically |
| `bodyclose`, `rowserrcheck`, `sqlclosecheck` | response bodies and result sets left open | the leading source of descriptor and connection leaks |
| `contextcheck`, `noctx` | fresh `context.Background()` in a function that has a `ctx`; requests without context | cancellation and deadlines stop propagating |
| `exhaustive` | a missing `case` for an enum constant or sealed variant | the closest Go gets to compiler-checked exhaustiveness |
| `sloglint` | global `slog.Info`, mixed attribute styles, dynamic messages | keeps logs structured and greppable |
| `govet` with `shadow` | an inner `err :=` hiding an outer one | masks the error the caller should see |
| `govet` with `fieldalignment` | struct layouts that waste memory | cheap signal; exempt wire types where JSON field order matters |
| `copyloopvar`, `intrange` | pre-1.22 loop variable idioms | the language moved on and the lint follows it |
| `usetesting` | `os.Setenv`, `os.MkdirTemp` in tests | automatic cleanup and isolation from `t.TempDir` and `t.Setenv` |
| `gocognit`, `gocyclo`, `funlen`, `nestif` | oversized or tangled functions | function-level counterpart of the 250 line file ceiling |
| `gosec` | injection, weak crypto, path traversal patterns | production code has to pass it |
| `testifylint` | `assert` where `require` belongs, swapped expected and actual | subtle test bugs that make failures confusing |
| `perfsprint`, `prealloc`, `makezero` | slow formatting, avoidable growth, `make` plus `append` bugs | measurable wins and one classic defect |
| `forcetypeassert` | `x := v.(T)` that panics on mismatch | the comma-ok form handles the miss |
| `depguard`, `forbidigo` | superseded logging and error libraries, stray prints | keeps one logging and one error style |
| `gochecknoinits` | `init()` functions | hidden global state resists testing |
| `recvcheck`, `errname` | mixed receivers, odd error names | consistent method sets and predictable naming |
| `nolintlint` | blanket or unexplained suppressions | enforces the policy below |

## Suppression policy

A suppression looks like `//nolint:linter1 // <reason>` and obeys three rules:

1. **Name the linter.** `//nolint` alone and `//nolint:all` are findings (`require-specific`).
2. **Give a reason after the second `//`.** Valid reasons: "generated wire type, field order is part of the OpenAPI contract", "false positive: protobuf import alias". Weak ones: "ignore", "later" (`require-explanation` checks that something is present, and review checks that it is true).
3. **Remove stale directives.** `allow-unused: false` reports a `//nolint` that suppresses nothing.

The companion script `scripts/go/check-no-excuse-rules.sh` repeats the reason check for files that linters skip. When a finding looks like a false positive, prefer a small code change (rename, extract a function, add a comma-ok) over a suppression. A new `//nolint` in a diff is a reviewable event, so mention it in the final report.

## Working with the findings

- Run `golangci-lint run --fix ./...` for the linters that can rewrite code (`gofumpt`, `goimports`, `intrange`, `copyloopvar`, `perfsprint` and others), then review the diff.
- Run `golangci-lint fmt ./...` to apply the configured formatters without linting.
- `golangci-lint run --new-from-rev=origin/main ./...` shows only findings introduced on the branch, useful when you touch a legacy codebase. Fix those, and leave the remaining backlog to a dedicated cleanup change.
- On a large repository, `golangci-lint cache status` and the default build cache keep repeat runs fast. Install the binary from source with the same Go version the project builds with.
- A missing linter name in `enable` fails the run with `unknown linters`, which tells you the installed version predates it. Upgrade the binary, or drop that line and note it in the report.

## CI gate

```bash
test -z "$(gofumpt -l .)"                      # formatting
golangci-lint run --timeout 5m ./...           # every linter above
nilaway -include-pkgs "$(go list -m)" ./...    # nil flow analysis
go test -race -shuffle=on -count=1 ./...       # races and ordering
```

Any non-zero exit blocks the change.

## Sources

- golangci-lint v2 configuration: https://golangci-lint.run/docs/configuration/
- Migration to v2: https://golangci-lint.run/docs/product/migration-guide/
- staticcheck checks: https://staticcheck.dev/docs/checks
- sloglint: https://github.com/go-simpler/sloglint
- exhaustive: https://github.com/nishanths/exhaustive
- nilaway: https://github.com/uber-go/nilaway
