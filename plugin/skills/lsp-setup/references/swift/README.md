# Swift: language-server and checker setup

- **Server id:** `sourcekit-lsp`, launched as `sourcekit-lsp`
- **Extensions:** `.swift`
- **Checkers agy can drive:** `swift build`, `swiftc -typecheck <file>`, `swiftlint`
- **Normalised by `lsp/scripts/diagnostics.mjs`:** no; `swift build` or `swiftc -typecheck` is the evidence
- **Evidence command when nothing is normalised:** `swift build`

## What this gives you in agy

`sourcekit-lsp` ships inside the Swift toolchain, so a machine that can build Swift already has the server. It reads a SwiftPM manifest or a compilation database; a bare Xcode project needs a bridge.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- a Swift toolchain: Xcode (macOS), the swift.org toolchain (Linux), or the Windows toolchain

## Install (the user runs these)

**macOS**

- `xcode-select --install` for the command line tools, or install Xcode; `xcrun --find sourcekit-lsp` prints the path
- optional lint: `brew install swiftlint`

**Linux**

- install a toolchain from https://www.swift.org/install/linux/ (the swiftly installer manages versions) and add its `usr/bin` to PATH

**Windows**

- `winget install Swift.Toolchain`, or the installer from https://www.swift.org/install/windows/
- the server is in the toolchain's `bin` directory

Confirm afterwards:

```sh
command -v sourcekit-lsp swift; swift --version; xcode-select -p
```

Pure Xcode projects without a SwiftPM manifest or a compilation database resolve poorly.

## Project configuration

- `Package.swift` for SwiftPM; the server builds an index from the `.build/` directory
- `compile_commands.json` for mixed Swift and Objective-C, or `buildServer.json` produced by `xcode-build-server` for an Xcode project
- `.swiftlint.yml` for lint rules

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "App",
    targets: [.executableTarget(name: "App")]
)
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `swiftlint lint --reporter json` | lint findings |
| `swift build 2>&1` | compiler diagnostics for the whole package; writes `.build/` |

## Troubleshooting

- **Wrong toolchain:** `xcode-select -p` shows the active Xcode; the user switches it with `xcode-select -s`.
- **No manifest:** add `Package.swift` or generate `compile_commands.json`.
- **First build is slow:** the server indexes the module graph on first open; wait with a bound.
- **`.build/` appears in the repository:** it is build output; the project's `.gitignore` should list it.
- **Linux toolchain mismatch:** `swift --version` and the `sourcekit-lsp` binary must come from the same installation.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" Sources/App/main.swift                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" Sources/App/main.swift --via=checker           # force the checker path
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
