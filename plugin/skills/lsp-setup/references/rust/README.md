# Rust: language-server and checker setup

- **Server id:** `rust`, launched as `rust-analyzer`
- **Extensions:** `.rs`
- **Checkers agy can drive:** `cargo check`, `cargo clippy`, `rust-analyzer diagnostics .`
- **Normalised by `lsp/scripts/diagnostics.mjs`:** yes, `cargo check --message-format=json --all-targets`
- **Evidence command when nothing is normalised:** `cargo check --all-targets`

## What this gives you in agy

Rust diagnostics come from the compiler itself through `cargo check`, which is as authoritative as it gets. The analyzer adds editor features that the command line lacks, so agy relies on `cargo check` and treats the server as an editor and CI convenience.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- rustup and a toolchain (`rustup show`): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` on macOS and Linux, `winget install Rustlang.Rustup` on Windows, or `brew install rustup`

## Install (the user runs these)

**macOS**

- `rustup component add rust-analyzer rust-src clippy`
- alternative: `brew install rust-analyzer` (not tied to the project toolchain)

**Linux**

- `rustup component add rust-analyzer rust-src clippy`
- distribution packages exist (Arch: `sudo pacman -S rust-analyzer`) but lag the toolchain

**Windows**

- `rustup component add rust-analyzer rust-src clippy`
- run it in the shell where `rustup` is on PATH

Confirm afterwards:

```sh
command -v rust-analyzer cargo; rustup component list --installed; rust-analyzer --version
```

A `rust-analyzer` file can exist on PATH as a rustup shim while the component is missing. The shim then prints "`rust-analyzer` is unavailable for the active toolchain" and exits 1, which `verify-lsp.mjs --via=server` reports as a FAIL (the default `auto` mode names the failure and falls back to the checker). The fix is the `rustup component add` line above, run by the user.

## Project configuration

- `Cargo.toml` at the crate or workspace root; `Cargo.lock` pins dependencies
- `rust-toolchain.toml` pins the toolchain and its components
- `.cargo/config.toml` and feature flags change what compiles; record them
- `rust-analyzer.toml` or `.rust-analyzer.toml` at the root for server settings, where the version supports it

```toml
[toolchain]
channel = "stable"
components = ["rust-analyzer", "rust-src", "clippy"]
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `cargo clippy --message-format=json` | lint findings in the same JSON message format |
| `cargo check --workspace` | all members of a workspace, when the crate-level check is too narrow |

## Troubleshooting

- **PATH:** the rustup shims live in `~/.cargo/bin` (or the Homebrew rustup prefix); open a new shell.
- **"unavailable for the active toolchain":** the component is missing for the toolchain in `rust-toolchain.toml`; the user runs `rustup component add rust-analyzer`.
- **Crashes while loading rust-src:** the user can run `rustup component remove rust-src && rustup component add rust-src`.
- **Proc-macro or build-script failures:** confirm `cargo check` passes first; the analyzer reuses the same toolchain.
- **Slow first run:** `cargo check` builds dependencies; pass `--timeout=600` to the normaliser instead of retrying.
- **Empty diagnostics from the server roundtrip:** the analyzer may publish after its first flycheck; the checker path (`--via=checker`) is the dependable evidence for Rust.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" src/main.rs                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" src/main.rs --via=checker           # force the checker path
node "<skill-dir>/../lsp/scripts/diagnostics.mjs" src/main.rs               # normalised CLI diagnostics
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
