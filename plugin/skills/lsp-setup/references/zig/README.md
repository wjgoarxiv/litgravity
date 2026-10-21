# Zig: language-server and checker setup

- **Server id:** `zls`, launched as `zls`
- **Extensions:** `.zig .zon`
- **Checkers agy can drive:** `zig ast-check`, `zig build`, `zig fmt --check`
- **Normalised by `lsp/scripts/diagnostics.mjs`:** no; `zig ast-check <file>` and `zig build --summary all` are the evidence
- **Evidence command when nothing is normalised:** `zig build --summary all`

## What this gives you in agy

Zig ships a syntax and AST checker in the compiler (`zig ast-check`) and a full build through `zig build`. The language server `zls` is a separate project whose version must match the compiler.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- the Zig compiler: macOS `brew install zig`, Linux the tarball from https://ziglang.org/download/ (or `sudo pacman -S zig`), Windows `winget install zig.zig`

## Install (the user runs these)

**macOS**

- `brew install zls`

**Linux**

- download the zls release that matches your Zig version from https://github.com/zigtools/zls/releases and put it on PATH
- Arch: `sudo pacman -S zls`
- or build it: `zig build -Doptimize=ReleaseSafe` in a checkout of the matching tag

**Windows**

- download the zls release that matches your Zig version from https://github.com/zigtools/zls/releases and put it on PATH

Confirm afterwards:

```sh
command -v zls zig; zig version; zls --version
```

The zls version must match the zig version. A mismatch gives crashes, parse errors or silent failures.

## Project configuration

- `build.zig` and `build.zig.zon` at the root
- `zls.json` in the project or the user config directory for server options

```sh
zig ast-check src/main.zig   # syntax and AST checks without a full build
zig fmt --check src            # formatting check, writes nothing
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

This is the standard server for the language; no alternative is worth recommending.

## Troubleshooting

- **Version mismatch (the usual cause of trouble):** after upgrading Zig, upgrade or rebuild zls too.
- **zig not found:** zls shells out to `zig`; it must be on PATH as well.
- **Build runner output:** `zig build` writes `zig-out/` and `.zig-cache/`; list them in `.gitignore`.
- **Pre-1.0 language changes:** a project on an older Zig needs the older zls; read the project's `minimum_zig_version` in `build.zig.zon`.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" src/main.zig                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" src/main.zig --via=checker           # force the checker path
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
