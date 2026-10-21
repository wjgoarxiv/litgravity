# Dart and Flutter: language-server and checker setup

- **Server id:** `dart`, launched as `dart language-server --protocol=lsp`
- **Extensions:** `.dart`
- **Checkers agy can drive:** `dart analyze`, `flutter analyze`
- **Normalised by `lsp/scripts/diagnostics.mjs`:** no; `dart analyze --format=machine` is the evidence
- **Evidence command when nothing is normalised:** `dart analyze --format=machine   (Flutter: flutter analyze)`

## What this gives you in agy

The Dart analyzer is part of the SDK, and `dart analyze` is a first-class one-shot command with a machine-readable format, so Dart is well served from the command line.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- the Dart SDK or the Flutter SDK (Flutter bundles `dart`)

## Install (the user runs these)

**macOS**

- `brew tap dart-lang/dart && brew install dart` (the route dart.dev documents); `brew install dart-sdk` from Homebrew core is another
- or install Flutter and use its bundled `dart` (`<flutter>/bin` on PATH)

**Linux**

- follow https://dart.dev/get-dart for the Google apt repository
- or install the Flutter SDK

**Windows**

- `choco install dart-sdk`
- or install the Flutter SDK

Confirm afterwards:

```sh
command -v dart flutter; dart --version
```

There is no separate package for the server; it ships inside the SDK.

## Project configuration

- `pubspec.yaml` at the package root; `analysis_options.yaml` for lints
- `.dart_tool/package_config.json` appears after `dart pub get` and tells the analyzer where packages live

```yaml
include: package:lints/recommended.yaml
analyzer:
  language:
    strict-casts: true
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `dart analyze --format=machine` | one-shot findings, pipe-separated rows |
| `dart format --output=none --set-exit-if-changed .` | formatting check that writes nothing |

## Troubleshooting

- **PATH:** Flutter users need `<flutter>/bin` exported; the bundled `dart` works.
- **Out-of-date SDK:** `dart --version` shows it; the user upgrades with their package manager or `flutter upgrade` when analysis chokes on new syntax.
- **Unresolved packages:** the user runs `dart pub get` first; it downloads dependencies.
- **`flutter` first run is slow:** it can download artifacts; the user runs `flutter --version` once in their terminal.
- **Flag spelling:** the `--protocol=lsp` flag is the documented way to select the protocol; run `dart language-server --help` if a future SDK changes it.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" lib/main.dart                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" lib/main.dart --via=checker           # force the checker path
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
