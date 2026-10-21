# Bash and POSIX shell: language-server and checker setup

- **Server id:** `bash`, launched as `bash-language-server start`
- **Extensions:** `.sh .bash .zsh .ksh`
- **Checkers agy can drive:** `shellcheck -f json`, `bash -n`, `shfmt -d`
- **Normalised by `lsp/scripts/diagnostics.mjs`:** yes, `shellcheck -f json`, falling back to `bash -n` (syntax only)
- **Evidence command when nothing is normalised:** `shellcheck -f json <file>`

## What this gives you in agy

ShellCheck does the real analysis, and the language server only wraps it for editors. For agy, ShellCheck alone is enough, and `bash -n` is the syntax-only fallback when it is missing.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- Node.js only for the language server; ShellCheck is a standalone binary
- the shell the scripts target (macOS ships bash 3.2, so a script written for bash 5 features needs `brew install bash` to run, though not to be linted)

## Install (the user runs these)

**macOS**

- `brew install shellcheck`
- language server: `npm install -g bash-language-server` or `brew install bash-language-server`
- formatter: `brew install shfmt`

**Linux**

- Debian or Ubuntu: `sudo apt install shellcheck`; Fedora: `sudo dnf install ShellCheck`; Arch: `sudo pacman -S shellcheck`
- language server: `npm install -g bash-language-server`
- formatter: `sudo apt install shfmt`

**Windows**

- `scoop install shellcheck`, `choco install shellcheck` or `winget install koalaman.shellcheck`
- language server: `npm install -g bash-language-server`
- run scripts in WSL or Git Bash; ShellCheck reads the file either way

Confirm afterwards:

```sh
command -v shellcheck bash-language-server shfmt; shellcheck --version
```

ShellCheck does the linting. The language server needs ShellCheck on PATH to show diagnostics, and the agy path needs ShellCheck alone.

## Project configuration

- `.shellcheckrc` for `shell=`, `disable=` and `external-sources=true`
- a `# shellcheck shell=bash` directive inside a file sets its dialect
- `.editorconfig` for `shfmt` indentation

```text
shell=bash
external-sources=true
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `shfmt -d <file>` | formatter diff, writes nothing; formatting is separate from linting |
| `checkbashisms <file>` | finds bash-only syntax in `#!/bin/sh` scripts |

## Troubleshooting

- **No diagnostics from the server:** ShellCheck is missing; install it and open a new shell.
- **Wrong dialect:** `.zsh` and `.ksh` files are linted as bash and ShellCheck can flag shell-specific syntax; state that in the report.
- **Sourced files unresolved (SC1091):** add `external-sources=true` and a `# shellcheck source=path` directive.
- **PATH:** open a new shell after a global npm install.
- **Severity gating:** `shellcheck -S warning` hides style notes; say which severity the report used.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" bin/build.sh                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" bin/build.sh --via=checker           # force the checker path
node "<skill-dir>/../lsp/scripts/diagnostics.mjs" bin/build.sh               # normalised CLI diagnostics
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
