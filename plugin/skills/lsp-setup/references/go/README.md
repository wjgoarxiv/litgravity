# Go: language-server and checker setup

- **Server id:** `gopls`, launched as `gopls`
- **Extensions:** `.go`
- **Checkers agy can drive:** `gopls check`, `go vet`, `go build`, `staticcheck`, `golangci-lint`; navigation through `gopls definition`, `references`, `implementation` and `rename -d`
- **Normalised by `lsp/scripts/diagnostics.mjs`:** yes, `gopls check`, falling back to `go vet ./...`
- **Evidence command when nothing is normalised:** `go vet ./...`

## What this gives you in agy

Go has the richest command-line navigation of the languages here: the `gopls` binary exposes its features as subcommands, so definition, references, implementations and a rename diff work without a protocol client.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- the Go toolchain (`go version`): macOS `brew install go`, Debian or Ubuntu `sudo apt install golang-go` or the tarball from https://go.dev/dl/, Windows `winget install GoLang.Go`

## Install (the user runs these)

**macOS**

- `go install golang.org/x/tools/gopls@latest`
- alternative: `brew install gopls`
- the binary lands in `$(go env GOPATH)/bin`; add that directory to PATH

**Linux**

- `go install golang.org/x/tools/gopls@latest`
- some distributions package gopls (Arch: `sudo pacman -S gopls`) but trail upstream; `go install` tracks the toolchain
- add `$(go env GOPATH)/bin` to PATH

**Windows**

- `go install golang.org/x/tools/gopls@latest`
- the binary lands in `%USERPROFILE%\go\bin`; add it to PATH

Confirm afterwards:

```sh
command -v gopls; gopls version; go env GOPATH GOFLAGS
```

Rebuild gopls with the same `go install` command after upgrading Go; a gopls built by an older toolchain can refuse a newer `go.mod`.

## Project configuration

- `go.mod` at the module root, or `go.work` for a workspace, selects the build context; start from the directory that holds it
- `GOFLAGS`, build tags (`-tags`) and `GOOS`/`GOARCH` change what gopls loads; record them in the report
- `.golangci.yml` when the project lints with golangci-lint

```text
module example.com/app

go 1.22
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `staticcheck ./...` | extra static analysis checks (`go install honnef.co/go/tools/cmd/staticcheck@latest`) |
| `golangci-lint run` | aggregate linter; confirm its flags with `golangci-lint --help` because the output options changed between major versions |

## Troubleshooting

- **PATH:** export `$(go env GOPATH)/bin` and open a new shell.
- **"no required module provides package":** start from the directory holding `go.mod`; outside a module gopls degrades to per-file results. Dependency downloads are the user's call (`go mod tidy`).
- **Stale toolchain:** reinstall gopls after a Go upgrade.
- **Build tags hide files:** pass the tags the project builds with (`GOFLAGS=-tags=integration`) and say so in the report.
- **Workspace with several modules:** add a `go.work` file or run gopls from each module directory.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" main.go                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" main.go --via=checker           # force the checker path
node "<skill-dir>/../lsp/scripts/diagnostics.mjs" main.go               # normalised CLI diagnostics
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

Navigation examples: `gopls definition main.go:12:5`, `gopls references -d main.go:12:5`, `gopls rename -d main.go:12:5 NewName` (the `-d` flag prints a diff and writes nothing).

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
