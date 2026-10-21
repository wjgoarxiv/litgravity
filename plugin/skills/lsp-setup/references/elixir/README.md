# Elixir: language-server and checker setup

- **Server id:** `elixir-ls`, launched as `elixir-ls`
- **Extensions:** `.ex .exs`
- **Checkers agy can drive:** `mix compile`, `mix format --check-formatted`, `mix credo`, `mix dialyzer`
- **Normalised by `lsp/scripts/diagnostics.mjs`:** no; `mix compile --warnings-as-errors` is the evidence
- **Evidence command when nothing is normalised:** `mix compile --warnings-as-errors`

## What this gives you in agy

Elixir diagnostics come from the compiler, so `mix compile` is the evidence path. The language server compiles the project and its dependencies on first start, which makes it slow to answer a roundtrip check.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- Erlang/OTP and Elixir of the versions the project uses (`.tool-versions` or `mix.exs`): macOS `brew install elixir`, Debian or Ubuntu `sudo apt install elixir erlang`, or a version manager such as asdf or mise; Windows installers are listed at https://elixir-lang.org/install.html

## Install (the user runs these)

**macOS**

- `brew install elixir-ls`

**Linux**

- download the release zip from https://github.com/elixir-lsp/elixir-ls/releases, unzip it and symlink `language_server.sh` as `elixir-ls` on PATH
- or build from source: `mix deps.get && mix compile && mix elixir_ls.release2 -o release`

**Windows**

- download the release zip from https://github.com/elixir-lsp/elixir-ls/releases and put `language_server.bat` on PATH

Confirm afterwards:

```sh
command -v elixir-ls elixir mix; elixir --version
```

Build or download elixir-ls for the Erlang and Elixir versions the project uses to avoid bytecode errors.

## Project configuration

- `mix.exs` at the project root; `mix.lock` pins dependencies
- `.formatter.exs` for formatting; `.credo.exs` for Credo
- `.tool-versions` when asdf or mise manages Erlang and Elixir

```sh
ln -s /opt/elixir-ls/language_server.sh ~/.local/bin/elixir-ls
asdf reshim elixir   # asdf users, after installing the launcher
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `expert` | the newer official Elixir language server project |
| `lexical` | alternative Elixir server |
| `next-ls` | alternative Elixir server |
| `mix credo --strict` | lint findings |

## Troubleshooting

- **asdf shims:** reshim after installing so the `elixir-ls` shim resolves.
- **Slow first start:** ElixirLS compiles dependencies on first run; give `verify-lsp.mjs` `--timeout=180000`.
- **OTP mismatch:** rebuild elixir-ls against the project's toolchain.
- **`_build/` and `.elixir_ls/` appear in the repository:** both are generated; the project's `.gitignore` should list them.
- **Missing dependencies:** `mix deps.get` downloads packages and belongs to the user.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" lib/app.ex                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" lib/app.ex --via=checker           # force the checker path
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
