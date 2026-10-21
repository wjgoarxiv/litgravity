# C# and Razor: language-server and checker setup

- **Server id:** `csharp`, launched as `csharp-ls   (Razor: roslyn-language-server --stdio)`
- **Extensions:** `.cs`, plus `.razor .cshtml` through the Roslyn server
- **Checkers agy can drive:** `dotnet build`, `dotnet format --verify-no-changes`
- **Normalised by `lsp/scripts/diagnostics.mjs`:** no; `dotnet build --no-restore -v q` is the evidence
- **Evidence command when nothing is normalised:** `dotnet build --no-restore -v q`

## What this gives you in agy

C# diagnostics are compiler diagnostics, so `dotnet build` is the dependable evidence in agy. Two servers exist: the community `csharp-ls` for plain C# and Microsoft's Roslyn server, which Razor files need.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- the .NET SDK (the runtime alone is not enough): macOS `brew install --cask dotnet-sdk`, Debian or Ubuntu `sudo apt install dotnet-sdk-8.0`, Fedora `sudo dnf install dotnet-sdk-8.0`, Windows `winget install Microsoft.DotNet.SDK.8`
- pick the SDK major version that the installed `csharp-ls` release targets (the examples use 8; Homebrew's cask tracks the newest); `dotnet tool install` reports a mismatch

## Install (the user runs these)

**macOS**

- `dotnet tool install -g csharp-ls`
- Razor: `dotnet tool install -g roslyn-language-server --prerelease` (Razor stdio support needs a recent preview)
- global tools land in `~/.dotnet/tools`; add that directory to PATH

**Linux**

- `dotnet tool install -g csharp-ls`
- Razor: `dotnet tool install -g roslyn-language-server --prerelease`
- add `~/.dotnet/tools` to PATH

**Windows**

- `dotnet tool install -g csharp-ls`
- Razor: `dotnet tool install -g roslyn-language-server --prerelease`
- global tools land in `%USERPROFILE%\.dotnet\tools`

Confirm afterwards:

```sh
command -v csharp-ls roslyn-language-server; dotnet --version; dotnet tool list -g
```

An unrestored solution yields empty results. `dotnet restore` downloads packages, so the user runs it.

## Project configuration

- a `.sln`, `.slnx` or `.csproj` at or above the file; the server loads the nearest solution
- `global.json` pins the SDK version
- `.editorconfig` and `Directory.Build.props` carry analyzer severities that change the diagnostics

```sh
export PATH="$PATH:$HOME/.dotnet/tools"
dotnet restore
dotnet build --no-restore -v q
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `roslyn-language-server --stdio` | Microsoft Roslyn-based server, required for Razor |
| `omnisharp -lsp` | older OmniSharp server for projects that still use it |
| `dotnet format --verify-no-changes` | style check that reports and writes nothing |

## Troubleshooting

- **No SDK:** install the SDK before the tool; `dotnet --list-sdks` shows what is available.
- **No symbols:** run `dotnet restore` (the user approves it).
- **PATH:** open a new shell after adding `~/.dotnet/tools`.
- **Wrong SDK picked up:** a `global.json` can pin a version that is not installed; report the pin.
- **Several solutions in one folder:** pass the solution to the server through its own option, or start from the folder of the intended one.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" Program.cs                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" Program.cs --via=checker           # force the checker path
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
