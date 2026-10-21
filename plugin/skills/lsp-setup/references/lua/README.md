# Lua: language-server and checker setup

- **Server id:** `lua-ls`, launched as `lua-language-server`
- **Extensions:** `.lua`
- **Checkers agy can drive:** `lua-language-server --check`, `luac -p`, `luacheck`
- **Normalised by `lsp/scripts/diagnostics.mjs`:** no; `lua-language-server --check <dir>` is the evidence
- **Evidence command when nothing is normalised:** `lua-language-server --check . --checklevel=Warning --logpath <scratch-dir>`

## What this gives you in agy

Lua is unusual because the language server has a real one-shot mode: `lua-language-server --check <dir>` analyses a workspace and prints its diagnostics, so the command line carries almost everything the server offers.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- optional: LuaRocks for `luacheck` (`brew install luarocks`, `sudo apt install luarocks`)

## Install (the user runs these)

**macOS**

- `brew install lua-language-server`
- optional lint: `brew install luacheck`

**Linux**

- download a release from https://github.com/LuaLS/lua-language-server/releases, extract it and put its `bin` directory on PATH
- Arch: `sudo pacman -S lua-language-server`
- optional lint: `luarocks install luacheck`

**Windows**

- download a release from https://github.com/LuaLS/lua-language-server/releases and put its `bin` directory on PATH
- optional lint: `luarocks install luacheck`

Confirm afterwards:

```sh
command -v lua-language-server luac luacheck
```

`--check` writes a log under the server's cache directory unless `--logpath` points elsewhere; give it a scratch directory and delete it afterwards.

## Project configuration

- `.luarc.json` (or `.luarc.jsonc`) at the root sets the runtime version, globals and the workspace library
- `.luacheckrc` for luacheck
- `stylua.toml` for the formatter, which is a separate tool

```json
{
  "runtime.version": "LuaJIT",
  "diagnostics.globals": ["vim"],
  "workspace.library": ["$VIMRUNTIME/lua"]
}
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `luacheck <file>` | lint CLI with its own rule set |
| `luac -p <file>` | syntax-only parse check |
| `stylua --check <file>` | formatting check that writes nothing |

## Troubleshooting

- **Undefined `vim` global:** add it to `diagnostics.globals` and set `workspace.library`.
- **Wrong runtime version:** set `runtime.version` to match the interpreter (`LuaJIT`, `Lua 5.4`) or the standard library reads as undefined.
- **`--check` scans too much:** it follows `workspace.library` and can analyse large trees; narrow the directory argument.
- **Third-party annotations:** LuaLS reads `---@meta` stub files; add the stub folder to `workspace.library` instead of silencing warnings.
- **PATH:** a release archive needs its `bin` directory added by the user.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" init.lua                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" init.lua --via=checker           # force the checker path
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
