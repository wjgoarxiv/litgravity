# Haskell: language-server and checker setup

- **Server id:** `haskell-language-server`, launched as `haskell-language-server-wrapper --lsp`
- **Extensions:** `.hs .lhs`
- **Checkers agy can drive:** `ghc -fno-code`, `cabal build`, `stack build`, `hlint`
- **Normalised by `lsp/scripts/diagnostics.mjs`:** no; `cabal build all` or `stack build` is the evidence
- **Evidence command when nothing is normalised:** `cabal build all   or   stack build`

## What this gives you in agy

Haskell diagnostics are GHC diagnostics. A build through Cabal or Stack is the evidence; `ghc -fno-code <file>` type-checks one module without generating code. HLS needs a build of itself that supports the project's GHC version.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- GHC plus Cabal or Stack, normally through ghcup: `curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | sh` on macOS and Linux, `brew install ghcup`, or the Windows PowerShell installer from https://www.haskell.org/ghcup/

## Install (the user runs these)

**macOS**

- `ghcup install hls`
- toolchain: `ghcup install ghc`, `ghcup install cabal`

**Linux**

- `ghcup install hls`
- toolchain: `ghcup install ghc`, `ghcup install cabal`
- build prerequisites: `sudo apt install build-essential libgmp-dev libffi-dev libncurses-dev`

**Windows**

- `ghcup install hls` in the ghcup shell
- toolchain: `ghcup install ghc`, `ghcup install cabal`

Confirm afterwards:

```sh
command -v haskell-language-server-wrapper ghc cabal; haskell-language-server-wrapper --probe-tools
```

HLS must support the project's GHC version. `--probe-tools` prints the HLS, GHC and Cabal versions the wrapper resolves for the current directory.

## Project configuration

- `cabal.project`, a `*.cabal` file or `stack.yaml` at the root
- `hie.yaml` (the "cradle") for multi-package repos; `gen-hie > hie.yaml` from the `implicit-hie` package generates one
- `.hlint.yaml` for hlint rules

```yaml
cradle:
  cabal:
    component: "lib:myproject"
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `hlint --json <file>` | lint suggestions; install with `cabal install hlint` or `brew install hlint` |
| `ghc -fno-code <file>` | type-check one module without code generation |

## Troubleshooting

- **GHC mismatch:** install an HLS build for the project's GHC, or align the GHC with `ghcup set ghc <version>`.
- **No cradle:** add `hie.yaml` in multi-package repos.
- **Slow first load:** HLS compiles dependencies on first open; wait with a bound and give `verify-lsp.mjs` a long `--timeout`.
- **Missing system libraries:** a failing build that names a C library needs a system package, which the user installs.
- **`dist-newstyle/` and `.stack-work/` appear in the repository:** both are build output; list them in `.gitignore`.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" src/Main.hs                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" src/Main.hs --via=checker           # force the checker path
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
