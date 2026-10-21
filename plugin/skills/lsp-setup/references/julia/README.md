# Julia: language-server and checker setup

- **Server id:** `julials`, launched as `julia --startup-file=no --history-file=no --project=@lsp -e 'using LanguageServer; runserver()'`
- **Extensions:** `.jl`
- **Checkers agy can drive:** `julia` itself (package tests); no syntax-only check is wired
- **Normalised by `lsp/scripts/diagnostics.mjs`:** no; `julia --project -e 'using Pkg; Pkg.test()'` is the evidence, run with the user's approval
- **Evidence command when nothing is normalised:** `julia --project -e 'using Pkg; Pkg.test()'`

## What this gives you in agy

Julia has no standalone server binary. The server is a Julia package, `LanguageServer.jl`, started by the `julia` command, and the project's test suite is the dependable evidence. Precompilation makes the first start slow and silent.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- Julia, ideally through juliaup, which manages versions

## Install (the user runs these)

**macOS**

- `brew install juliaup && juliaup add release`
- then add the package to a shared environment: `julia -e 'using Pkg; Pkg.activate("lsp"; shared=true); Pkg.add("LanguageServer")'`

**Linux**

- `curl -fsSL https://install.julialang.org | sh`
- then add the package to a shared environment: `julia -e 'using Pkg; Pkg.activate("lsp"; shared=true); Pkg.add("LanguageServer")'`

**Windows**

- `winget install --name Julia --id 9NJNWW8PVKMN -e -s msstore`
- then add the package to a shared environment with the same `julia -e` line

Confirm afterwards:

```sh
command -v julia juliaup; julia --version
```

There is no `julials` binary; the server is launched by the `julia` command itself. The shared environment is named `@lsp`, and the launch line selects it with `--project=@lsp`. The line follows the package's documented usage and was not exercised against a live install when this skill was written; override it with `--server="<command line>"` when your setup differs.

## Project configuration

- `Project.toml` and `Manifest.toml` at the root
- `JULIA_PROJECT=@lsp` selects the shared environment for the server process

```sh
JULIA_PROJECT=@lsp julia --startup-file=no -e 'using LanguageServer; runserver()'
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `JET.report_file("<file>")` | static analysis from JET.jl in a project that already depends on it |
| `julia --project -e 'using Pkg; Pkg.test()'` | the package test suite |

## Troubleshooting

- **First run precompiles and stays silent:** it can take minutes; use a long `--timeout` and leave the process alone.
- **Package not found:** `LanguageServer` has to be in the environment the server runs in; select it with `--project=@lsp` or `JULIA_PROJECT`.
- **Project packages not resolved:** the server indexes the active project; run `julia --project -e 'using Pkg; Pkg.instantiate()'` first (the user approves it, it downloads packages).
- **Depot location:** precompiled caches live under `~/.julia`; a read-only home blocks the server.
- **No syntax-only check:** report a Julia verification as based on the test run, with its exit code.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" src/App.jl                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" src/App.jl --via=checker           # force the checker path
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
