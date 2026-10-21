# C and C++: language-server and checker setup

- **Server id:** `clangd`, launched as `clangd --background-index --clang-tidy`
- **Extensions:** `.c .h .cc .cpp .cxx .c++ .hpp .hh .hxx .h++`
- **Checkers agy can drive:** `clangd --check=<file>`, `clang -fsyntax-only`, `clang-tidy`
- **Normalised by `lsp/scripts/diagnostics.mjs`:** yes, `clangd --check`, falling back to `clang`/`cc -fsyntax-only`
- **Evidence command when nothing is normalised:** `cmake --build build`

## What this gives you in agy

C and C++ results depend on a compilation database. Without `compile_commands.json` clangd guesses include paths and defines, so most of the work in this reference is getting that file in place.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- a compiler toolchain and the project's build system (CMake, Make, Meson, Bazel)

## Install (the user runs these)

**macOS**

- `brew install llvm` (keg-only: add `$(brew --prefix llvm)/bin` to PATH)
- the Xcode command line tools ship a clangd too: `xcrun --find clangd` prints its path (`xcode-select --install` installs the tools)

**Linux**

- Debian or Ubuntu: `sudo apt install clangd`
- Fedora: `sudo dnf install clang-tools-extra`
- Arch: `sudo pacman -S clang`
- other platforms: https://clangd.llvm.org/installation

**Windows**

- `winget install LLVM.LLVM` or `choco install llvm`
- add `C:\Program Files\LLVM\bin` to PATH

Confirm afterwards:

```sh
command -v clangd clang clang-tidy; clangd --version
```

clangd needs a compilation database to know include paths and defines. Check for `compile_commands.json` before trusting any result.

## Project configuration

- `compile_commands.json` at the project root or `build/`. Generate it with `cmake -S . -B build -DCMAKE_EXPORT_COMPILE_COMMANDS=ON`, `bear -- make` (`brew install bear`, `sudo apt install bear`), `ninja -t compdb`, or `meson setup build` (Meson writes it into the build directory)
- `.clangd` for per-project flags and the database location
- `.clang-tidy` for lint checks

```yaml
CompileFlags:
  Add: [-std=c++20]
  CompilationDatabase: build
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `ccls` | alternative C and C++ server |
| `clang-tidy -p build <file>` | lint CLI driven by the same database |
| `cppcheck --enable=warning <file>` | independent static analyser |

## Troubleshooting

- **Spurious "file not found" or unknown flags:** the database is missing or stale; regenerate it after changing the build.
- **Header diagnostics wrong:** make sure a translation unit that includes the header appears in the database, or add a `.clangd` flags block.
- **Homebrew LLVM not found:** the keg is not on PATH by default.
- **GCC-only flags:** a database produced for GCC can carry flags clang rejects; remove them under `CompileFlags: Remove:` in `.clangd`.
- **Cross-compilation:** add `--target=` through `CompileFlags: Add:` and point `--query-driver` at the cross compiler when the server must read its include paths.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" src/main.c                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" src/main.c --via=checker           # force the checker path
node "<skill-dir>/../lsp/scripts/diagnostics.mjs" src/main.c               # normalised CLI diagnostics
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
