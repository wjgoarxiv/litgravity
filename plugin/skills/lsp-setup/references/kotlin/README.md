# Kotlin: language-server and checker setup

- **Server id:** `kotlin-ls`, launched as `kotlin-lsp --stdio`
- **Extensions:** `.kt .kts`
- **Checkers agy can drive:** `gradle` / `./gradlew compileKotlin`, `kotlinc`, `ktlint`, `detekt`
- **Normalised by `lsp/scripts/diagnostics.mjs`:** no; the Gradle compile is the evidence
- **Evidence command when nothing is normalised:** `./gradlew compileKotlin`

## What this gives you in agy

Kotlin has an official JetBrains language server that is still pre-release, and a longer-standing community server. agy uses the Gradle compile as evidence and treats a server roundtrip as a bonus.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- a JDK (17 or newer for the JetBrains server)
- the project's Gradle wrapper (`./gradlew`)

## Install (the user runs these)

**macOS**

- `brew install JetBrains/utils/kotlin-lsp`
- community alternative: `brew install kotlin-language-server`

**Linux**

- download a release from https://github.com/Kotlin/kotlin-lsp, extract it and symlink its launcher as `kotlin-lsp` on PATH, for example `ln -s /opt/kotlin-lsp/kotlin-lsp.sh ~/.local/bin/kotlin-lsp`
- JDK: Debian or Ubuntu `sudo apt install openjdk-21-jdk`

**Windows**

- download a release from https://github.com/Kotlin/kotlin-lsp, extract it and put its launcher on PATH
- JDK: `winget install EclipseAdoptium.Temurin.21.JDK`

Confirm afterwards:

```sh
command -v kotlin-lsp; java -version
```

The official server is pre-release. Pin a known-good release and expect occasional breakage. The launch line uses `--stdio` so the server speaks over the pipe that `verify-lsp.mjs` opens; override it with `--server="kotlin-lsp <flags>"` if the installed release documents a different flag.

## Project configuration

- `build.gradle.kts` and `settings.gradle.kts` at the root; Gradle resolution runs on first open
- `gradle.properties` for JVM arguments that affect import time
- `.editorconfig` or `detekt.yml` when the project lints

```sh
ln -s /path/to/kotlin-lsp/kotlin-lsp.sh ~/.local/bin/kotlin-lsp
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `kotlin-language-server` | community server, stdio by default, more mature on plain Gradle projects |
| `ktlint <files>` | style findings |
| `detekt --input <dir>` | static analysis findings |

## Troubleshooting

- **No JDK:** the server fails to start; install a JDK or set `JAVA_HOME`.
- **Slow first import:** Gradle resolution on a large project can take minutes; wait with a bound.
- **`.kts` scripts resolve more slowly** than `.kt` sources; that is expected.
- **Gradle daemon memory:** an out-of-memory import points at `org.gradle.jvmargs` in `gradle.properties`, which is the user's file.
- **Pre-release flags change:** read `kotlin-lsp --help` once and trust it over this table.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" src/main/kotlin/App.kt                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" src/main/kotlin/App.kt --via=checker           # force the checker path
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
