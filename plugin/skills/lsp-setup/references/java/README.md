# Java: language-server and checker setup

- **Server id:** `jdtls`, launched as `jdtls`
- **Extensions:** `.java`
- **Checkers agy can drive:** `javac`, `mvn`, `gradle` (project builds)
- **Normalised by `lsp/scripts/diagnostics.mjs`:** no; the project build is the evidence
- **Evidence command when nothing is normalised:** `mvn -q -DskipTests compile   or   ./gradlew compileJava`

## What this gives you in agy

The Eclipse JDT language server (`jdtls`) is heavy and slow to start, which makes the project's own Maven or Gradle compile the practical evidence for agy. The server matters to the user's editor.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- a JDK to run the server; recent jdtls releases require JDK 21 to start, older ones accepted 17 (read the release notes of the version you install)
- the project itself may target an older Java than the server needs

## Install (the user runs these)

**macOS**

- `brew install jdtls`
- JDK: `brew install openjdk@21`, then follow the symlink hint Homebrew prints

**Linux**

- download a release from https://github.com/eclipse-jdtls/eclipse.jdt.ls, extract it and put its `bin/jdtls` launcher on PATH (the launcher script needs Python 3)
- Arch: the `jdtls` AUR package
- JDK: Debian or Ubuntu `sudo apt install openjdk-21-jdk`, Fedora `sudo dnf install java-21-openjdk-devel`

**Windows**

- download a release from https://github.com/eclipse-jdtls/eclipse.jdt.ls, extract it and put the launcher on PATH
- JDK: `winget install EclipseAdoptium.Temurin.21.JDK`

Confirm afterwards:

```sh
command -v jdtls; java -version; echo $JAVA_HOME
```

The server runs on the JDK found through `JAVA_HOME` or PATH. A project that targets Java 8 or 11 still gets analysed by a server running on 21.

## Project configuration

- `pom.xml` or `build.gradle(.kts)` must be valid; a broken build descriptor breaks symbol resolution
- `gradlew` and `mvnw` wrappers pin the build tool; prefer them over a global `gradle` or `mvn`
- `.settings/` and `.classpath` appear when the project was opened in Eclipse and can mislead the server

```sh
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"   # macOS example
jdtls -data "$HOME/.cache/jdtls-workspace/myproject"
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `checkstyle -c <config> <file>` | style findings |
| `spotbugs` | bytecode bug patterns after a compile |

## Troubleshooting

- **No JDK found:** the server exits at once; set `JAVA_HOME` to a JDK of the required version.
- **Slow or empty first run:** the initial classpath import takes a minute or more on large Maven or Gradle projects; wait with a bound.
- **Workspace data directory:** jdtls stores its index under the `-data` directory; keep it outside the repository and tell the user before deleting it to force a clean re-index.
- **Offline build:** Maven or Gradle resolution fails without network access; report that as the blocker.
- **`verify-lsp.mjs` times out:** jdtls can need more than 60 seconds on a cold start; raise `--timeout=180000` once.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" src/main/java/App.java                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" src/main/java/App.java --via=checker           # force the checker path
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
